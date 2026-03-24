<?php
// 携帯農薬検索システムトップページ

require_once './inc.setup.php';
require_once './inc.common.php';
require_once './inc.sqlite.php';
require_once './inc.template.php';

$func = $_REQUEST['func'];
if ($func) {
  $template->assign('func', $func);
  require_once "./{$mode}{$func}.php";
  exit;
}

$db = dbOpen();
$sql = "select value from info where item = 'LastUpdate'";
$res = $db->query($sql);
if (!$res) sqlerror($sql, $db);
$dbdate = $res->fetchColumn(0);
dbCloseStatement($res);
dbClose($db);

require_once './inc.version.php';
$template->assign('version', $version);
if (msie()) error('ブラウザエラー', 'Microsoft Internet Explorer では使用できません。</p><p>Microsoft Edge や Google Chrome などのモダンブラウザをご使用ください。');

$template->assign('title', strpos($dbdate, '失効') ? $dbdate : str_replace('反映', '', $dbdate));
$template->assign('func', 0);
$template->display('index.html');
?>
