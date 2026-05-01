<?php
$datapath = dirname(__DIR__) . '/data';
$zip = new ZipArchive;
$dbs = ['acis', 'spec'];
foreach ($dbs as $db) {
  if (!file_exists("/tmp/$db.db")) {
    $zip->open("$datapath/$db.zip");
    $zip->extractTo('/tmp/');
    $zip->close();
  }
}
chdir(dirname(__DIR__) . '/macs');
require_once "./index.php";
?>
