<?php
$log_file = __DIR__ . '/visits.log';

$ua        = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
$is_mobile = preg_match('/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i', $ua);
$device    = $is_mobile ? 'mobile' : 'desktop';

// Hash anonyme du visiteur (IP + UA) — non réversible, conforme RGPD
$raw_ip    = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
$raw_ip    = trim(explode(',', $raw_ip)[0]);
$visitor   = substr(md5($raw_ip . ($ua)), 0, 8);

date_default_timezone_set('Europe/Paris');
$date     = date('Y-m-d H:i:s');
$ua_short = substr($ua, 0, 80);
$line     = "$date | $device | $ua_short | $visitor\n";

file_put_contents($log_file, $line, FILE_APPEND | LOCK_EX);
http_response_code(204);
