<?php
// 作物モード/薬剤通称選択選択

if (isset($_REQUEST['pno'])) {
  $pno = $_REQUEST['pno'];
  $fno = $_REQUEST['fno'];
  $pgrp = isset($_REQUEST['pgrp']);
} else {
  $pno = $_SESSION[$mode]['pno'];
  $fno = $_SESSION[$mode]['fno'];
  $pgrp = $_SESSION[$mode]['pgrp'];
}
$crops = unserialize($_SESSION[$mode]['crops']);
$pests = unserialize($_SESSION[$mode]['pests']);
$chems = unserialize($_SESSION[$mode]['chems']);
$filts = unserialize($_SESSION[$mode]['filts']);
$cno = $_SESSION[$mode]['cno'];
$cond = $_SESSION[$mode]['cond'];
$pid = $pests[$pno]['idpest'];
$_SESSION[$mode]['pno'] = $pno;

if ($pid != $_SESSION[$mode]['pid'] || $fno != $_SESSION[$mode]['fno'] || $pgrp != $_SESSION[$mode]['pgrp']) {
  $_SESSION[$mode]['pgrp'] = $pgrp;
  $_SESSION[$mode]['pid'] = $pid;
  $_SESSION[$mode]['fno'] = $fno;
  $cond = $_SESSION[$mode]['cond'];
  $pest = $pests[$pno]['byochu'];
  if ($pgrp) {
    $pcid = substr($pid, 0, 4);
    if ($pid == $pcid.'0100') {
      if (preg_match('/類$/', $pest)) {
        foreach ($pests as $item) {
          if (strpos($item['idpest'], $pcid) === 0) $pest = _concat('|', $pest, $item['byochu']);
        }
      }
    } else {
      foreach ($pests as $item) {
        if ($item['idpest'] == $pcid.'0100' && preg_match('/類$/', $item['byochu'])) $pest .= '|'.$item['byochu'];
      }
    }
  }
  $_SESSION[$mode]['pest'] = $pest;
  $pest = str_replace('\\|', '|', preg_quote($pest));
  $db = dbOpen();
  $sql = "select tsusho,replace(jiki,'まで','') as jiki,concat(',',concat('/',re_replace('\[.+?\]',keito,''),mid)) as rac from m_tekiyo left join m_kihon using(bango) left join seibun using(bango) left join rac using(ippanmei) where sakumotsu in ($cond) and concat('#', byochu, mokuteki) regexp '(^|#)($pest)' ";
  if ($fno) $sql .= "and {$filts[$fno]['filter']} ";
  $sql .= "group by tsusho order by tsusho";
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
$template->assign('title', "{$crops[$cno]['sakumotsu']}/{$pests[$pno]['byochu']}");
$template->assign('chems', $chems);
$template->assign('count', count($chems));
$template->display($mode.$func.$tplext);
