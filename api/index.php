<?php
chdir(dirname(__DIR__) . '/data');
echo exec("unzip acis.zip -d /tmp");
echo exec("unzip spec.zip -d /tmp");
chdir(dirname(__DIR__) . '/macs');
require_once "./index.php";
?>
