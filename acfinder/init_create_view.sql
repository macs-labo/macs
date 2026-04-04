/*
  Agricultural Chemicals Information Database Browser
  acfinder 起動時相当　テンポラリテーブル、ビュー作成
*/
--// tSeibun  総使用回数における有効成分表示用
--// 2025.3.16  javascript sql.js用　修正
begin transaction;
drop table if exists tSeibun;
create temp table tSeibun as select distinct ippanmei, seibun, seibun as shoryaku, ippanmei as kanryaku from seibun where ippanmei != seibun;
update tSeibun set shoryaku = re_replace('.*及び([A-Z\-]+)(.*)', shoryaku, '($1)$2') where shoryaku regexp '及び[A-Z]+';
update tSeibun set shoryaku = re_replace('.*及び(.*?)([A-Z\-]+)', shoryaku, '$1($2)') where shoryaku regexp '及び.*?[A-Z]+';
update tSeibun set kanryaku = re_replace('^('||seibun||')(.*)', kanryaku, '$1($2)') where kanryaku like seibun||'%';
update tSeibun set kanryaku = re_replace('(.*?)('||seibun||')$', kanryaku, '($1)$2') where kanryaku like '%'||seibun;
update tSeibun set kanryaku = re_replace('(.+?)([A-Z\-]+.*)', kanryaku, '$1($2)') where seibun like '%及び%' and kanryaku regexp '.+[A-Z]+.*$';
update tSeibun set kanryaku = re_replace('([A-Z\-]+)(.*)', kanryaku, '($1)$2') where seibun like '%及び%' and kanryaku regexp '^[A-Z]+';
commit;
-- rac view 再作成
drop view if exists spec.rac;
create view spec.rac as
  select ippanmei, gd_concat(', ', keito) as keito, 
    gd_concat(', ', mid) as mid, 
    gd_concat(', ', sayoten) as sayoten, 
    gd_concat(', ', ifnullstr(sayokiko, '-')) as sayokiko, 
    gd_concat(', ', fgroup) as fgroup, 
    gd_concat(', ', risk) as risk from rac_ai
  left join rac_sg using(sid) 
  left join rac_mg using(mid) 
  group by ippanmei;
--//系統分類対応ビュー作成 2025.12.1 ojas 追加
BEGIN TRANSACTION;
DROP VIEW IF EXISTS kihon;
CREATE TEMP VIEW kihon AS
SELECT DISTINCT
  bango, shurui, meisho, tsusho, ryakusho, s.dokusei AS seizaidokusei, zaikei, k.yoto AS seizaiyoto,
  kongo, a.ippanmei AS ippanmei, a.seibun AS seibun, iso, nodo, d.dokusei AS dokusei, jogai, d.yoto AS yoto,
  concat_ws('・',
    (select koka from koka where koka.kokaid = b.kokaid & 3),
    (select koka from koka where koka.kokaid = b.kokaid & 4),
    (select koka from koka where koka.kokaid = b.kokaid & 8),
    (select koka from koka where koka.kokaid = b.kokaid & 16),
    (select koka from koka where koka.kokaid = b.kokaid & 32),
    (select koka from koka where koka.kokaid = b.kokaid & 64),
    (select koka from koka where koka.kokaid = b.kokaid & 128),
    (select koka from koka where koka.kokaid = b.kokaid & 256),
    (select koka from koka where koka.kokaid = b.kokaid & 512),
    (select koka from koka where koka.kokaid = b.kokaid & 1024),
    (select koka from koka where koka.kokaid = b.kokaid & 2048),
    (select koka from koka where koka.kokaid = b.kokaid & 4096),
    (select koka from koka where koka.kokaid = b.kokaid & 8192),
    (select koka from koka where koka.kokaid = b.kokaid & 16384),
    (select koka from koka where koka.kokaid = b.kokaid & 32768)
  ) AS koka,
  b.keito AS keito, mid AS mid, r.keito AS rackeito, sayoten, sayokiko, fgroup, risk, concat(o1.ojas, o2.ojas, o3.ojas) AS ojas
FROM seibun AS a
LEFT JOIN m_kihon AS k USING(bango)
LEFT JOIN seizai AS s USING(bango)
LEFT JOIN iso USING(ippanmei)
LEFT JOIN bunrui AS b ON a.ippanmei = b.seibun
LEFT JOIN dokusei AS d ON a.ippanmei = d.ippanmei OR a.seibun = d.ippanmei
LEFT JOIN rac AS r USING(ippanmei)
LEFT JOIN ojas_shurui AS o1 USING(shurui)
LEFT JOIN ojas_keito AS o2 USING(keito)
LEFT JOIN ojas_seibun AS o3 USING(seibun);
COMMIT;
--有機JAS使用可能、特別栽培無カウント成分を含む農薬のリスト 2025.12.1 追加
BEGIN TRANSACTION;
DROP TABLE IF EXISTS t_tokusai;
CREATE TEMP TABLE t_tokusai AS
SELECT bango, tsusho, kongo, count(ojas) AS cojas, max(if(tsusho = 'エコピタ液剤', '特栽(認証団体によって取扱いが異なる)', ojas)) AS ojas FROM kihon WHERE ojas != '' GROUP BY bango;
DELETE FROM t_tokusai WHERE kongo > cojas;
COMMIT;
--薬剤タブ　成分表示用ビュー作成 jppnet カラムはコメントアウト
/*
BEGIN TRANSACTION;
DROP VIEW IF EXISTS tvSeibun;
CREATE TEMP VIEW tvSeibun AS
  SELECT
      bango,
      ippanmei,
      seibun,
      keito,
      koka,
      --NULL AS JPP系統名,
      --NULL AS kagakumei,
      nodo,
      --NULL AS nodochu,
      seibunEikyo,
      IFNULLSTR(dokusei,'-') AS dokusei,
      jogai,
      --NULL AS jyogai1,
      --NULL AS jyogai2,
      biko
  FROM kihon as k
  LEFT JOIN dokusei AS d ON d.ippanmei = k.ippanmei OR seibunmei = k.ippanmei;
COMMIT;
*/
-- 作物タブ、一時テーブル、ビュー作成
BEGIN TRANSACTION; 
--作物タブ相当　一時テーブル作成
DROP TABLE IF EXISTS  ttTekiyoSaku;
DROP VIEW IF EXISTS  ttTekiyoSaku;
--CREATE TEMP TABLE ttTekiyoSaku AS 
CREATE TEMP VIEW ttTekiyoSaku AS 
  SELECT bango,shurui,meisho,tsusho,idsaku,sakumotsu,idbyochu,byochu,mokuteki,jiki,baisu,ekiryo,hoho,basho,
    jikan,ondo,dojo,chitai,tekiyaku,kongo,kaisu,
    seibun1,keito1,kaisu1,(select if(count(*) > 0, mid, (select max(mid) from raccode where ippanmei = seibun1 group by ippanmei)) from raccode where ippanmei = seibun1 and cid = substr(idbyochu, 1, 1)) as mid1, 
    seibun2,keito2,kaisu2,(select if(count(*) > 0, mid, (select max(mid) from raccode where ippanmei = seibun2 group by ippanmei)) from raccode where ippanmei = seibun2 and cid = substr(idbyochu, 1, 1)) as mid2, 
    seibun3,keito3,kaisu3,(select if(count(*) > 0, mid, (select max(mid) from raccode where ippanmei = seibun3 group by ippanmei)) from raccode where ippanmei = seibun3 and cid = substr(idbyochu, 1, 1)) as mid3, 
    seibun4,keito4,kaisu4,(select if(count(*) > 0, mid, (select max(mid) from raccode where ippanmei = seibun4 group by ippanmei)) from raccode where ippanmei = seibun4 and cid = substr(idbyochu, 1, 1)) as mid4, 
    seibun5,keito5,kaisu5,(select if(count(*) > 0, mid, (select max(mid) from raccode where ippanmei = seibun5 group by ippanmei)) from raccode where ippanmei = seibun5 and cid = substr(idbyochu, 1, 1)) as mid5, 
    dokusei as seizaidokusei,yoto,koka,zaikei,ryakusho
FROM tekiyo LEFT JOIN seizai using(bango);
-- 作物タブ用
-- 標準モード用 -----
--  1 成分に総会使用回数における有効成分表示(省略型)
DROP VIEW IF EXISTS tvTekiyoSaku1;
CREATE TEMP VIEW tvTekiyoSaku1 AS SELECT 
        bango, sakumotsu, byochu, mokuteki, shurui, meisho, jiki, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, kaisu, kongo, 
        --svSeibunSimple: //成分に有効成分＋総会使用回数における有効成分表示(簡略型)
        (ifnull((select kanryaku from tSeibun where ippanmei = seibun1),seibun1)) as seibun1, keito1, kaisu1, mid1, 
        (ifnull((select kanryaku from tSeibun where ippanmei = seibun2),seibun2)) as seibun2, keito2, kaisu2, mid2, 
        (ifnull((select kanryaku from tSeibun where ippanmei = seibun3),seibun3)) as seibun3, keito3, kaisu3, mid3, 
        (ifnull((select kanryaku from tSeibun where ippanmei = seibun4),seibun4)) as seibun4, keito4, kaisu4, mid4, 
        (ifnull((select kanryaku from tSeibun where ippanmei = seibun5),seibun5)) as seibun5, keito5, kaisu5, mid5, 
        seizaidokusei, yoto, koka, zaikei 
      FROM ttTekiyoSaku; 
--// 2 成分に総会使用回数における有効成分表示(正式型)
DROP VIEW IF EXISTS tvTekiyoSaku2;
CREATE TEMP VIEW tvTekiyoSaku2 AS SELECT 
        bango, sakumotsu, byochu, mokuteki, shurui, meisho, jiki, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, kaisu, kongo, 
        --svSeibun:       //成分に有効成分＋総会使用回数における有効成分表示(正式型)
        n_concat(' ', seibun1, '['||(select seibun from tSeibun where ippanmei = seibun1)||']') as seibun1, keito1, kaisu1, mid1, 
        n_concat(' ', seibun2, '['||(select seibun from tSeibun where ippanmei = seibun2)||']') as seibun2, keito2, kaisu2, mid2, 
        n_concat(' ', seibun3, '['||(select seibun from tSeibun where ippanmei = seibun3)||']') as seibun3, keito3, kaisu3, mid3, 
        n_concat(' ', seibun4, '['||(select seibun from tSeibun where ippanmei = seibun4)||']') as seibun4, keito4, kaisu4, mid4, 
        n_concat(' ', seibun5, '['||(select seibun from tSeibun where ippanmei = seibun5)||']') as seibun5, keito5, kaisu5, mid5, 
        seizaidokusei, yoto, koka, zaikei 
      FROM ttTekiyoSaku; 
--// 3 回数に総使用回数における有効成分表示(正式形)
DROP VIEW IF EXISTS tvTekiyoSaku3;
CREATE TEMP VIEW tvTekiyoSaku3 AS SELECT 
        bango, sakumotsu, byochu, mokuteki, shurui, meisho, jiki, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, kaisu, kongo, 
        -- svKaisu:        //回数に総使用回数における有効成分表示(正式形)
        seibun1, keito1, n_concat(': ', (select seibun from tSeibun where ippanmei = seibun1), kaisu1) as kaisu1, mid1, 
        seibun2, keito2, n_concat(': ', (select seibun from tSeibun where ippanmei = seibun2), kaisu2) as kaisu2, mid2, 
        seibun3, keito3, n_concat(': ', (select seibun from tSeibun where ippanmei = seibun3), kaisu3) as kaisu3, mid3, 
        seibun4, keito4, n_concat(': ', (select seibun from tSeibun where ippanmei = seibun4), kaisu4) as kaisu4, mid4, 
        seibun5, keito5, n_concat(': ', (select seibun from tSeibun where ippanmei = seibun5), kaisu5) as kaisu5, mid5, 
        seizaidokusei, yoto, koka, zaikei 
      FROM ttTekiyoSaku; 
--// 4 回数に総使用回数における有効成分表示(省略形)
DROP VIEW IF EXISTS tvTekiyoSaku4;
CREATE TEMP VIEW tvTekiyoSaku4 AS SELECT 
        bango, sakumotsu, byochu, mokuteki, shurui, meisho, jiki, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, kaisu, kongo, 
       --svKaisuSimple:  //回数に総使用回数における有効成分表示(省略形)
        seibun1, keito1, n_concat(': ', (select shoryaku from tSeibun where ippanmei = seibun1), kaisu1) as kaisu1, mid1, 
        seibun2, keito2, n_concat(': ', (select shoryaku from tSeibun where ippanmei = seibun2), kaisu2) as kaisu2, mid2, 
        seibun3, keito3, n_concat(': ', (select shoryaku from tSeibun where ippanmei = seibun3), kaisu3) as kaisu3, mid3, 
        seibun4, keito4, n_concat(': ', (select shoryaku from tSeibun where ippanmei = seibun4), kaisu4) as kaisu4, mid4, 
        seibun5, keito5, n_concat(': ', (select shoryaku from tSeibun where ippanmei = seibun5), kaisu5) as kaisu5, mid5, 
        seizaidokusei, yoto, koka, zaikei 
      FROM ttTekiyoSaku; 
--   // 5 従来型有効成分表示
DROP VIEW IF EXISTS tvTekiyoSaku5;
CREATE TEMP VIEW tvTekiyoSaku5 AS SELECT 
        bango, sakumotsu, byochu, mokuteki, shurui, meisho, jiki, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, kaisu, kongo, 
        --svStandard:     //標準
        seibun1, keito1, kaisu1, mid1, 
        seibun2, keito2, kaisu2, mid2, 
        seibun3, keito3, kaisu3, mid3, 
        seibun4, keito4, kaisu4, mid4, 
        seibun5, keito5, kaisu5, mid5, 
        seizaidokusei, yoto, koka, zaikei 
      FROM ttTekiyoSaku; 
--//------ 通称モード用 ------
--// 1
DROP VIEW IF EXISTS tvTsushoTekiyoSaku1; 
CREATE TEMP VIEW tvTsushoTekiyoSaku1 AS SELECT DISTINCT 
        sakumotsu, byochu, mokuteki, shurui, tsusho, jiki, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, kaisu, kongo, 
       --svSeibunSimple: //成分に有効成分＋総会使用回数における有効成分表示(簡略型)
        (ifnull((select kanryaku from tSeibun where ippanmei = seibun1),seibun1)) as seibun1, keito1, kaisu1, mid1, 
        (ifnull((select kanryaku from tSeibun where ippanmei = seibun2),seibun2)) as seibun2, keito2, kaisu2, mid2, 
        (ifnull((select kanryaku from tSeibun where ippanmei = seibun3),seibun3)) as seibun3, keito3, kaisu3, mid3, 
        (ifnull((select kanryaku from tSeibun where ippanmei = seibun4),seibun4)) as seibun4, keito4, kaisu4, mid4, 
        (ifnull((select kanryaku from tSeibun where ippanmei = seibun5),seibun5)) as seibun5, keito5, kaisu5, mid5, 
        seizaidokusei, yoto, koka, zaikei 
    FROM ttTekiyoSaku; 
      --// 2
DROP VIEW IF EXISTS tvTsushoTekiyoSaku2; 
CREATE TEMP VIEW tvTsushoTekiyoSaku2 AS SELECT DISTINCT 
        sakumotsu, byochu, mokuteki, shurui, tsusho, jiki, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, kaisu, kongo, 
       --svSeibun:       //成分に有効成分＋総会使用回数における有効成分表示(正式型)
        n_concat(' ', seibun1, '['||(select seibun from tSeibun where ippanmei = seibun1)||']') as seibun1, keito1, kaisu1, mid1, 
        n_concat(' ', seibun2, '['||(select seibun from tSeibun where ippanmei = seibun2)||']') as seibun2, keito2, kaisu2, mid2, 
        n_concat(' ', seibun3, '['||(select seibun from tSeibun where ippanmei = seibun3)||']') as seibun3, keito3, kaisu3, mid3, 
        n_concat(' ', seibun4, '['||(select seibun from tSeibun where ippanmei = seibun4)||']') as seibun4, keito4, kaisu4, mid4, 
        n_concat(' ', seibun5, '['||(select seibun from tSeibun where ippanmei = seibun5)||']') as seibun5, keito5, kaisu5, mid5, 
      seizaidokusei, yoto, koka, zaikei 
    FROM ttTekiyoSaku; 
--// 3
DROP VIEW IF EXISTS tvTsushoTekiyoSaku3; 
CREATE TEMP VIEW tvTsushoTekiyoSaku3 AS SELECT DISTINCT 
        sakumotsu, byochu, mokuteki, shurui, tsusho, jiki, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, kaisu, kongo, 
      -- svKaisu:        //回数に総使用回数における有効成分表示(正式形)
        seibun1, keito1, n_concat(': ', (select seibun from tSeibun where ippanmei = seibun1), kaisu1) as kaisu1, mid1, 
        seibun2, keito2, n_concat(': ', (select seibun from tSeibun where ippanmei = seibun2), kaisu2) as kaisu2, mid2, 
        seibun3, keito3, n_concat(': ', (select seibun from tSeibun where ippanmei = seibun3), kaisu3) as kaisu3, mid3, 
        seibun4, keito4, n_concat(': ', (select seibun from tSeibun where ippanmei = seibun4), kaisu4) as kaisu4, mid4, 
        seibun5, keito5, n_concat(': ', (select seibun from tSeibun where ippanmei = seibun5), kaisu5) as kaisu5, mid5, 
        seizaidokusei, yoto, koka, zaikei 
    FROM ttTekiyoSaku; 
--// 4
DROP VIEW IF EXISTS tvTsushoTekiyoSaku4; 
CREATE TEMP VIEW tvTsushoTekiyoSaku4 AS SELECT DISTINCT 
        sakumotsu, byochu, mokuteki, shurui, tsusho, jiki, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, kaisu, kongo, 
       --svKaisuSimple:  //回数に総使用回数における有効成分表示(省略形)
        seibun1, keito1, n_concat(': ', (select shoryaku from tSeibun where ippanmei = seibun1), kaisu1) as kaisu1, mid1, 
        seibun2, keito2, n_concat(': ', (select shoryaku from tSeibun where ippanmei = seibun2), kaisu2) as kaisu2, mid2, 
        seibun3, keito3, n_concat(': ', (select shoryaku from tSeibun where ippanmei = seibun3), kaisu3) as kaisu3, mid3, 
        seibun4, keito4, n_concat(': ', (select shoryaku from tSeibun where ippanmei = seibun4), kaisu4) as kaisu4, mid4, 
        seibun5, keito5, n_concat(': ', (select shoryaku from tSeibun where ippanmei = seibun5), kaisu5) as kaisu5, mid5, 
      seizaidokusei, yoto, koka, zaikei 
FROM ttTekiyoSaku; 
--// 5
DROP VIEW IF EXISTS tvTsushoTekiyoSaku5; 
CREATE TEMP VIEW tvTsushoTekiyoSaku5 AS SELECT DISTINCT 
      sakumotsu, byochu, mokuteki, shurui, tsusho, jiki, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, kaisu, kongo, 
       --svStandard:     //標準
        seibun1, keito1, kaisu1, mid1, 
        seibun2, keito2, kaisu2, mid2, 
        seibun3, keito3, kaisu3, mid3, 
        seibun4, keito4, kaisu4, mid4, 
        seibun5, keito5, kaisu5, mid5, 
        seizaidokusei, yoto, koka, zaikei 
    FROM ttTekiyoSaku; 
--// RAC Keito 表記用　temp view  180525
--// 作物タブ用
--// 標準モード用
--// 1 成分に総会使用回数における有効成分表示(省略型)
DROP VIEW IF EXISTS tvTekiyoRkSaku1; 
CREATE TEMP VIEW tvTekiyoRkSaku1 AS SELECT 
        bango, sakumotsu, byochu, mokuteki, shurui, meisho, jiki, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, kaisu, kongo, 
      --svSeibunSimple: //成分に有効成分＋総会使用回数における有効成分表示(簡略型)
        (ifnull((select kanryaku from tSeibun where ippanmei = seibun1),seibun1)) as seibun1,
          (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun1 group by ippanmei)) from rac2 where ippanmei = seibun1 and cid = substr(idbyochu, 1, 1)) as keito1, kaisu1, mid1, 
        (ifnull((select kanryaku from tSeibun where ippanmei = seibun2),seibun2)) as seibun2,
          (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun2 group by ippanmei)) from rac2 where ippanmei = seibun2 and cid = substr(idbyochu, 1, 1)) as keito2, kaisu2, mid2, 
        (ifnull((select kanryaku from tSeibun where ippanmei = seibun3),seibun3)) as seibun3,
          (select if(count(*) > 0, keito, (select max(keito) from rac2 where ippanmei = seibun3 group by ippanmei)) from rac2 where ippanmei = seibun3 and cid = substr(idbyochu, 1, 1)) as keito3, kaisu3, mid3, 
        (ifnull((select kanryaku from tSeibun where ippanmei = seibun4),seibun4)) as seibun4,
          (select if(count(*) > 0, keito, (select max(keito) from rac2 where ippanmei = seibun4 group by ippanmei)) from rac2 where ippanmei = seibun4 and cid = substr(idbyochu, 1, 1)) as keito4, kaisu4, mid4, 
        (ifnull((select kanryaku from tSeibun where ippanmei = seibun5),seibun5)) as seibun5,
          (select if(count(*) > 0, keito, (select max(keito) from rac2 where ippanmei = seibun5 group by ippanmei)) from rac2 where ippanmei = seibun5 and cid = substr(idbyochu, 1, 1)) as keito5, kaisu5, mid5, 
        
        seizaidokusei, yoto, koka, zaikei 
      FROM ttTekiyoSaku; 
--   // 2 成分に総会使用回数における有効成分表示(正式型)
DROP VIEW IF EXISTS tvTekiyoRkSaku2; 
CREATE TEMP VIEW tvTekiyoRkSaku2 AS SELECT 
        bango, sakumotsu, byochu, mokuteki, shurui, meisho, jiki, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, kaisu, kongo, 
     --svSeibun:       //成分に有効成分＋総会使用回数における有効成分表示(正式型)
        n_concat(' ', seibun1, '['||(select seibun from tSeibun where ippanmei = seibun1)||']') as seibun1,
          (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun1 group by ippanmei)) from rac2 where ippanmei = seibun1 and cid = substr(idbyochu, 1, 1)) as keito1, kaisu1, mid1, 
        n_concat(' ', seibun2, '['||(select seibun from tSeibun where ippanmei = seibun2)||']') as seibun2,
          (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun2 group by ippanmei)) from rac2 where ippanmei = seibun2 and cid = substr(idbyochu, 1, 1)) as keito2, kaisu2, mid2, 
        n_concat(' ', seibun3, '['||(select seibun from tSeibun where ippanmei = seibun3)||']') as seibun3,
          (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun3 group by ippanmei)) from rac2 where ippanmei = seibun3 and cid = substr(idbyochu, 1, 1)) as keito3, kaisu3, mid3, 
        n_concat(' ', seibun4, '['||(select seibun from tSeibun where ippanmei = seibun4)||']') as seibun4,
          (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun4 group by ippanmei)) from rac2 where ippanmei = seibun4 and cid = substr(idbyochu, 1, 1)) as keito4, kaisu4, mid4, 
        n_concat(' ', seibun5, '['||(select seibun from tSeibun where ippanmei = seibun5)||']') as seibun5,
          (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun5 group by ippanmei)) from rac2 where ippanmei = seibun5 and cid = substr(idbyochu, 1, 1)) as keito5, kaisu5, mid5, 
        seizaidokusei, yoto, koka, zaikei 
      FROM ttTekiyoSaku; 
--   // 3 回数に総使用回数における有効成分表示(正式形)
DROP VIEW IF EXISTS tvTekiyoRkSaku3; 
CREATE TEMP VIEW tvTekiyoRkSaku3 AS SELECT 
        bango, sakumotsu, byochu, mokuteki, shurui, meisho, jiki, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, kaisu, kongo, 
        --svKaisu:    --//回数に総使用回数における有効成分表示(正式形)
        seibun1,
          (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun1 group by ippanmei)) from rac2 where ippanmei = seibun1 and cid = substr(idbyochu, 1, 1)) as keito1,
          n_concat(': ', (select seibun from tSeibun where ippanmei = seibun1), kaisu1) as kaisu1, mid1, 
        seibun2,
            (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun2 group by ippanmei)) from rac2 where ippanmei = seibun2 and cid = substr(idbyochu, 1, 1)) as keito2,
            n_concat(': ', (select seibun from tSeibun where ippanmei = seibun2), kaisu2) as kaisu2, mid2, 
        seibun3,
            (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun3 group by ippanmei)) from rac2 where ippanmei = seibun3 and cid = substr(idbyochu, 1, 1)) as keito3,
            n_concat(': ', (select seibun from tSeibun where ippanmei = seibun3), kaisu3) as kaisu3, mid3, 
        seibun4,
            (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun4 group by ippanmei)) from rac2 where ippanmei = seibun4 and cid = substr(idbyochu, 1, 1)) as keito4,
            n_concat(': ', (select seibun from tSeibun where ippanmei = seibun4), kaisu4) as kaisu4, mid4, 
        seibun5,
            (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun5 group by ippanmei)) from rac2 where ippanmei = seibun5 and cid = substr(idbyochu, 1, 1)) as keito5,
            n_concat(': ', (select seibun from tSeibun where ippanmei = seibun5), kaisu5) as kaisu5, mid5, 
        seizaidokusei, yoto, koka, zaikei 
      FROM ttTekiyoSaku; 
--   // 4 回数に総使用回数における有効成分表示(省略形)
DROP VIEW IF EXISTS tvTekiyoRkSaku4; 
CREATE TEMP VIEW tvTekiyoRkSaku4 AS SELECT 
        bango, sakumotsu, byochu, mokuteki, shurui, meisho, jiki, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, kaisu, kongo, 
      --svKaisuSimple: //-- 回数に総使用回数における有効成分表示(省略形)
        seibun1,
            (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun1 group by ippanmei)) from rac2 where ippanmei = seibun1 and cid = substr(idbyochu, 1, 1)) as keito1,
            n_concat(': ', (select shoryaku from tSeibun where ippanmei = seibun1), kaisu1) as kaisu1, mid1, 
        seibun2,
            (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun2 group by ippanmei)) from rac2 where ippanmei = seibun2 and cid = substr(idbyochu, 1, 1)) as keito2,
            n_concat(': ', (select shoryaku from tSeibun where ippanmei = seibun2), kaisu2) as kaisu2, mid2, 
        seibun3,
            (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun3 group by ippanmei)) from rac2 where ippanmei = seibun3 and cid = substr(idbyochu, 1, 1)) as keito3,
            n_concat(': ', (select shoryaku from tSeibun where ippanmei = seibun3), kaisu3) as kaisu3, mid3, 
        seibun4,
            (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun4 group by ippanmei)) from rac2 where ippanmei = seibun4 and cid = substr(idbyochu, 1, 1)) as keito4,
            n_concat(': ', (select shoryaku from tSeibun where ippanmei = seibun4), kaisu4) as kaisu4, mid4, 
        seibun5,
            (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun5 group by ippanmei)) from rac2 where ippanmei = seibun5 and cid = substr(idbyochu, 1, 1)) as keito5,
            n_concat(': ', (select shoryaku from tSeibun where ippanmei = seibun5), kaisu5) as kaisu5, mid5, 
        seizaidokusei, yoto, koka, zaikei 
    FROM ttTekiyoSaku; 
-- // 5 従来型有効成分表示
DROP VIEW IF EXISTS tvTekiyoRkSaku5; 
CREATE TEMP VIEW tvTekiyoRkSaku5 AS SELECT 
        bango, sakumotsu, byochu, mokuteki, shurui, meisho, jiki, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, kaisu, kongo, 
      --svStandard: //-- 標準
        seibun1,
          (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun1 group by ippanmei)) from rac2 where ippanmei = seibun1 and cid = substr(idbyochu, 1, 1)) as keito1, kaisu1, mid1, 
        seibun2,
          (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun2 group by ippanmei)) from rac2 where ippanmei = seibun2 and cid = substr(idbyochu, 1, 1)) as keito2, kaisu2, mid2, 
        seibun3,
          (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun3 group by ippanmei)) from rac2 where ippanmei = seibun3 and cid = substr(idbyochu, 1, 1)) as keito3, kaisu3, mid3, 
        seibun4,
          (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun4 group by ippanmei)) from rac2 where ippanmei = seibun4 and cid = substr(idbyochu, 1, 1)) as keito4, kaisu4, mid4, 
        seibun5, 
          (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun5 group by ippanmei)) from rac2 where ippanmei = seibun5 and cid = substr(idbyochu, 1, 1)) as keito5, kaisu5, mid5,
        seizaidokusei, yoto, koka, zaikei 
    FROM ttTekiyoSaku; 
--//通称モード用
--// 1
DROP VIEW IF EXISTS tvTsushoTekiyoRkSaku1; 
CREATE TEMP VIEW tvTsushoTekiyoRkSaku1 AS SELECT DISTINCT 
    sakumotsu, byochu, mokuteki, shurui, tsusho, jiki, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, kaisu, kongo, 
      --svSeibunSimple: //成分に有効成分＋総会使用回数における有効成分表示(簡略型)
        (ifnull((select kanryaku from tSeibun where ippanmei = seibun1),seibun1)) as seibun1,
            (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun1 group by ippanmei)) from rac2 where ippanmei = seibun1 and cid = substr(idbyochu, 1, 1)) as keito1, kaisu1, mid1, 
        (ifnull((select kanryaku from tSeibun where ippanmei = seibun2),seibun2)) as seibun2,
            (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun2 group by ippanmei)) from rac2 where ippanmei = seibun2 and cid = substr(idbyochu, 1, 1)) as keito2, kaisu2, mid2, 
        (ifnull((select kanryaku from tSeibun where ippanmei = seibun3),seibun3)) as seibun3,
            (select if(count(*) > 0, keito, (select max(keito) from rac2 where ippanmei = seibun3 group by ippanmei)) from rac2 where ippanmei = seibun3 and cid = substr(idbyochu, 1, 1)) as keito3, kaisu3, mid3, 
        (ifnull((select kanryaku from tSeibun where ippanmei = seibun4),seibun4)) as seibun4,
            (select if(count(*) > 0, keito, (select max(keito) from rac2 where ippanmei = seibun4 group by ippanmei)) from rac2 where ippanmei = seibun4 and cid = substr(idbyochu, 1, 1)) as keito4, kaisu4, mid4, 
        (ifnull((select kanryaku from tSeibun where ippanmei = seibun5),seibun5)) as seibun5,
            (select if(count(*) > 0, keito, (select max(keito) from rac2 where ippanmei = seibun5 group by ippanmei)) from rac2 where ippanmei = seibun5 and cid = substr(idbyochu, 1, 1)) as keito5, kaisu5, mid5, 
        seizaidokusei, yoto, koka, zaikei 
    FROM ttTekiyoSaku; 
--// 2
DROP VIEW IF EXISTS tvTsushoTekiyoRkSaku2; 
CREATE TEMP VIEW tvTsushoTekiyoRkSaku2 AS SELECT DISTINCT 
        sakumotsu, byochu, mokuteki, shurui, tsusho, jiki, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, kaisu, kongo, 
      --svSeibun:       //成分に有効成分＋総会使用回数における有効成分表示(正式型)
        n_concat(' ', seibun1, '['||(select seibun from tSeibun where ippanmei = seibun1)||']') as seibun1,
        (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun1 group by ippanmei)) from rac2 where ippanmei = seibun1 and cid = substr(idbyochu, 1, 1)) as keito1, kaisu1, mid1, 
        n_concat(' ', seibun2, '['||(select seibun from tSeibun where ippanmei = seibun2)||']') as seibun2,
        (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun2 group by ippanmei)) from rac2 where ippanmei = seibun2 and cid = substr(idbyochu, 1, 1)) as keito2, kaisu2, mid2, 
        n_concat(' ', seibun3, '['||(select seibun from tSeibun where ippanmei = seibun3)||']') as seibun3,
        (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun3 group by ippanmei)) from rac2 where ippanmei = seibun3 and cid = substr(idbyochu, 1, 1)) as keito3, kaisu3, mid3, 
        n_concat(' ', seibun4, '['||(select seibun from tSeibun where ippanmei = seibun4)||']') as seibun4,
        (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun4 group by ippanmei)) from rac2 where ippanmei = seibun4 and cid = substr(idbyochu, 1, 1)) as keito4, kaisu4, mid4, 
        n_concat(' ', seibun5, '['||(select seibun from tSeibun where ippanmei = seibun5)||']') as seibun5,
        (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun5 group by ippanmei)) from rac2 where ippanmei = seibun5 and cid = substr(idbyochu, 1, 1)) as keito5, kaisu5, mid5, 
        seizaidokusei, yoto, koka, zaikei 
    FROM ttTekiyoSaku; 
--// 3
DROP VIEW IF EXISTS tvTsushoTekiyoRkSaku3; 
CREATE TEMP VIEW tvTsushoTekiyoRkSaku3 AS SELECT DISTINCT 
        sakumotsu, byochu, mokuteki, shurui, tsusho, jiki, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, kaisu, kongo, 
        --svKaisu:    --//回数に総使用回数における有効成分表示(正式形)
        seibun1,
        (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun1 group by ippanmei)) from rac2 where ippanmei = seibun1 and cid = substr(idbyochu, 1, 1)) as keito1,
        n_concat(': ', (select seibun from tSeibun where ippanmei = seibun1), kaisu1) as kaisu1, mid1, 
        seibun2,
            (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun2 group by ippanmei)) from rac2 where ippanmei = seibun2 and cid = substr(idbyochu, 1, 1)) as keito2,
            n_concat(': ', (select seibun from tSeibun where ippanmei = seibun2), kaisu2) as kaisu2, mid2, 
        seibun3,
            (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun3 group by ippanmei)) from rac2 where ippanmei = seibun3 and cid = substr(idbyochu, 1, 1)) as keito3,
            n_concat(': ', (select seibun from tSeibun where ippanmei = seibun3), kaisu3) as kaisu3, mid3, 
        seibun4,
            (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun4 group by ippanmei)) from rac2 where ippanmei = seibun4 and cid = substr(idbyochu, 1, 1)) as keito4,
            n_concat(': ', (select seibun from tSeibun where ippanmei = seibun4), kaisu4) as kaisu4, mid4, 
        seibun5,
            (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun5 group by ippanmei)) from rac2 where ippanmei = seibun5 and cid = substr(idbyochu, 1, 1)) as keito5,
            n_concat(': ', (select seibun from tSeibun where ippanmei = seibun5), kaisu5) as kaisu5, mid5, 
        
        seizaidokusei, yoto, koka, zaikei 
    FROM ttTekiyoSaku; 
--// 4
DROP VIEW IF EXISTS tvTsushoTekiyoRkSaku4; 
CREATE TEMP VIEW tvTsushoTekiyoRkSaku4 AS SELECT DISTINCT 
        sakumotsu, byochu, mokuteki, shurui, tsusho, jiki, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, kaisu, kongo, 
        --svKaisuSimple: //-- 回数に総使用回数における有効成分表示(省略形)
        seibun1,
            (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun1 group by ippanmei)) from rac2 where ippanmei = seibun1 and cid = substr(idbyochu, 1, 1)) as keito1,
            n_concat(': ', (select shoryaku from tSeibun where ippanmei = seibun1), kaisu1) as kaisu1, mid1, 
        seibun2,
            (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun2 group by ippanmei)) from rac2 where ippanmei = seibun2 and cid = substr(idbyochu, 1, 1)) as keito2,
            n_concat(': ', (select shoryaku from tSeibun where ippanmei = seibun2), kaisu2) as kaisu2, mid2, 
        seibun3,
            (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun3 group by ippanmei)) from rac2 where ippanmei = seibun3 and cid = substr(idbyochu, 1, 1)) as keito3,
            n_concat(': ', (select shoryaku from tSeibun where ippanmei = seibun3), kaisu3) as kaisu3, mid3, 
        seibun4,
            (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun4 group by ippanmei)) from rac2 where ippanmei = seibun4 and cid = substr(idbyochu, 1, 1)) as keito4,
            n_concat(': ', (select shoryaku from tSeibun where ippanmei = seibun4), kaisu4) as kaisu4, mid4, 
        seibun5,
            (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun5 group by ippanmei)) from rac2 where ippanmei = seibun5 and cid = substr(idbyochu, 1, 1)) as keito5,
            n_concat(': ', (select shoryaku from tSeibun where ippanmei = seibun5), kaisu5) as kaisu5, mid5, 
        seizaidokusei, yoto, koka, zaikei 
    FROM ttTekiyoSaku; 
--// 5
DROP VIEW IF EXISTS tvTsushoTekiyoRkSaku5; 
CREATE TEMP VIEW tvTsushoTekiyoRkSaku5 AS SELECT DISTINCT 
        sakumotsu, byochu, mokuteki, shurui, tsusho, jiki, baisu, ekiryo, hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, kaisu, kongo, 
        --svStandard: //-- 標準
        seibun1,
        (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun1 group by ippanmei)) from rac2 where ippanmei = seibun1 and cid = substr(idbyochu, 1, 1)) as keito1, kaisu1, mid1, 
        seibun2,
        (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun2 group by ippanmei)) from rac2 where ippanmei = seibun2 and cid = substr(idbyochu, 1, 1)) as keito2, kaisu2, mid2, 
        seibun3,
        (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun3 group by ippanmei)) from rac2 where ippanmei = seibun3 and cid = substr(idbyochu, 1, 1)) as keito3, kaisu3, mid3, 
        seibun4,
        (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun4 group by ippanmei)) from rac2 where ippanmei = seibun4 and cid = substr(idbyochu, 1, 1)) as keito4, kaisu4, mid4, 
        seibun5,
        (select if(count(*) > 0, keito,(select max(keito) from rac2 where ippanmei = seibun5 group by ippanmei)) from rac2 where ippanmei = seibun5 and cid = substr(idbyochu, 1, 1)) as keito5, kaisu5, mid5,
        seizaidokusei, yoto, koka, zaikei 
    FROM ttTekiyoSaku; 
COMMIT;

/* acis.zip 標準ビュー concat 書き換え 2025.10.11 追加 */
drop view if exists vs_sakumotsu;
CREATE VIEW vs_sakumotsu as select level, xidsaku, toroku, shukakubui, sakumotsu, betsumei, gunmei, strconv(n_concat('、', sakumotsu, ruby, betsumei, gunmei), 'kw') as keywords, gunmei = '落葉果樹' as rakuyokaju from m_sakumotsu where toroku in (1, 2) and sakumotsu not like '%除く%' order by idsaku;
drop view if exists vs_sakumotsu2;
CREATE VIEW vs_sakumotsu2 as select class, idsaku, toroku, shukakubui, sakumotsu, betsumei, gunmei, strconv(n_concat('、', sakumotsu, ruby, betsumei, gunmei), 'kw') as keywords from m_sakumotsu where toroku in (1, 2) and sakumotsu not like '%除く)' order by idsaku;

/* ACFinderBE 用 tekiyo テンポラリテーブル 2025.10.10 追加*/
drop table if exists t_tekiyo;
create temp table t_tekiyo as
with racinfo as (
	select ippanmei, ifnull(seibun, ippanmei) as seibun, iso, mid, keito, fgroup, risk 
	from rac
	left join iso using(ippanmei)
	left join (select distinct ippanmei, seibun from seibun) using(ippanmei)
)
select 
	bango, meisho, k.tsusho as tsusho, shurui, dokusei as seizaidokusei, sakumotsu, byochu, mokuteki, baisu, ekiryo, jiki, kaisu,
	hoho, basho, jikan, ondo, dojo, chitai, tekiyaku, k.kongo as kongo,
	seibun1, r1.seibun as yuko1, r1.iso as iso1, kaisu1, r1.mid as mid1, r1.keito as keito1, r1.fgroup as rem1, r1.risk as risk1,
	seibun2, r2.seibun as yuko2, r2.iso as iso2, kaisu2, r2.mid as mid2, r2.keito as keito2, r2.fgroup as rem2, r2.risk as risk2,
	seibun3, r3.seibun as yuko3, r3.iso as iso3, kaisu3, r3.mid as mid3, r3.keito as keito3, r3.fgroup as rem3, r3.risk as risk3,
	seibun4, r4.seibun as yuko4, r4.iso as iso4, kaisu4, r4.mid as mid4, r4.keito as keito4, r4.fgroup as rem4, r4.risk as risk4,
	seibun5, r5.seibun as yuko5, r5.iso as iso5, kaisu5, r5.mid as mid5, r5.keito as keito5, r5.fgroup as rem5, r5.risk as risk5,
	yoto as seizaiyoto, koka as seizaikoka, ojas as seizaiojas, zaikei, torokubi, ryakusho
from m_tekiyo
left join m_kihon as k using (bango)
left join seizai using (bango)
left join t_tokusai using (bango)
left join racinfo r1 on r1.ippanmei = seibun1
left join racinfo r2 on r2.ippanmei = seibun2
left join racinfo r3 on r3.ippanmei = seibun3
left join racinfo r4 on r4.ippanmei = seibun4
left join racinfo r5 on r5.ippanmei = seibun5;
/* t_tekiyo index 2025.10.13 追加 */
drop index if exists t_tekiyoIdx;
create index t_tekiyoIdx on t_tekiyo (bango, meisho, tsusho, shurui,sakumotsu, byochu, mokuteki, mid1, mid2, mid3, mid4, mid5);

/*
@template: {
	"views": ["tv_tsushoTekiyo", "tv_meishoTekiyo"],
	"pattern": "yuko([1-5]),\\s*kaisu\\1",
	"template": "IF(seibun$1=yuko$1, kaisu$1, yuko$1 || 'として' || kaisu$1) as kaisu$1"
}
*/

/* 作物/病害虫タブ用 tv_tsushoTekiyo ビュー */
drop view if exists tv_tsushoTekiyo;
create temp view tv_tsushoTekiyo as
select distinct
	tsusho, shurui, zaikei, seizaidokusei, sakumotsu, byochu, mokuteki, baisu, ekiryo, jiki, kaisu, hoho,
	iif(basho = '-', null, basho) as basho, iif(jikan = '-', null, jikan) as jikan, iif(ondo ='-', null, ondo) as ondo,
	iif(dojo = '-', null, dojo) as dojo, iif(chitai ='-', null, chitai) as chitai, tekiyaku,
	seibun1, yuko1, kaisu1, mid1, keito1, rem1, risk1,
	seibun2, yuko2, kaisu2, mid2, keito2, rem2, risk2,
	seibun3, yuko3, kaisu3, mid3, keito3, rem3, risk3,
	seibun4, yuko4, kaisu4, mid4, keito4, rem4, risk4,
	seibun5, yuko5, kaisu5, mid5, keito5, rem5, risk5,
	kongo, seizaiyoto, seizaikoka, seizaiojas
from t_tekiyo left join tsushoruby as t using (tsusho) left join m_sakumotsu as s using (sakumotsu) left join m_byochu as b using (byochu)
order by t.ruby, s.ruby, idbyochu;

/* 薬剤タブ用 tv_meishoTekiyo ビュー */
drop view if exists tv_meishoTekiyo;
create temp view tv_meishoTekiyo as
select
	sakumotsu, byochu, mokuteki, baisu, ekiryo, jiki, kaisu, hoho,
	iif(basho = '-', null, basho) as basho, iif(jikan = '-', null, jikan) as jikan, iif(ondo ='-', null, ondo) as ondo,
	iif(dojo = '-', null, dojo) as dojo, iif(chitai ='-', null, chitai) as chitai, tekiyaku,
	seibun1, yuko1, kaisu1, mid1, keito1, rem1, risk1,
	seibun2, yuko2, kaisu2, mid2, keito2, rem2, risk2,
	seibun3, yuko3, kaisu3, mid3, keito3, rem3, risk3,
	seibun4, yuko4, kaisu4, mid4, keito4, rem4, risk4,
	seibun5, yuko5, kaisu5, mid5, keito5, rem5, risk5,
	kongo, seizaiyoto, seizaikoka, seizaidokusei, zaikei, shurui, tsusho, meisho, bango
from t_tekiyo left join m_sakumotsu using (sakumotsu) left join m_byochu using (byochu)
order by ruby, idbyochu;
