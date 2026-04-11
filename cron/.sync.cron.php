<?php
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE & ~E_STRICT & ~E_DEPRECATED);
ini_set('display_errors', 1);
header('Content-type: text/plain');

//カレントディレクトリをスクリプトディレクトリに変更
chdir(__DIR__);

function http_headers_s($url, $headers = null) {
  $opt['method'] = 'HEAD';
  if (isset($headers)) {
    if (is_array($headers)) $headers = implode("\r\n", $headers);
    if ($headers != '') $opt['header'] = $headers;
  }
  $context = stream_context_create(array('http' => $opt));
  clearstatcache();
  $res = get_headers($url, true, $context);
  $res['ResponseCode'] = intval(substr($res[0], 9, 3));
  return $res;
}
/* ファイルの Last-Modified 取得 */
function getLastModified_s($url) {
  if (!$url) return false;

  // 1. GitHub の Raw URL かどうかを判定
  if (preg_match('|^https://raw\.githubusercontent\.com/([^/]+)/([^/]+)/([^/]+)/(.+)$|', $url, $matches)) {
    $owner  = $matches[1];
    $repo   = $matches[2];
    $branch = $matches[3];
    $path   = $matches[4];

    $api_url = "https://api.github.com/repos/$owner/$repo/commits?path=$path&sha=$branch&page=1&per_page=1";

    // トークン取得ロジック
    $token = '';
    if (PHP_SAPI === 'cli') { 
      // CLI実行 (GitHub Actions 上の PHP) の場合は環境変数を参照
      $token = getenv('GITHUB_TOKEN') ?: getenv('GH_TOKEN') ?: '';
    } else {
      // Web経由 (curl経由) の場合はカスタムヘッダー X-GitHub-Token を参照
      // Apache経由の場合、PHPでは $_SERVER['HTTP_X_GITHUB_TOKEN'] に格納される
      $token = $_SERVER['HTTP_X_GITHUB_TOKEN'] ?? '';
    }

    $http_headers = array('User-Agent: PHP-Script');
    if ($token) {
      $http_headers[] = 'Authorization: token ' . $token;
    }
    $opt = array(
      'http' => array(
        'method' => 'GET',
        'header' => implode("\r\n", $http_headers)
      )
    );
    $context = stream_context_create($opt);
    $res_json = @file_get_contents($api_url, false, $context);
    
    if ($res_json) {
      $data = json_decode($res_json, true);
      if (isset($data[0]['commit']['committer']['date'])) {
        return strtotime($data[0]['commit']['committer']['date']);
      }
    }
    return false;
  }

  // 2. 通常のHTTP URLの場合
  if (strpos($url, 'http') === 0) {
    $res = http_headers_s($url);
    return $res['ResponseCode'] == 200 ? strtotime($res['Last-Modified'] ?? 0) : false;
  }

  // 3. ローカルファイルの場合
  if (file_exists($url)) {
    clearstatcache();
    return filemtime($url);
  }

  return false;
}

/* 更新されていれば mtime いなければ false を返す */
function is_modified_s($url, $date, $forceupdate = false) {
  $mtime = getLastModified_s($url);
  //if (!$mtime) return false;
  if (is_string($date)) $date = strtotime($date);
  return ($mtime > $date) || $forceupdate ? $mtime : false;
}

$file = 'cron.zip';
$src = "https://raw.githubusercontent.com/macs-labo/macs/main/cron/$file";
$fupdate = $_REQUEST['update'] ?? false;

$total = -microtime(true);

// ローカルと $src の cron.zip のタイムスタンプを比較して、$src が新しければファイル同期
$mtime = is_modified_s($src, getLastModified_s($file), $fupdate);
if ($mtime === false) {
  echo "sync: $file: Not Modified\n";
  exit(1);
}

$body = file_get_contents($src);
if ($body === false) {
  echo "sync: Cannot get $src\n";
  exit(1);
}
file_put_contents($file, $body, LOCK_EX);
touch($file, $mtime);
echo "sync: $file: Downloaded\n";

// unzip コマンドが使えるか確認 (リターンコードが 0 なら成功)
$return_var = 0;
$output = [];
exec("unzip -v", $output, $return_var);

if ($return_var === 0) {
  exec("unzip -o ./$file");
  echo "sync: $file: Updated\n";
} elseif (class_exists('ZipArchive')) {
  // unzip コマンドがない場合は ZipArchive クラスを使用
  $zip = new ZipArchive;
  if ($zip->open("./$file") === TRUE) {
    $zip->extractTo('./');
    $zip->close();
    echo "sync: $file: Updated\n";
  } else {
    echo "Failed to unzip $file\n";
    exit(1);
  }
} else {
  echo "Error: unzip command not found and ZipArchive class is missing.\n";
  exit(1);
}

require_once '.update.cron.php';
