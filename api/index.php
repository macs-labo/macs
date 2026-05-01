<?php
//chdir(dirname(__DIR__) . '/data');
//echo exec("unzip acis.zip -d /tmp");
//echo exec("unzip spec.zip -d /tmp");
$datapath = dirname(__DIR__) . '/macs/data';
copy("$datapath/acis.db", '/tmp/acis.db');
copy("$datapath/spec.db", '/tmp/spec.db');
chdir(dirname(__DIR__) . '/macs');
require_once "./index.php";
?>
