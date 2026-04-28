<?php
chdir(dirname(__DIR__) . '/data');
exec("unzip acis.zip -d /tmp");
exec("unzip spec.zip -d /tmp");
chdir(dirname(__DIR__) . '/macs');
require_once "./index.php";
?>
