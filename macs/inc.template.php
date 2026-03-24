<?php
require_once './inc.setup.php';
require_once './inc.common.php';
set_include_path(get_include_path().PATH_SEPARATOR.SmartyPath);
//set_include_path(get_include_path().PATH_SEPARATOR.Smarty5Path);
require_once 'Smarty.class.php';

function msie() {
  $ver = preg_replace('/.*MSIE\s([0-9]+).*/', '\1', $_SERVER['HTTP_USER_AGENT'], 1, $count); /* < IE11 */
  if (!$count)  $ver = preg_replace('/.*Trident.*?rv:\s?([0-9]+).*/', '\1', $_SERVER['HTTP_USER_AGENT'], 1, $count); /* = IE11 */
  return $count ? $ver : 0;
}

$tplext = '.html';

$template = new Smarty();

// テンプレート関連ディレクトリ設定
$dir = TmpPath.'/templates_c';
if (!is_dir($dir)) mkdir($dir, 0755);
$template->compile_dir = $dir;
$dir = TmpPath.'/configs';
if (!is_dir($dir)) mkdir($dir, 0755);
$template->config_dir = $dir;
$dir = TmpPath.'/cache';
if (!is_dir($dir)) mkdir($dir, 0755);
$template->cache_dir = $dir;
$template->template_dir = TemplatePath;

// php 関数の Smarty への登録
$template->registerPlugin("modifier", "substr", "substr");
// フィルタの登録
//$template->plugins_dir[] = TemplatePath.'/plugins';
//$template->autoload_filters = array('output' => array('lfcorrect'), 'insert' => array('header'));

$scale = $_COOKIE['scale'];
$navipos = $_COOKIE['navipos'];

$template->assign('toppage', $toppage);
$template->assign('titles', $titles);
$template->assign('modes', $modes);
$template->assign('mode', $_SESSION['mode']);
$template->assign('home', $home);
//$template->assign('mobile', $mobile);
$template->assign('scale', $scale);
$template->assign('navipos', $navipos);
$template->assign('method', $method);
$template->assign('msie', msie());
?>
