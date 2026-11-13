<?php
declare(strict_types=1);

// Compteur de visites : une ligne « date | mobile ou desktop » par ouverture de l'application.
// Ni adresse IP, ni navigateur, ni identifiant de visiteur : rien ici ne désigne une personne.
// Le journal n'est pas lisible depuis le web (voir .htaccess) ; stats.php l'affiche après
// authentification.

header('Cache-Control: no-store, max-age=0');

$userAgent = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
$device = preg_match('/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i', $userAgent) === 1
    ? 'mobile'
    : 'desktop';

date_default_timezone_set('Europe/Paris');
@file_put_contents(__DIR__ . '/visits.log', date('Y-m-d H:i:s') . " | $device\n", FILE_APPEND | LOCK_EX);
http_response_code(204);
