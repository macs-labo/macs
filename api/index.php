<?php
$datapath = dirname(__DIR__) . '/data';
if (!file_exists('/tmp/acis.db')) {
  $zip = new ZipArchive;
  $zip->open("$datapath/acis.zip");
  $zip->extractTo('/tmp/');
  $zip->close();
  $zip->open("$datapath/spec.zip");
  $zip->extractTo('/tmp/');
  $zip->close();
}
//$datapath = dirname(__DIR__) . '/macs/data';
//copy("$datapath/acis.db", '/tmp/acis.db');
//copy("$datapath/spec.db", '/tmp/spec.db');
chdir(dirname(__DIR__) . '/macs');
require_once "./index.php";
?>
