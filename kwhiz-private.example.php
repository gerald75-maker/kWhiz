<?php
// Copiez ce fichier sous le nom kwhiz-private.php dans le dossier parent
// de la racine web. Ne placez jamais ce fichier ni vos secrets dans dist/.
return [
    // Clé openrouteservice utilisée par route.php.
    'openrouteservice_api_key' => 'VOTRE_CLE_OPENROUTESERVICE',
    // Empreinte du mot de passe de stats.php. Ouvrez stats.php tant que cette ligne est
    // absente : la page calcule l'empreinte du mot de passe que vous choisissez.
    'stats_password_hash' => 'EMPREINTE_FOURNIE_PAR_STATS_PHP',
];
