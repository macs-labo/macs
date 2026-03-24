<?php
// 病害虫モード/作物選択

require_once './inc.filters.php';

if (isset($_REQUEST['pno'])) {
  $pno = $_REQUEST['pno'];
  $ccno = $_REQUEST['ccno'];
} else {
  $pno = $_SESSION[$mode]['pno'];
  $ccno = $_SESSION[$mode]['ccno'];
}
$pests = unserialize($_SESSION[$mode]['pests']);
$pid = $pests[$pno]['idbyochu'];
$pest = $pests[$pno]['byochu'];
//$_SESSION['mode']['pest'] = $pest;
$ccats = unserialize($_SESSION[$mode]['ccats']);
$ccid = $ccats[$ccno]['cid'];
$ccname = $ccats[$ccno]['cname'];
$search = $pid != $_SESSION[$mode]['pid'] || $ccid != $_SESSION[$mode]['ccid'];
$_SESSION[$mode]['pno'] = $pno;
$_SESSION[$mode]['pid'] = $pid;
$_SESSION[$mode]['ccno'] = $ccno;
$_SESSION[$mode]['ccid'] = $ccid;
$fno = isset($_SESSION[$mode]['fno']) ? $_SESSION[$mode]['fno'] : 0;
if ($search) {
  $filts = $ccats[$ccno]['cname'] == '雑草' ? $filters1 : $filters1;
  $_SESSION[$mode]['filts'] = serialize($filts);
} else {
  $filts = unserialize($_SESSION[$mode]['filts']);
  $fno = $_SESSION[$mode]['fno'];
}

if ($search) {
  $cond = "select bango from m_tekiyo where concat('、', byochu, mokuteki) like '%$pest%'";
  $_SESSION[$mode]['cond'] = $cond;
  $sql = "where sakumotsu not like '%除く%'";
  if ($ccid !== '00') $sql .= " and idsaku like '$ccid%'";
  $sql = "select distinct class, idsaku, sakumotsu, gunmei from (select * from m_tekiyo where bango in ($cond)) left join m_sakumotsu using(sakumotsu) $sql order by idsaku;";
  $db = dbOpen();
  $res = $db->query($sql);
  if (!$res) sqlerror($sql, $db);
  $crops = $res->fetchAll(PDO::FETCH_ASSOC);
  dbCloseStatement($res);
  dbClose($db);
  if (!count($crops)) error('検索エラー','該当する作物がありません');
  $_SESSION[$mode]['crops'] = serialize($crops);
//  $_SESSION[$mode]['cno'] = 0;
  $_SESSION[$mode]['cid'] = $crops[0]['idbyochu'];
  $_SESSION[$mode]['pid'] = $pid;
  $_SESSION[$mode]['pest'] = $pest;
} else {
  $crops = unserialize($_SESSION[$mode]['crops']);
//  $cno = $_SESSION[$mode]['cno'];
}

$template->assign('pid', $_SESSION[$mode]['pid']);
$template->assign('title', "$pest/$ccname");
$template->assign('crops', $crops);
$template->assign('count', count($crops));
$template->assign('cid', $_SESSION[$mode]['cid']);
//$template->assign('fno', $fno);
$template->assign('filts', $filts);
$template->assign('fname', $filts[$fno]['name']);
$template->display($mode.$func.$tplext);
?>
