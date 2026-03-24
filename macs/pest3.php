<?php
// 病害虫モード/薬剤通称選択

$crops = unserialize($_SESSION[$mode]['crops']);
$filts = unserialize($_SESSION[$mode]['filts']);
if (isset($_SESSION[$mode]['chems'])) $chems = unserialize($_SESSION[$mode]['chems']);
if (isset($_REQUEST['cno'])) {
  $cno = $_REQUEST['cno'];
  $fno = $_REQUEST['fno'];
  $_SESSION[$mode]['cno'] = $cno;
} else {
  $cno = $_SESSION[$mode]['cno'];
  $fno = $_SESSION[$mode]['fno'];
}
$cid = $crops[$cno]['idsaku'];
$crop = $crops[$cno]['sakumotsu'];
$gunmei = $crops[$cno]['gunmei'];

if ($cid != $_SESSION[$mode]['cid'] || $fno != $_SESSION[$mode]['fno']) {
  $_SESSION[$mode]['fno'] = $fno;
  $_SESSION[$mode]['cid'] = $cid;
  $cid2 = substr($cid, 0, 12);
  $class = $crops[$cno]['class'];
  $db = dbOpen();
  if ($class == 4) {
    $cond = _concat('|', $cid, "{$cid2}0000");
    $sql = "select sakumotsu from m_sakumotsu where idsaku = '{$cid2}0000'";
    $res = $db->query($sql);
    if (!$res) sqlerror($sql, $db);
    $crop = $res->fetchColumn(0);
    dbCloseStatement($res);
  } else {
    $cond = $cid2;
  }
  $crop = preg_quote($crop);
  $sql = "select concat('|', idsaku) from m_sakumotsu where sakumotsu regexp '(\(|、)($crop)(\)|、)'";
  $res = $db->query($sql);
  if (!$res) sqlerror($sql, $db);
  $cond = _concat('|', $cond, $res->fetchColumn(0));
  dbCloseStatement($res);
  $cond = _concat('|', $cond, substr($cid, 0, 8)."0000", substr($cid, 0, 6)."000000", substr($cid, 0, 4)."00000000", substr($cid, 0, 2)."0000000000");
  if ($gunmei) {
    $sql = "select substr(idsaku, 1, 14) from m_sakumotsu where sakumotsu = '$gunmei'";
    $res = $db->query($sql);
    if (!$res) sqlerror($sql, $db);
    $cond = _concat('|', $cond, $res->fetchColumn(0));
    dbCloseStatement($res);
  }
  $except = _concat('|', "{$cid2}0000", substr($cid, 0, 8)."00000000", substr($cid, 0, 6)."0000000000", substr($cid, 0, 4)."000000000000");
  $sql = "select concat('|', sakumotsu) from m_sakumotsu where idsaku regexp '$except'";
  $res = $db->query($sql);
  if (!$res) sqlerror($sql, $db);
  $except = str_replace('\\|', '|', preg_quote($res->fetchColumn(0)));
  dbCloseStatement($res);
  dbClose($db);
  $except = preg_replace('/(?<!なばな|豆)類/', '(類)?', $except);
  $except = "\((.*、)?($except)(、.*)?を除く";
  $crop = $crops[$cno]['sakumotsu'];
  if (strpos($crop, '露地') !== false) $except .= '|施設|水耕';
  if (strpos($crop, '施設') !== false) $except .= '|露地';
  if (strpos($crop, '水耕') !== false) $except .= '|露地';
  $sql = "select sakumotsu from m_sakumotsu where toroku = 1 and idsaku regexp '^($cond)' and sakumotsu not regexp '$except'";
  $_SESSION[$mode]['cropsql'] = $sql; 
  $cond = $_SESSION[$mode]['cond'];
  $sql = "select tsusho,replace(jiki,'まで','') as jiki,concat(',',concat('/',re_replace('\[.+?\]',keito,''),mid)) as rac from (select * from m_kihon where bango in ($cond)) left join m_tekiyo using(bango) left join seibun using(bango) left join rac using(ippanmei) where sakumotsu in ($sql) ";
  if ($fno) $sql .= "and {$filts[$fno]['filter']} ";
  $sql .= "group by tsusho order by tsusho";
  $db = dbOpen();
  $res = $db->query($sql);
  if (!$res) sqlerror($sql, $db);
  $chems = $res->fetchAll(PDO::FETCH_ASSOC);
  dbCloseStatement($res);
  dbClose($db);
  $count = count($chems);
  if (!count($chems)) error('検索エラー','適用農薬がありません');
  $_SESSION[$mode]['chems'] = serialize($chems);
  $_SESSION[$mode]['tno'] = 0;
}

$template->assign('tno', $_SESSION[$mode]['tno']);
$template->assign('fno', $fno);
$template->assign('cid', $cid);
$template->assign('title', "$crop/{$_SESSION[$mode]['pest']}");
$template->assign('chems', $chems);
$template->assign('count', count($chems));
$template->assign('tno', $_SESSION[$mode]['tno']);
$template->display($mode.$func.$tplext);
?>
