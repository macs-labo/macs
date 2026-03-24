<?php
// 農薬通称選択

$kw = $_REQUEST['kw'];
if ($kw) {
  $kw = mb_convert_kana($kw, 'a');
} else {
  $kw = $_SESSION[$mode]['kw'];
}

if (!$kw) error('検索語エラー', '検索語を入力してください');

if ($kw == $_SESSION[$mode]['kw']) {
  $pnames = unserialize($_SESSION[$mode]['pnames']);
} else {
  $db = dbOpen();
  $nkw = _strconv($kw);
  $sql = "select distinct tsusho from m_kihon where bango in (select bango from kwlists where strconv(kws) like '%$nkw%') order by tsusho";
  $res = $db->query($sql);
  if (!$res) sqlerror($sql, $db);
  $pnames = $res->fetchAll(PDO::FETCH_ASSOC);
  dbCloseStatement($res);
  if (!count($pnames)) {
    $kw = roman2kana($kw, 1);
    $nkw = _strconv($kw);
    $sql = "select distinct tsusho from m_kihon where bango in (select bango from kwlists where strconv(kws) like '%$nkw%') order by tsusho";
    $res = $db->query($sql);
    if (!$res) sqlerror($sql, $db);
    $pnames = $res->fetchAll(PDO::FETCH_ASSOC);
    dbCloseStatement($res);
  }
  dbClose($db);
  if (!count($pnames)) error('検索エラー', "'$kw' に該当する通称がありません");
  $_SESSION[$mode]['pnames'] = serialize($pnames);
  $_SESSION[$mode]['kw'] = $kw;
}

$min = 100;
foreach($pnames as &$pname) {
  $len = mb_strlen(str_replace(mb_strtoupper(mb_convert_kana($_SESSION[$mode]['kw'], 'asCKV')), '', mb_strtoupper(mb_convert_kana($pname['tsusho'], 'asCKV'))));
  if ($len < $min) {
    $min = $len;
    $def = $pname['tsusho'];
  }
}
$template->assign('title', "[$kw]");
$template->assign('pno', $_SESSION[$mode]['pno']);
$template->assign('popname', $_SESSION[$mode]['popname']);
$template->assign('pnames', $pnames);
$template->assign('count', count($pnames));
$template->assign('def', $def);
$template->display($mode.$func.$tplext);
?>
