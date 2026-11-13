<?php
declare(strict_types=1);

// Limite de débit par fichiers temporaires, partagée par route.php et stats.php.
// Ce fichier ne produit aucune sortie : l'ouvrir directement ne révèle rien.

/**
 * Enregistre un appel dans le compartiment $bucket et dit s'il reste dans la limite.
 * $scope distingue les appelants (adresse IP) ; une chaîne vide donne un compteur global.
 */
function kwhizRateLimit(string $bucket, int $max, int $windowSeconds, string $scope = ''): bool {
    $file = sys_get_temp_dir() . '/kwhiz-rl-' . preg_replace('/[^a-z0-9-]/', '', $bucket)
        . '-' . substr(hash('sha256', $scope), 0, 24) . '.json';
    $handle = @fopen($file, 'c+');
    // Sans fichier temporaire, on laisse passer : la limite protège un quota, elle ne doit
    // pas rendre le service indisponible.
    if ($handle === false) return true;
    try {
        if (!flock($handle, LOCK_EX)) return true;
        $now = time();
        $stored = json_decode((string) stream_get_contents($handle), true);
        $hits = array_values(array_filter(
            is_array($stored) ? $stored : [],
            static fn($time): bool => is_int($time) && $time > $now - $windowSeconds
        ));
        $allowed = count($hits) < $max;
        if ($allowed) $hits[] = $now;
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, (string) json_encode($hits));
        fflush($handle);
        flock($handle, LOCK_UN);
        return $allowed;
    } finally {
        fclose($handle);
    }
}

/** Adresse de l'appelant. X-Forwarded-For n'est pas lu : n'importe qui peut l'écrire. */
function kwhizClientAddress(): string {
    return (string) ($_SERVER['REMOTE_ADDR'] ?? '');
}

/** Supprime les fichiers temporaires kWhiz plus vieux que $maxAgeSeconds (un appel sur cent). */
function kwhizPurgeTemporaryFiles(string $pattern, int $maxAgeSeconds): void {
    if (random_int(1, 100) !== 1) return;
    $now = time();
    foreach (glob(sys_get_temp_dir() . '/' . $pattern) ?: [] as $file) {
        if (is_file($file) && $now - (int) filemtime($file) > $maxAgeSeconds) @unlink($file);
    }
}
