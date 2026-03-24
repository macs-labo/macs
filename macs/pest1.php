<?php
// 対象病害虫選択

$kw = $_REQUEST['kw'];
if ($kw) {
  $kw = roman2kana(mb_convert_kana($kw, 'a'));
} else {
  $kw = $_SESSION[$mode]['kw'];
}

if (!$kw) error('検索語エラー', '検索語を入力してください');
$template->assign('kw', $kw);

if ($kw == $_SESSION[$mode]['kw']) {
  $pests = unserialize($_SESSION[$mode]['pests']);
  $ccats = unserialize($_SESSION[$mode]['ccats']);
} else {
  $nkw = _strconv($kw);
  $db = dbOpen();
  if (! isset($ccats)) {
    $sql = "select substr(idsaku, 1, 2) as cid, sakumotsu as cname from m_sakumotsu where class = 0;";
    $res = $db->query($sql);
    $ccats = $res->fetchAll(PDO::FETCH_ASSOC);
    dbCloseStatement($res);
    array_unshift($ccats, array('cid' => '00', 'cname' => 'すべて'));
    $_SESSION[$mode]['ccats'] = serialize($ccats);
    $_SESSION[$mode]['ccno'] = 0;
    $_SESSION[$mode]['ccid'] = '00';
  }
  $sql = "select cid, gid, idbyochu, byochu from m_byochu where strconv(byochu||'、'||betsumei) regexp '$nkw'";// and byochu not like '%除く%' order by idbyochu";
  $res = $db->query($sql);
  if (!$res) sqlerror($sql, $db);
  $pests = $res->fetchAll(PDO::FETCH_ASSOC);
  dbCloseStatement($res);
  dbClose($db);
  if (!count($pests)) error('検索エラー', "'$kw' に該当する病害虫等がありません");
  $min = 100;
  foreach($pests as &$pest) {
    $len = mb_strlen($pest['byochu']);
    if ($len < $min) {
      $min = $len;
      $def = $pest['idbyochu'];
    }
  }
  $_SESSION[$mode]['pests'] = serialize($pests);
  $_SESSION[$mode]['kw'] = $kw;
}

$template->assign('title', "[{$_SESSION[$mode]['kw']}]");
$template->assign('pno', $_SESSION[$mode]['pno']);
$template->assign('pid', $_SESSION[$mode]['pid']);
$template->assign('def', $def);
$template->assign('pests', $pests);
$template->assign('count', count($pests));
$template->assign('ccats', $ccats);
$template->assign('ccno', $_SESSION[$mode]['ccno']);
$template->assign('ccid', $_SESSION[$mode]['ccid']);
$template->display($mode.$func.$tplext);
?>
