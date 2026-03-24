<?php
/* 農薬絞り込みフィルター */

$filters1[] = array('name' => 'すべて', 'filter' => "");
$filters1[] = array('name' => '収穫前日までのみ', 'filter' => "jiki like '%収穫前日%'");
$filters1[] = array('name' => '生育期施用', 'filter' => "jiki regexp '(?<!非)収穫(?!(直|終了)?後)|(?<!雑草)生育'");
$filters1[] = array('name' => '定植時まで', 'filter' => "jiki regexp 'は種|播種|(定植|植付|移植)(?!後)|育苗'");
$filters1[] = array('name' => '育苗箱施用', 'filter' => "hoho like '%育苗箱%'");
$filters1[] = array('name' => '畦畔散布/投込/水口', 'filter' => "hoho regexp '投げ|周縁|水口'");
$filters1[] = array('name' => '無人航空機', 'filter' => "hoho like '%無人%'");
$filters1[] = array('name' => '空中散布', 'filter' => "hoho like '%空中散布%'");
$filters1[] = array('name' => 'くん煙', 'filter' => "hoho like '%くん煙%'");
$filters1[] = array('name' => '常温煙霧', 'filter' => "hoho like '%常温煙霧%'");
$filters1[] = array('name' => '土壌消毒', 'filter' => "hoho like '%土%' and (koka like '%土壌%' or koka like '%線虫%')");
$filters1[] = array('name' => '粒剤/豆つぶ', 'filter' => "(zaikei = '粒剤' or meisho like '%豆つぶ%' or (zaikei = 'その他' and meisho like '%G'))");
$filters1[] = array('name' => '水/乳/液/溶/MC剤', 'filter' => "zaikei in ('水和剤', '乳剤', '液剤', '水溶剤', 'マイクロカプセル剤')");
$filters1[] = array('name' => '農薬肥料', 'filter' => "zaikei = '農薬肥料'");

/*
$filters2[] = array('name' => 'すべて', 'filter' => "");
$filters2[] = array('name' => '北海道', 'filter' => "byochu like '%北海道%' and byochu not regexp '北海道(、.*)?を除く'");
$filters2[] = array('name' => '東北', 'filter' => "byochu like '%東北%' and byochu not regexp '東北(、.*)?を除く'");
$filters2[] = array('name' => '北陸', 'filter' => "byochu like '%北陸%' and byochu not regexp '北陸(、.*)?を除く'");
$filters2[] = array('name' => '関東', 'filter' => "byochu like '%関東%' and byochu not regexp '関東(、.*)?を除く'");
$filters2[] = array('name' => '東山', 'filter' => "byochu like '%東山%' and byochu not regexp '東山(、.*)?を除く'");
$filters2[] = array('name' => '東海', 'filter' => "byochu like '%東海%' and byochu not regexp '東海(、.*)?を除く'");
$filters2[] = array('name' => '近畿', 'filter' => "byochu like '%近畿%' and byochu not regexp '近畿(、.*)?を除く'");
$filters2[] = array('name' => '中国', 'filter' => "byochu like '%中国%' and byochu not regexp '中国(、.*)?を除く'");
$filters2[] = array('name' => '四国', 'filter' => "byochu like '%四国%' and byochu not regexp '四国(、.*)?を除く'");
$filters2[] = array('name' => '九州', 'filter' => "byochu like '%九州%' and byochu not regexp '九州(、.*)?を除く'");
*/
?>
