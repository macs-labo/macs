<?php
$datapath = dirname(__DIR__) . '/data';
exec("unzip -d /tmp $datapath/acis.zip");
exec("unzip -d /tmp $datapath/spec.zip");
chdir(dirname(__DIR__) . '/macs');
require_once "./index.php";
?>
