<?php
// 薬剤選択

if (isset($_REQUEST['pno'])) {
  $pno = $_REQUEST['pno'];
} else {
  $pno = $_SESSION[$mode]['pno'];
}
if ($_SESSION[$mode]['pnames']) {
  $pnames = unserialize($_SESSION[$mode]['pnames']);
  $popname = $pnames[$pno]['tsusho'];
}

if ($popname == $_SESSION[$mode]['popname']) {
  $chems = unserialize($_SESSION[$mode]['chems']);
  $crops = unserialize($_SESSION[$mode]['crops']);
} else {
  $db = dbOpen();
  $sql = "select bango, meisho from m_kihon where tsusho = '$popname'";
  $res = $db->query($sql);
  if (!$res) sqlerror($sql, $db);
  $chems = $res->fetchAll(PDO::FETCH_ASSOC);
  dbCloseStatement($res);
  if (!count($chems)) error('検索エラー', '該当する農薬がありません');
  $sql = "select distinct sakumotsu from m_tekiyo left join m_sakumotsu using(sakumotsu) "
       . "where bango in (select bango from m_kihon where tsusho = '$popname') order by idsaku";
  $res = $db->query($sql);
  if (!$res) sqlerror($sql, $db);
  $crops = $res->fetchAll(PDO::FETCH_ASSOC);
  dbCloseStatement($res);
  dbClose($db);
  if (!count($crops)) error('検索エラー', '該当する作物がありません');
  $_SESSION[$mode]['chems'] = serialize($chems);
  $_SESSION[$mode]['crops'] = serialize($crops);
  $_SESSION[$mode]['pno'] = $pno;
  $_SESSION[$mode]['popname'] = $popname;
}

$min = 100;
$def = 0;
foreach($chems as &$chem) {
  $len = mb_strlen($chem['meisho']);
  if ($len <= $min) {
    $min = $len;
    if ($chem['bango'] > $def) $def = $chem['bango'];
  }
}
$template->assign('rno', $_SESSION[$mode]['rno']);
$template->assign('cropname', $_SESSION[$mode]['cropname']);
$template->assign('title', $popname);
$template->assign('chems', $chems);
$template->assign('crops', $crops);
$template->assign('count1', count($chems));
$template->assign('count2', count($crops));
$template->assign('def', $def);
$template->display($mode.$func.$tplext);
?>
