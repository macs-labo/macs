<?php
//chdir(dirname(__DIR__) . '/data');
//echo exec("unzip acis.zip -d /tmp");
//echo exec("unzip spec.zip -d /tmp");
$datadir = __DIR__ . '/data;
copy("$datadir/acis.db", "/tmp/acis.db");
copy("$datadir/spec.db", "/tmp/spec.db");
chdir(dirname(__DIR__) . '/macs');
require_once "./index.php";
?>
