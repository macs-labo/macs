<?php
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE & ~E_DEPRECATED);
ini_set('display_errors', 1);

// サイト名と分室名
// FAMIC との使用許諾の関係があるので、○○分室の部分だけ適当な名称に変更
$sitename = '携帯農薬検索実験室';
$branch = '○○分室';

$branches = array(
  array('host' => 'macs.xii.jp', 'branch' => '本室'),
  array('host' => 'macs.vercel.app', 'branch' => '本室別館'),
  array('host' => 'macs.kabe.info', 'branch' => '秋田分室'),
  array('host' => 'noyaku.ebb.jp', 'branch' => '大阪分室')
);
$host = $_SERVER['HTTP_HOST'];
foreach($branches as $b) {
  if ($b['host'] == $host) $branch = $b['branch'];
}

$rootsite = 'https://macs.xii.jp/';
$acfbpath = 'acfinder';
$macspath = 'macs';
$datapath = 'data';

if ($branch == '本室') $branch = '';
$url = '../';
$home = array('url' => $url, 'title' => $sitename.$branch);

// Vercel判定フラグ
$isVercel = (getenv('VERCEL') === '1');
if ($isVercel) {
  $user_root = '';
  $dbPath = dirname(__DIR__) . '/data';
  $smartyPath = __DIR__ . '/vendor/smarty/smarty/libs/';
  $Debug = false; // Vercel は基本 false
} else {
  // サーバ上のユーザルートディレクトリの絶対パス自動取得
  if (!$user_root) { // 1. 環境変数をチェック（CLI実行時などのため）
    $user_root = $_SERVER['HOME'] ?? getenv('HOME');
  }
  if (!$user_root && function_exists('posix_getpwuid')) { // 2. 取れなかったらシステム情報から取得を試みる
    $userInfo = posix_getpwuid(posix_geteuid());
    $user_root = $userInfo['dir'] ?? false;
  }
  if (!$user_root) { // 3. それでもダメならスクリプトパスから逆算する（最終手段）
    $parts = explode(DIRECTORY_SEPARATOR, __DIR__); 
    $user_root = count($parts) > 3 ? implode(DIRECTORY_SEPARATOR, array_slice($parts, 0, 3)) : __DIR__;
  }
  //$user_root = rtrim($user_root, DIRECTORY_SEPARATOR);
  $dbPath = "$user_root/sqlitedb/famic";
  $smartyPath = "$user_root/lib/php/Smarty/";
  $Debug = basename(__DIR__) != 'macs'; // 公開ディレクトリ以外なら true
}

$tmpPath = "$user_root/tmp";
define('SessionPath', $tmpPath); // セッションデータ保存パス
define('DbPath', $dbPath); // データベースパス
define('SmartyPath', $smartyPath); // Smarty 4.x へのパスを設定
//define('Smarty5Path', "$user_root/lib/php/smarty/"); // Smarty 5.x へのパスを設定
define('TmpPath', $tmpPath); // Smarty cache への絶対パス
define('TemplatePath', __DIR__.'/templates'); // テンプレートの絶対パス
define('TopPage', './index.php'); // トップページの相対パス
define('_debug_', $Debug);
?>
