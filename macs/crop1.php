<?php
// 対象作物選択

function conv_sakumotsu($str) {
  switch ($str) {
    case 'かんしよ': return 'かんしよ(?!う)';
    case 'とまと': return '(?<!に)とまと';
    case 'わさひ': return 'わさひ(?!た|な)';
    case 'たかな': return '(?<!き|こ|ち|持|茎)たかな';
    case 'みすな': return '(?<!ま|し|り|い|ち)みすな';
    case 'なはな': return '(?<!た|潟)なはな(?!て|的)';
    case 'わけき': return '(?<!ん)わけき';
    case 'れたす': return '(?<!ゆ|む)れたす';
    case 'とうき': return 'とうき(?!ち|ひ)';
    case 'おうき': return '(?<!ひ)おうき(?!よ)';
    case 'うこん': return '(?<!ゆ|お)うこん';
    case 'ほりし': return 'ほりし(?!や)';
    case 'はつか': return '(?<!ま|な)はつか(?!た)';
    case 'みかん': return '(?<!つ|に|紅)みかん';
    case 'すたち': return 'すたち(?!す|う)';
    case 'ふとう': return '(?<!ら)ふとう';
    case 'りんこ': return 'りんこ(?!ま)';
    case 'はるか': return 'はるか(?!ん)';
    case 'らいむ': return 'らいむ(?!き)';
    case 'れもん': return 'れもん(?!は|く|た|か|そ)';
    case 'さくろ': return '(?<!ん)さくろ';
    case 'れいし': return '(?<!る|ん|は)れいし';
    case 'あさみ': return '(?<!う|ま|り|わ|ん)あさみ(?!な)';
    case 'あんす': return 'あんす(?!り)';
    case 'たりあ': return '(?<!い)たりあ';
    case 'はんた': return 'はんた(?!ま)';
    case 'ほたん': return '(?<!の|は)ほたん(?!ほ)';
    case 'さくら': return '(?<!つ|は|い)さくら(?!そ|ん|す)';
    case 'さかき': return '(?<!ひ)さかき';
    case 'かんは': return 'かんは(?!に)';
    case 'やなき': return '(?<!き)やなき(?!た)';
    case 'そてつ': return '(?<!さ|わ)そてつ';
    case 'たはこ': return 'たはこ(?!か)';
    case 'いね': return '(?<!か)いね(?!か|科|こ|り)|すいとう|りくとう';
    case 'むき': return '(?<!と)むき';
    case 'きひ': return '(?<!う)きひ';
    case 'うめ': return '(?<!ゆ|よ)うめ(?!は|も)';
    case 'かき': return '(?<!さ|ひ)かき(?!る|ひ|な|ち|菜)';
    case 'くり': return '(?<!す|み|つ|よ)くり(?!さ|す|ん|ひ|ふ|つ)';
    case 'なし': return '(?<!る|ち|ね|は|い)なし';
    case 'もも': return '(?<!す|ま|い|ら|と)もも';
    case 'ゆす': return 'ゆす(?!き)';
    case 'うと': return '(?<!お|か|ふ|よ)うと(?!う|る)';
    case 'かふ': return '(?<!り|た|ね|や|た|田)かふ(?!た|き|れ|と|ち|さ)';
    case 'ける': return '(?<!つ)ける';
    case 'せり': return '(?<!は|う)せり(?!た|ふ)';
    case 'せし': return 'せし(?!ゆ|り)';
    case 'なす': return '(?<!た|な|ま|ひ|は)なす(?!な|た)';
    case 'ねき': return '(?<!ま|と|そ)ねき';
    case 'はす': return '(?<!か|お)はす(?!い|か|も)';
    case 'ふき': return '(?<!い|わ|か)ふき';
    case 'から': return '(?<!や|あ)から(?!す|し|ま|ひ|ん|は|く)';
    case 'きく': return '(?<!ん|あ|う|そ|き|ま|い)きく(?!い|ち|な|に|め)';
    case 'はら': return '(?<!す|や|え)はら(?!も|て)';
    case 'ゆり': return '(?<!ち)ゆり(?!の|お)';
    case 'らん': return '(?<!か|く|す|と|ま|ふ|ん|お|い|り)らん(?!た|と)';
    case 'かし': return '(?<!め|ら)かし(?!す|つ|ゆ|よ|ら|ろ|わ|ま|あ)';
    case 'きり': return '(?<!つ)きり(?!え|は|な|み)';
    case 'すき': return '(?<!あ|お|み|ゆ|ん)すき(?!も)';
    case 'つけ': return '(?<!け|ぬ|め|き)つけ(?!も)';
    case 'ふう': return '(?<!う|ん)ふう(?!と|き)';
    case 'ふな': return '(?<!み|か)ふな';
    case 'まき': return '(?<!た|へ|や|ん)まき(?!い|さ|ち|つ|な|ま|ろ|あ|く|\(|\))';
    case 'まつ': return '(?<!か|そ|と|ら|ろ)まつ(?!し|な|は|も|り)';
    case 'やし': return '(?<!ち|ひ|ら)やし';
    case 'しは': return '(?<!ろ|つ)しは(?!い|さ)';
    case 'ちや': return '(?<!ほ|ま|ん)ちや(?!い|ひ|と|な)';
    case 'こま': return '(?<!え|ん)こま(?!つ)';
    case 'にら': return '(?<!は)にら';
    case 'ほほ': return '(?<!ん)ほほ';
  }
  $str = str_replace('しかまき', 'ちよくは', $str);
  $str = str_replace('ちかまき', 'ちよくは', $str);
  $str = str_replace('おおつふ', 'たいりゆう', $str);
  $str = str_replace('こつふ', 'しようりゆう', $str);
  $str = str_replace('かつか', 'かくか', $str);
  $str = str_replace('ろち', 'ろし', $str);
  $str = str_replace('かきるい', 'はなきるい', $str);
  $str = preg_replace('/(?<!ら)たねなし|種無(し)?/', 'むかく', $str);
  $str = preg_replace('/たねあり|種有(り)?/', 'ゆうかく', $str);
  $str = str_replace('露地', 'ろし', $str);
  $str = str_replace('施設', 'しせつ', $str);
  $str = str_replace('水耕', 'すいこう', $str);
  $str = str_replace('栽培', 'さいはい', $str);
  $str = preg_replace('/([^\(]*)?\(?((?<!ひ)ろし|しせつ|すいこう)(さいはい)?\)?(.*)?/', '$2$1$4', $str);
//  $str = preg_replace('/([^\(]*)?\(?(露地|ろし|施設|しせつ|水耕|すいこう)(栽培|さいはい)?\)?(.*)?/', '$2$1$4', $str);
  $str = preg_replace('/(未|み)(成熟|せいしゆく)?(豆|まめ)(類|るい)?/', 'まめるい\(みせいしゆく\)', $str);
  $str = preg_replace('/(豆|まめ)(類|るい)?\(?(未|み)(成熟|せいしゆく)?\)?/', 'まめるい\(みせいしゆく\)', $str);
  return $str;
}

$kw = $_REQUEST['kw'];
if ($kw) {
  $kw = roman2kana(mb_convert_kana($kw, 'a'));
} else {
  $kw = $_SESSION[$mode]['kw'];
}

if (!$kw) error('検索語エラー', '検索語を入力してください');
$template->assign('kw', $kw);

if ($_SESSION[$mode]['pcats']) {
  $pcats = unserialize($_SESSION[$mode]['pcats']);
} else {
  $db = dbOpen();
//  $sql = "select cid, cname from cbyochu where cid <= 3 order by cid";
  $sql = "select cid, cname from cbyochu order by cid";
  $res = $db->query($sql);
  if (!$res) sqlerror($sql, $db);
  $pcats = $res->fetchAll(PDO::FETCH_ASSOC);
  array_unshift($pcats, array('cid' => 0, 'cname' => 'すべて'));
  dbCloseStatement($res);
  dbClose($db);
  $_SESSION[$mode]['pcats'] = serialize($pcats);
}

if ($kw == $_SESSION[$mode]['kw']) {
  $crops = unserialize($_SESSION[$mode]['crops']);
} else {
  $nkw = conv_sakumotsu(_strconv($kw));
  $db = dbOpen();
  $sql = "select substr(idsaku, 1, 2) as cat, class, idsaku, toroku, sakumotsu, ifnull(shukakubui, '-') as shukakubui, betsumei, gunmei from vs_sakumotsu2 where strconv(keywords) regexp '$nkw'";
  $res = $db->query($sql);
  if (!$res) sqlerror($sql, $db);
  $crops = $res->fetchAll(PDO::FETCH_ASSOC);
  dbCloseStatement($res);
  dbClose($db);
  if (!count($crops)) error('検索エラー', "'$kw' に該当する作物がありません");
  $_SESSION[$mode]['crops'] = serialize($crops);
  $_SESSION[$mode]['kw'] = $kw;
}

$min = 100;
foreach($crops as &$crop) {
  $len = mb_strlen($crop['sakumotsu']);
  if ($len < $min || _strconv($kw) == _strconv($crop['sakumotsu'])) {
    $min = $len;
    $def = $crop['idsaku'];
  }
}
if (!isset($_SESSION[$mode]['cgrp'])) $_SESSION[$mode]['cgrp'] = true;
$template->assign('title', "[{$_SESSION[$mode]['kw']}]");
$template->assign('cno', $_SESSION[$mode]['cno']);
$template->assign('cid', $_SESSION[$mode]['cid']);
$template->assign('cgrp', $_SESSION[$mode]['cgrp']);
$template->assign('pcno', $_SESSION[$mode]['pcno']);
$template->assign('pcid', $_SESSION[$mode]['pcid']);
$template->assign('crops', $crops);
$template->assign('count', count($crops));
$template->assign('def', $def);
$template->assign('pcats', $pcats);
$template->assign('ccat', array('01'=>'果', '02'=>'野', '03'=>'穀', '04'=>'茸', '05'=>'食', '11'=>'飼', '12'=>'薬', '21'=>'花', '22'=>'木', '23'=>'芝', '31'=>'工', '75'=>'帯', '91'=>'他'));
$template->assign('mark', array(1=>'&gt;', 2=>'&lt;'));
$template->display($mode.$func.$tplext);
?>
