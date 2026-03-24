<?php
require_once './inc.setup.php';

$toppage = array('url' => TopPage, 'title' => '検索語入力');
$modes = array(
  'chem' => array('title' => '薬剤名等', 'abbr' => '薬剤', 'valid' => 1),
  'crop' => array('title' => '作物名', 'abbr' => '作物', 'valid' => 1),
  'pest' => array('title' => '病害虫名等', 'abbr' => '病虫', 'valid' => 1)
);
$titles = array(
  'chem' => array('1' => '農薬通称選択', '2' => '薬剤作物選択', '3' => '登録情報'),
  'crop' => array('1' => '対象作物選択', '2' => '対象病害虫選択', '3' => '農薬通称選択', '4' => '登録情報'),
  'pest' => array('1' => '対象病害虫選択', '2' => '対象作物選択', '3' => '農薬通称選択', '4' => '登録情報')
);
$rac = array('iso' => 'ISO名: ', 'keito1' => '系統: ', 'mid' => 'RACコード: ', 'keito' => 'RAC系統: ', 'sayoten' => '作用点: ', 'sayokiko' => '作用機構: ', 'fgroup' => '', 'risk' => 'FRAC耐性リスク: ');

function error($title, $msg) {
  global $template;
  $template->assign('title', $title);
  $template->assign('errormsg', $msg);
  $template->display('error.html');
  exit;
}

function sqlerror($sql, &$db) {
  $err = $db->errorInfo();
  if ($db) dbClose($db);
  $sql = str_replace(array("\n", "\t"), ' ', $sql);
  error('SQLエラー', "$sql<br />$err[2]");
}

function ismobile() {
  $pat = '(^KDDI|^Vodafone|^MOT-|^SoftBank|^[SV]emulator)|'                      // XML Moblie = 1
       . '(^DoCoMo/1\.0|^UP\.Browser|^J-PHONE|J-EMULATOR|^ASTEL|^PDXGW|^L-mode)' // cHTML = 2 (include WML)
       . '|(^DoCoMo/2\.0)';                                                      // i-mode browser 2.0 = 3
  $ret = 0; // 上記以外 = 0
  if (preg_match("'$pat'", $_SERVER['HTTP_USER_AGENT'], $matches)) {
    for($ret = 1; $ret < count($matches); $ret++) {
      if ($matches[$ret]) break;
    }
    if ($ret == 3) {
      if (preg_match('/c500/', $_SERVER['HTTP_USER_AGENT'])) { $ret = 1; } else { $ret = 2; }
    }
  }
  return $ret;
}

// Original function was written by dozen
function roman2kana($translation, $chem = 0){
  $roman1 = array(
    'BB','CC','DD','FF','GG','HH','JJ','KK','LL','MM','PP','QQ','RR','SS','TT','VV','WW','XX','YY','ZZ',
    'KA','KI','KU','KE','KO',
    'GA','GI','GU','GE','GO',
    'KYA','KYI','KYU','KYE','KYO',
    'GYA','GYI','GYU','GYE','GYO',
    'SHA','SHI','SHU','SHE','SHO',
    'TSU','SA','SHI','SU','SE','SO',
    'ZA','ZI','ZU','ZE','ZO',
    'SYA','SYI','SYU','SYE','SYO',
    'JA','JI','JU','JE','JO',
    'ZYA','ZYI','ZYU','ZYE','ZYO',
    'XTU','LTU','TA','TI','TU','TE','TO',
    'DYA','DYI','DYU','DYE','DYO',
    'DHA','DHI','DHU','DHE','DHO',
    'DA','DI','DU','DE','DO',
    'CHA','CHI','CHU','CHE','CHO',
    'TYA','TYI','TYU','TYE','TYO',
    'NA','NI','NU','NE','NO',
    'NYA','NYI','NYU','NYE','NYO',
    'THA','THI','THU','THE','THO',
    'HA','HI','HU','HE','HO',
    'BA','BI','BU','BE','BO',
    'HYA','HYI','HYU','HYE','HYO',
    'BYA','BYI','BYU','BYE','BYO',
    'PA','PI','PU','PE','PO',
    'PYA','PYI','PYU','PYE','PYO',
    'MA','MI','MU','ME','MO',
    'MYA','MYI','MYU','MYE','MYO',
    'RYA','RYI','RYU','RYE','RYO',
    'YA','YI','YU','YE','YO',
    'RA','RI','RU','RE','RO',
    'WA','WI','WU','WE','WO',
    'SI','TI','TU',
    'XA','XI','XU','XE','XO',
    'LA','LI','LU','LE','LO',
    'VA','VI','VU','VE','VO',
    'FA','FI','FU','FE','FO',
    'NN','N','-'
  );
  $roman2 = array('A','I','U','E','O');
  $kana1 = array(
    'っB','っC','っD','っF','っG','っH','っJ','っK','っL','っM','っP','っQ','っR','っS','っT','っV','っW','っX','っY','っZ',
    'か','き','く','け','こ',
    'が','ぎ','ぐ','げ','ご',
    'きゃ','きぃ','きゅ','きぇ','きょ',
    'ぎゃ','ぎぃ','ぎゅ','ぎぇ','ぎょ',
    'しゃ','し','しゅ','しぇ','しょ',
    'つ','さ','し','す','せ','そ',
    'ざ','じ','ず','ぜ','ぞ',
    'しゃ','しぃ','しゅ','しぇ','しょ',
    'じゃ','じ','じゅ','じぇ','じょ',
    'じゃ','じぃ','じゅ','じぇ','じょ',
    'っ','っ','た','ち','つ','て','と',
    'ぢゃ','ぢぃ','ぢゅ','ぢぇ','ぢょ',
    'でゃ','でぃ','でゅ','でぇ','でょ',
    'だ','ぢ','づ','で','ど',
    'ちゃ','ち','ちゅ','ちぇ','ちょ',
    'ちゃ','ちぃ','ちゅ','ちぇ','ちょ',
    'な','に','ぬ','ね','の',
    'にゃ','にぃ','にゅ','にぇ','にょ',
    'てゃ','てぃ','てゅ','てぇ','てょ',
    'は','ひ','ふ','へ','ほ',
    'ば','び','ぶ','べ','ぼ',
    'ひゃ','ひぃ','ひゅ','ひぇ','ひょ',
    'びゃ','びぃ','びゅ','びぇ','びょ',
    'ぱ','ぴ','ぷ','ぺ','ぽ',
    'ぴゃ','ぴぃ','ぴゅ','ぴぇ','ぴょ',
    'ま','み','む','め','も',
    'みゃ','みぃ','みゅ','みぇ','みょ',
    'りゃ','りぃ','りゅ','りぇ','りょ',
    'や','い','ゆ','いぇ','よ',
    'ら','り','る','れ','ろ',
    'わ','うぃ','う','うぇ','を',
    'し','ち','つ',
    'ぁ','ぃ','ぅ','ぇ','ぉ',
    'ぁ','ぃ','ぅ','ぇ','ぉ',
    'ヴぁ','ヴぃ','ヴ','ヴぇ','ヴぉ',
    'ふぁ','ふぃ','ふ','ふぇ','ふぉ',
    'ん','ん','−'
  );
  $kana2 = array('あ','い','う','え','お');
  $res = str_ireplace($roman1, $kana1, $translation);
  if (!$chem) return str_ireplace($roman2, $kana2, $res);
  $res = preg_replace('/(?<![:cq])a(?![^aeiouん−])/i', 'あ', $res);
  $res = preg_replace('/(?<![:cq])e(?![^aeiouん−])/i', 'え', $res);
  $res = preg_replace('/(?<![:cq])i(?![^aeiouん−])/i', 'い', $res);
  $res = preg_replace('/(?<![:cq])o(?![^aeiouん−])/i', 'お', $res);
  $res = preg_replace('/(?<![:cq])u(?![^aeiouん−])/i', 'う', $res);
  return $res;
}

mb_internal_encoding('utf8');
mb_http_output('pass');
//$mobile = ismobile();
//$method = ($mobile == 2 || _debug_) ? 'get' : 'post';
$method = 'get'; //ブラウザの戻るボタン対応のため、常に GET メソッド使用
if (defined('SessionPath')) {
  if (!file_exists(SessionPath)) mkdir(SessionPath, 0705);
  ini_set('session.save_path', SessionPath);
}
//ini_set('session.use_only_cookies', ($mobile || _debug_) ? 0 : 1);
//ini_set('session.use_cookies', ($mobile || _debug_) ? 0 : 1);
ini_set('session.use_only_cookies', _debug_ ? 0 : 1);
ini_set('session.use_cookies', _debug_ ? 0 : 1);
ini_set('session.use_trans_sid', 1);

session_name('sid');
if ($_GET['sid']) session_id($_GET['sid']);
session_start();
$mode = $_REQUEST['mode'];
if (!$mode) {
  $mode = $_SESSION['mode'];
  if (!$mode) $mode = 'crop';
}
$_SESSION['mode'] = $mode;
if ($mode == 'crop') {
  if (!isset($_SESSION[$mode]['pcid'])) $_SESSION[$mode]['pcid'] = 1;
}
?>
