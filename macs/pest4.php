<?php
// 病害虫モード/適用表示

$tno = $_REQUEST['tno'];
$_SESSION[$mode]['tno'] = $tno;

$chems = unserialize($_SESSION[$mode]['chems']);

//$pest = $_SESSION[$mode]['pest'];
$pcid = substr($_SESSION[$mode]['pid'], 0, 1);
$cond = $_SESSION[$mode]['cropsql'];
$tsusho = $chems[$tno]['tsusho'];

$db = dbOpen();
$sql = <<<SQL1
select shurui, zaikei, yoto, koka, ifnullstr(dokusei, '不明') as toxic,
concat(',', bango||' '||meisho) as seihin,
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
from (select * from m_kihon where tsusho = '$tsusho') as a left join seizai using(bango) left join m_tekiyo using(bango)
where concat('#', byochu, mokuteki) regexp '(^|#)($pest)' and sakumotsu in ($cond)
group by toxic, comp1, comp2, comp3, comp4, comp5
SQL1;
$res = $db->query($sql);
if (!$res) sqlerror($sql, $db);
$bases = $res->fetchAll(PDO::FETCH_ASSOC);
dbCloseStatement($res);
if (!count($bases)) error('検索エラー', '剤の概要を取得できません');

$sql = <<<SQL2
select sakumotsu, concat(',', bango||' '||meisho) as seihin,
(select seibun from seibun where bango = a.bango and (ippanmei = seibun1 or seibun = seibun1)) as seibun1, kaisu1,
(select seibun from seibun where bango = a.bango and (ippanmei = seibun2 or seibun = seibun2)) as seibun2, kaisu2,
(select seibun from seibun where bango = a.bango and (ippanmei = seibun3 or seibun = seibun3)) as seibun3, kaisu3,
(select seibun from seibun where bango = a.bango and (ippanmei = seibun4 or seibun = seibun4)) as seibun4, kaisu4,
(select seibun from seibun where bango = a.bango and (ippanmei = seibun5 or seibun = seibun5)) as seibun5, kaisu5
from m_tekiyo as a left join m_kihon using(bango)
where tsusho = '$tsusho' and sakumotsu in ($cond)
group by kaisu1, kaisu2, kaisu3, kaisu4, kaisu5
SQL2;
$res = $db->query($sql);
if (!$res) sqlerror($sql, $db);
$times = $res->fetchAll(PDO::FETCH_ASSOC);
dbCloseStatement($res);
if (!count($times)) error('検索エラー', '成分毎の使用回数を取得できません');
foreach($times as &$time) {
  for($i = 1; $i <= 5; $i++) {
    $seibun = $time["seibun$i"];
    if (!$seibun) break; 
    $sql = "select distinct tsusho from (select * from m_kihon where tsusho <> '$tsusho') left join tsushoruby using(tsusho) where bango in (select bango from seibun left join m_tekiyo using(bango) where seibun = '$seibun' and sakumotsu in ($cond)) order by ruby;";
    $res = $db->query($sql);
    $time["others$i"] = implode(', ', $res->fetchAll(PDO::FETCH_COLUMN, 0));
    dbCloseStatement($res);
  }
}
unset($time);

$sql = <<<SQL3
select distinct sakumotsu, concat(', ', byochu) as byochu, concat(', ', mokuteki) as mokuteki, kaisu, jiki, baisu,
case when baisu like '%倍' then '倍数' else '量' end as unit, replace(ekiryo, '-', '') as ekiryo, hoho,
concat(' ', replace(basho, '-', ''), replace(dojo, '-', ''), replace(chitai, '-', ''), replace(tekiyaku, '-', ''), replace(jikan, '-', ''), replace(ondo, '-', '')) as etc
from m_tekiyo left join m_kihon using(bango)
where tsusho = '$tsusho' and sakumotsu in ($cond)
group by kaisu, jiki, baisu, ekiryo, hoho
SQL3;
$res = $db->query($sql);
if (!$res) sqlerror($sql, $db);
$apps = $res->fetchAll(PDO::FETCH_ASSOC);
dbCloseStatement($res);
if (!count($apps)) error('検索エラー', '適用情報を取得できません');

$sql = "select idsaku from m_sakumotsu where sakumotsu = '{$apps[0]['sakumotsu']}'";
$res = $db->query($sql);
if (!$res) sqlerror($sql, $db);
$cid = $res->fetchColumn(0);
dbCloseStatement($res);
//$ccid = substr($_SESSION[$mode]['cid'], 0, 2);
$ccid = substr($cid, 0, 2);
if ("{$ccid}0000000000" == substr($cid, 0, 12)) {
  $cname = '作物';
  $sql = "select distinct sakumotsu from m_tekiyo left join m_sakumotsu using(sakumotsu) where bango in (select bango from m_kihon where tsusho = '$tsusho') order by ruby;";
} else {
  $sql = "select sakumotsu from m_sakumotsu where idsaku = '{$ccid}00000000000000';";
  $res = $db->query($sql);
  if (!$res) sqlerror($sql, $db);
  $cname = $res->fetchColumn(0);
  dbCloseStatement($res);
  $sql = "select distinct sakumotsu from m_tekiyo left join m_sakumotsu using(sakumotsu) where idsaku like '$ccid%' and bango in (select bango from m_kihon where tsusho = '$tsusho') order by ruby;";
}

$res = $db->query($sql);
if (!$res) sqlerror($sql, $db);
$crops = implode(', ', $res->fetchAll(PDO::FETCH_COLUMN, 0));
dbCloseStatement($res);
$sql = "select distinct byochu from m_tekiyo left join m_byochu using(byochu) where byochu is not null and bango in (select bango from m_kihon where tsusho = '$tsusho') order by betsumei;";
$res = $db->query($sql);
if (!$res) sqlerror($sql, $db);
$pests = implode(', ', $res->fetchAll(PDO::FETCH_COLUMN, 0));
dbCloseStatement($res);
$sql = "select distinct mokuteki from m_tekiyo left join m_byochu as b on mokuteki = b.byochu where mokuteki is not null and bango in (select bango from m_kihon where tsusho = '$tsusho') order by betsumei;";
$res = $db->query($sql);
if (!$res) sqlerror($sql, $db);
$aims = implode(', ', $res->fetchAll(PDO::FETCH_COLUMN, 0));
dbCloseStatement($res);
dbClose($db);

$template->assign('pest', $pest);
$template->assign('title', htmlspecialchars($tsusho));
$template->assign('bases', $bases);
$template->assign('count1', count($bases));
$template->assign('times', $times);
$template->assign('count2', count($times));
$template->assign('apps', $apps);
//$template->assign('others', $others);
//$template->assign('count3', count($others));
$template->assign('cname', $cname);
$template->assign('crops', $crops);
$template->assign('pests', $pests);
$template->assign('aims', $aims);
$template->display($mode.$func.$tplext);
?>
