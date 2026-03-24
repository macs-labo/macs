<?php
// 適用表示

$acno = $_REQUEST['acno'];
$cno  = $_REQUEST['cno'];

$chems = unserialize($_SESSION[$mode]['chems']);
$crops = unserialize($_SESSION[$mode]['crops']);
$rno = $chems[$acno]['bango'];
$fullname = $chems[$acno]['meisho'];
$cropname = $crops[$cno]['sakumotsu'];

$_SESSION[$mode]['rno'] = $rno;
$_SESSION[$mode]['fullname'] = $fullname;
$_SESSION[$mode]['cropname'] = $cropname;

$db = dbOpen();
$sql = <<<SQL1
select distinct shurui, zaikei, ifnullstr(dokusei, '不明') as dokusei, yoto, koka, ryakusho,
ifnullstr(torokubi, '不明') as toroku, kousin as koshin, ifnullstr(a.kigen, '不明') as kigen,
(select concat(': ', ippanmei, nodo) from seibun where bango = a.bango and (ippanmei = seibun1 or seibun = seibun1)) as comp1,
(select concat(': ', ippanmei, nodo) from seibun where bango = a.bango and (ippanmei = seibun2 or seibun = seibun2)) as comp2,
(select concat(': ', ippanmei, nodo) from seibun where bango = a.bango and (ippanmei = seibun3 or seibun = seibun3)) as comp3,
(select concat(': ', ippanmei, nodo) from seibun where bango = a.bango and (ippanmei = seibun4 or seibun = seibun4)) as comp4,
(select concat(': ', ippanmei, nodo) from seibun where bango = a.bango and (ippanmei = seibun5 or seibun = seibun5)) as comp5,
(select concat('#', '{$rac['iso']}'||iso, '{$rac['keito1']}'||keito1, '{$rac['mid']}'||mid, '{$rac['keito']}'||keito, '{$rac['sayoten']}'||sayoten, '{$rac['sayokiko']}'||sayokiko, '{$rac['fgroup']}'||fgroup, '{$rac['risk']}'||risk) from rac left join iso using(ippanmei) where ippanmei = seibun1) as classifire1,
(select concat('#', '{$rac['iso']}'||iso, '{$rac['keito1']}'||keito1, '{$rac['mid']}'||mid, '{$rac['keito']}'||keito, '{$rac['sayoten']}'||sayoten, '{$rac['sayokiko']}'||sayokiko, '{$rac['fgroup']}'||fgroup, '{$rac['risk']}'||risk) from rac left join iso using(ippanmei) where ippanmei = seibun2) as classifire2,
(select concat('#', '{$rac['iso']}'||iso, '{$rac['keito1']}'||keito1, '{$rac['mid']}'||mid, '{$rac['keito']}'||keito, '{$rac['sayoten']}'||sayoten, '{$rac['sayokiko']}'||sayokiko, '{$rac['fgroup']}'||fgroup, '{$rac['risk']}'||risk) from rac left join iso using(ippanmei) where ippanmei = seibun3) as classifire3,
(select concat('#', '{$rac['iso']}'||iso, '{$rac['keito1']}'||keito1, '{$rac['mid']}'||mid, '{$rac['keito']}'||keito, '{$rac['sayoten']}'||sayoten, '{$rac['sayokiko']}'||sayokiko, '{$rac['fgroup']}'||fgroup, '{$rac['risk']}'||risk) from rac left join iso using(ippanmei) where ippanmei = seibun4) as classifire4,
(select concat('#', '{$rac['iso']}'||iso, '{$rac['keito1']}'||keito1, '{$rac['mid']}'||mid, '{$rac['keito']}'||keito, '{$rac['sayoten']}'||sayoten, '{$rac['sayokiko']}'||sayokiko, '{$rac['fgroup']}'||fgroup, '{$rac['risk']}'||risk) from rac left join iso using(ippanmei) where ippanmei = seibun5) as classifire5,
(select chuijiko from suisan where bango = a.bango) as chuijiko
from m_kihon as a left join seizai using(bango) where bango = '$rno'
SQL1;
$res = $db->query($sql);
if (!$res) sqlerror($sql, $db);
$bases = $res->fetchAll(PDO::FETCH_ASSOC);
dbCloseStatement($res);
if (!count($bases)) error('検索エラー', '剤の概要を取得できません');

$sql = <<<SQL2
select distinct sakumotsu,
(select seibun from seibun where bango = a.bango and (ippanmei = seibun1 or seibun = seibun1)) as seibun1, kaisu1,
(select seibun from seibun where bango = a.bango and (ippanmei = seibun2 or seibun = seibun2)) as seibun2, kaisu2,
(select seibun from seibun where bango = a.bango and (ippanmei = seibun3 or seibun = seibun3)) as seibun3, kaisu3,
(select seibun from seibun where bango = a.bango and (ippanmei = seibun4 or seibun = seibun4)) as seibun4, kaisu4,
(select seibun from seibun where bango = a.bango and (ippanmei = seibun5 or seibun = seibun5)) as seibun5, kaisu5
from (select * from m_kihon where bango = '$rno') as a left join m_tekiyo using(bango) where sakumotsu = '$cropname'
SQL2;
$res = $db->query($sql);
if (!$res) sqlerror($sql, $db);
$times = $res->fetchAll(PDO::FETCH_ASSOC);
dbCloseStatement($res);
if (!count($times)) error('検索エラー', '成分毎の使用回数を取得できません');
$sql = "select tsusho from m_kihon where bango = $rno;"; 
$res = $db->query($sql);
$tsusho = $res->fetchColumn();
dbCloseStatement($res);
foreach($times as &$time) {
  for($i = 1; $i <= 5; $i++) {
    $seibun = $time["seibun$i"];
    if (!$seibun) break;
    $sql = "select distinct tsusho from (select * from m_kihon where tsusho <> '$tsusho') left join tsushoruby using(tsusho) where bango in (select bango from seibun left join m_tekiyo using(bango) where seibun = '$seibun' and sakumotsu ='$cropname') order by ruby;";
    $res = $db->query($sql);
    $time["others$i"] = implode(', ', $res->fetchAll(PDO::FETCH_COLUMN, 0));
    dbCloseStatement($res);
  }
}
unset($time);

$sql = <<<SQL3
select distinct concat(',', replace(byochu, '-', '')) as byochu, concat(',', replace(mokuteki, '-', '')) as mokuteki, kaisu, jiki, baisu,
case when baisu like '%倍' then '倍数' else '量' end as unit, replace(ekiryo, '-', '') as ekiryo, hoho,
concat(' ', replace(basho, '-', ''), replace(dojo, '-', ''), replace(chitai, '-', ''), replace(tekiyaku, '-', ''), replace(jikan, '-', ''), replace(ondo, '-', '')) as etc
from (select * from m_kihon where bango = '$rno') left join m_tekiyo using(bango) where sakumotsu = '$cropname'
group by kaisu, jiki, baisu, ekiryo, hoho order by hoho, ekiryo
SQL3;
$res = $db->query($sql);
if (!$res) sqlerror($sql, $db);
$apps = $res->fetchAll(PDO::FETCH_ASSOC);
dbCloseStatement($res);
//if (!count($apps)) error('検索エラー', '適用情報を取得できません');

$sql = "select idsaku from m_sakumotsu where sakumotsu = '$cropname'";
$res = $db->query($sql);
if (!$res) sqlerror($sql, $db);
$cid = $res->fetchColumn(0);
dbCloseStatement($res);
$ccid = substr($cid, 0, 2);
if ("{$ccid}0000000000" == substr($cid, 0, 12)) {
  $cname = '作物';
  $sql = "select distinct sakumotsu from m_tekiyo left join m_sakumotsu using(sakumotsu) where bango = '$rno' order by ruby;";
} else {
  $sql = "select sakumotsu from m_sakumotsu where idsaku = '{$ccid}00000000000000';";
  $res = $db->query($sql);
  if (!$res) sqlerror($sql, $db);
  $cname = $res->fetchColumn(0);
  dbCloseStatement($res);
  $sql = "select distinct sakumotsu from m_tekiyo left join m_sakumotsu using(sakumotsu) where idsaku like '$ccid%' and bango = '$rno' order by ruby;";
}
$res = $db->query($sql);
if (!$res) sqlerror($sql, $db);
$crops = implode(', ', $res->fetchAll(PDO::FETCH_COLUMN, 0));
dbCloseStatement($res);
$sql = "select distinct byochu from m_tekiyo left join m_byochu using(byochu) where bango = '$rno' order by betsumei;";
$res = $db->query($sql);
if (!$res) sqlerror($sql, $db);
$pests = implode(', ', $res->fetchAll(PDO::FETCH_COLUMN, 0));
dbCloseStatement($res);
dbClose($db);

$template->assign('title', "$rno ".htmlspecialchars($fullname));
$template->assign('cropname', $cropname);
$template->assign('bases', $bases);
$template->assign('count', count($times));
$template->assign('times', $times);
$template->assign('apps', $apps);
$template->assign('cname', $cname);
$template->assign('crops', $crops);
$template->assign('pests', $pests);
$template->display($mode.$func.$tplext);
?>
