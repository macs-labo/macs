<?php
// 作物モード/病害虫選択

require_once './inc.filters.php';

if (isset($_REQUEST['cno'])) {
  $cno = $_REQUEST['cno'];
  $pcno = $_REQUEST['pcno'];
  $cgrp = isset($_REQUEST['cgrp']);
} else {
  $cno = $_SESSION[$mode]['cno'];
  $pcno = $_SESSION[$mode]['pcno'];
  $cgrp = $_SESSION[$mode]['cgrp'];
}
if ($_SESSION[$mode]['crops']) $crops = unserialize($_SESSION[$mode]['crops']);
if ($_SESSION[$mode]['pcats']) $pcats = unserialize($_SESSION[$mode]['pcats']);
$cid = $crops[$cno]['idsaku'];
$search = $cid != $_SESSION[$mode]['cid'] || $pcno != $_SESSION[$mode]['pcno'] || $cgrp != $_SESSION[$mode]['cgrp'];
if ($search) {
//  $filts = $pcats[$pcno]['cname'] == '雑草' ? $filters2 : $filters1;
  $filts = $ccats[$ccno]['cname'] == '雑草' ? $filters1 : $filters1;
  $_SESSION[$mode]['filts'] = serialize($filts);
} else {
  $filts = unserialize($_SESSION[$mode]['filts']);
  $fno = $_SESSION[$mode]['fno'];
}

$_SESSION[$mode]['pcno'] = $pcno;
if ($search) $_SESSION[$mode]['pid'] = '0';

if ($cid == $_SESSION[$mode]['cid'] && $cgrp == $_SESSION[$mode]['cgrp']) {
  $cond = $_SESSION[$mode]['cond'];
} else {
  $cid = $crops[$cno]['idsaku'];
  $class = $crops[$cno]['class'];
  $crop = $crops[$cno]['sakumotsu'];
  $gunmei = $crops[$cno]['gunmei'];
  $_SESSION[$mode]['cno'] = $cno;
  $_SESSION[$mode]['cid'] = $cid;
  $_SESSION[$mode]['gunmei'] = $gunmei;
  $_SESSION[$mode]['cgrp'] = $cgrp;
  $cond = _concat('|', $cid, substr($cid, 0, 12).'0000');
  if ($cgrp)  $cond = _concat('|', $cond, substr($cid, 0, 8).'00000000', substr($cid, 0, 6).'0000000000', substr($cid, 0, 4).'000000000000', substr($cid, 0, 2).'00000000000000');
  $sql = "select concat(',', sakumotsu) from m_sakumotsu where toroku in (1, 3) and idsaku regexp '$cond'";
  $db = dbOpen();
  $res = $db->query($sql);
  if (!$res) sqlerror($sql, $db);
  $cond = str_replace(',', '|', preg_quote($res->fetchColumn(0)));
  if ($cgrp) $cond = _concat('|', $cond, preg_quote($gunmei));
  $cond = "、($cond)、";
  dbCloseStatement($res);
  $sql = "select concat(',', quote(sakumotsu)) from m_sakumotsu left join sakuhojo using(idsaku) where '、'||concat('、', sakumotsu, shozoku)||'、' regexp '$cond' and nozoku not regexp '$cond' or fukumu regexp '$cond'";
  $res = $db->query($sql);
  if (!$res) sqlerror($sql, $db);
  $cond = $res->fetchColumn(0);
  dbCloseStatement($res);
  dbClose($db);
  $_SESSION[$mode]['cond'] = $cond;
}

if ($search) {
  $sql = "select idbyochu as idpest, byochu, max(idsaku) as idcrop from m_tekiyo left join m_byochu as b using(byochu) left join m_sakumotsu using(sakumotsu) "
         . "where sakumotsu in ($cond) and ifnullstr(byochu, '-') != '-' and (byochu not regexp '北海道|東北|北陸|関東|東山|東海|近畿|中国|四国|九州')";
  $pcid = $pcats[$pcno]['cid'];
  $_SESSION[$mode]['pcid'] = $pcid;
  if ($pcid) $sql .= " and substr(idpest, 1, 1) = '$pcid'";
  $sql .= " group by byochu order by ";
  $sql .= $pcats[$pcno]['cname'] == '害虫' ? "idpest" : "b.betsumei";
  $db = dbOpen();
  $res = $db->query($sql);
  if (!$res) sqlerror($sql, $db);
  $pests = $res->fetchAll(PDO::FETCH_ASSOC);
  dbCloseStatement($res);
  if ($pcid == 0 || $pcid == 5) {
    $sql = "select idbyochu as idpest, mokuteki as byochu, max(idsaku) as idcrop from m_tekiyo left join m_byochu as b on mokuteki = b.byochu left join m_sakumotsu using(sakumotsu) "
           . "where sakumotsu in ($cond) and ifnullstr(mokuteki, '-') != '-' group by mokuteki order by b.betsumei";
    $res = $db->query($sql);
    if (!$res) sqlerror($sql, $db);
    $pests = array_merge($pests, $res->fetchAll(PDO::FETCH_ASSOC));
    dbCloseStatement($res);
  }
  dbClose($db);
  if (!count($pests)) error('検索エラー','該当する病害虫がありません');
  $_SESSION[$mode]['pests'] = serialize($pests);
} else {
  $pests = unserialize($_SESSION[$mode]['pests']);
}

if (!isset($_SESSION[$mode]['pgrp'])) $_SESSION[$mode]['pgrp'] = true;
$template->assign('pcno', $_SESSION[$mode]['pcno']);
$template->assign('pgrp', $_SESSION[$mode]['pgrp']);
$template->assign('pid', $_SESSION[$mode]['pid']);
$template->assign('title', "{$crops[$cno]['sakumotsu']}/{$pcats[$pcno]['cname']}");
$template->assign('pests', $pests);
$template->assign('count', count($pests));
$template->assign('filts', $filts);
$template->assign('fname', $filts[$fno]['name']);
$template->display($mode.$func.$tplext);
?>
