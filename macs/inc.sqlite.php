<?php
require_once './inc.setup.php';

define('MainDb', 'acis.db');
define('SubDb','spec.db');
define('UdFlag', 'update');

function _regexp($pattern, $target) {
  return preg_match("'$pattern'", $target);
}

function _re_replace($pattern, $target, $replacement) {
  if (is_null($target)) $target = '';
  return preg_replace("'$pattern'", $replacement, $target);
}

function _replace($target, $search, $replacement) {
  if (is_null($target)) $target = '';
  return str_replace($search, $replacement, $target);
}

function _strconv($str, $opt = 'ckwv') {
  $from = array(
    'ヴぁ','ヴぃ','ヴぇ','ヴぉ','ヴ',
    ' ',',','-','ー','ぁ','ぃ','ぅ','ぇ','ぉ','ヵ','ヶ','っ','ゃ','ゅ','ょ','ゎ',
    'が','ぎ','ぐ','げ','ご','ざ','じ','ず','ぜ','ぞ','だ','ぢ','づ','で','ど',
    'ば','び','ぶ','べ','ぼ','ぱ','ぴ','ぷ','ぺ','ぽ'
  );
  $to = array(
    'は','ひ','へ','ほ','ふ',
    '','','','','あ','い','う','え','お','か','け','つ','や','ゆ','よ','わ',
    'か','き','く','け','こ','さ','し','す','せ','そ','た','ち','つ','て','と',
    'は','ひ','ふ','へ','ほ','は','ひ','ふ','へ','ほ'
  );
//  if (func_num_args() == 1) $opt = 'cwkv';
  $opt = strtolower($opt);
  if (strpos($opt, 'w') !== false) $mod = 'asKV';
  if (strpos($opt, 'k') !== false) $mod = 'ascHV';
  if ($mod) $str = mb_convert_kana($str, $mod);
  if (strpos($opt, 'c') !== false) $str = mb_strtoupper($str);
  if (strpos($opt, 'v') !== false) $str = str_replace($from, $to, $str);
  return $str;
}

function _ifnullstr($expr, $replacement) {
  if (is_null($expr)) $expr = '';
  return $expr ? $expr : $replacement;
}

function _if($expr, $true, $false) {
  return $expr ? $true : $false;
}

function _concat() {
  $argc = func_num_args();
  if ($argc < 2) return '';
  $args = func_get_args();
  $connector = array_shift($args);
  $con = preg_quote($connector);
  $argc--;
  $res = null;
  while ($argc > 0) {
    $arg = array_shift($args);
    $argc--;
    if (is_null($arg) || !$arg) continue;
    if (is_null($res)) $res = '';
    $pats = explode($con, $arg);
    foreach($pats as $arg) {
      $pat = preg_quote($arg);
      if (!preg_match("'(^|$con)$pat($con|$)'", $res)) $res .= $res ? $connector.$arg : $arg;
    }
  }
  return $res;
}

function _concatStep(&$context, $row, $connector, $data) {
  $con = preg_quote($connector);
  if (is_null($data)) $data = '';
  $pats = explode($con, $data);
  foreach($pats as $arg) {
    $pat = preg_quote($arg);
    if (is_null($arg) || !$arg) continue;
    if (!isset($context)) $context = '';
    if (!preg_match("'(^|$con)$pat($con|$)'", $context)) $context .= $context ? $connector.$arg : $arg;
  }
  return $context;
}

function _concatFinal(&$context, $rows) {
  return $context;
}

function _concat2() {
  $argc = func_num_args();
  if ($argc < 2) return '';
  $args = func_get_args();
  $connector = array_shift($args);
  $argc--;
  $res = null;
  while ($argc > 0) {
    $arg = array_shift($args);
    $argc--;
    if (is_null($arg) || !$arg) continue;
    if (is_null($res)) $res = '';
    $res .= $res ? $connector.$arg : $arg;
  }
  return $res;
}

function _concat2Step(&$context, $row, $connector, $data) {
  if (!is_null($data) && $data != '') {
    if ($context) {
      $context .= $connector.$data;
    } else {
      $context = $data;
    }
  }
  return $context;
}

function dbCloseStatement(&$st) {
  if ($st) {
    $st->closeCursor();
    unset($st);
  }
}

function dbClose(&$db) {
  if (isset($db)) unset($db);
}

function dbOpen() {
  $udflag = DbPath.'/'.UdFlag;
  $maindb = DbPath.'/'.MainDb;
  $subdb  = DbPath.'/'.SubDb;
  $time = microtime(true);
  while (file_exists($udflag)) {
    if (microtime(true) - $time > 0.9) error('データベースエラー', 'データベース更新中');
    usleep(300000);
  }
  try {
    $db = new PDO("sqlite:$maindb");
  } catch(PDOException $e) {
    error('データベースエラー', $e->getMessage());
  }
  echo realpath($subdb)."\n";
  $db->exec("PRAGMA temp_store = 2;");
  $db->query("attach database '../data/spec.db' as spec");
  $db->sqliteCreateFunction('regexp', '_regexp', 2);
  $db->sqliteCreateFunction('re_replace', '_re_replace', 3);
  $db->sqliteCreateFunction('replace', '_replace', 3);
  $db->sqliteCreateFunction('strconv', '_strconv', 1);
  $db->sqliteCreateFunction('strconv', '_strconv', 2);
  $db->sqliteCreateFunction('ifnullstr', '_ifnullstr', 2);
  $db->sqliteCreateFunction('if', '_if', 3);
  $db->sqliteCreateFunction('concat', '_concat');
  $db->sqliteCreateAggregate('concat', '_concatStep', '_concatFinal', 2);
  $db->sqliteCreateFunction('concat2', '_concat2');
  $db->sqliteCreateAggregate('concat2', '_concat2Step', '_concatFinal', 2);
  return $db;
}
?>
