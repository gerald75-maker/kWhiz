<?php

/**
 * Retourne le chemin privé du journal de télémétrie.
 *
 * Le répertoire peut être défini par KWHIZ_TELEMETRY_DIR. À défaut, il se
 * trouve dans ../var/telemetry, donc hors du répertoire public/ ou dist/.
 */
function telemetry_log_path(): ?string
{
    static $resolvedPath = false;

    if ($resolvedPath !== false) {
        return $resolvedPath;
    }

    $configuredDirectory = getenv('KWHIZ_TELEMETRY_DIR');
    $storageDirectory = is_string($configuredDirectory) && trim($configuredDirectory) !== ''
        ? rtrim($configuredDirectory, DIRECTORY_SEPARATOR)
        : dirname(__DIR__) . DIRECTORY_SEPARATOR . 'var' . DIRECTORY_SEPARATOR . 'telemetry';

    if (!is_dir($storageDirectory) && !@mkdir($storageDirectory, 0750, true) && !is_dir($storageDirectory)) {
        error_log('[kWhiz] Impossible de créer le répertoire privé de télémétrie.');
        $resolvedPath = null;
        return null;
    }

    if (!is_writable($storageDirectory)) {
        error_log('[kWhiz] Le répertoire privé de télémétrie n’est pas accessible en écriture.');
        $resolvedPath = null;
        return null;
    }

    $resolvedDirectory = realpath($storageDirectory);
    $publicRoot = defined('KWHIZ_PUBLIC_ROOT')
        ? realpath(KWHIZ_PUBLIC_ROOT)
        : (isset($_SERVER['DOCUMENT_ROOT']) ? realpath($_SERVER['DOCUMENT_ROOT']) : false);
    if (
        $resolvedDirectory !== false
        && $publicRoot !== false
        && (
            $resolvedDirectory === $publicRoot
            || str_starts_with(
                $resolvedDirectory . DIRECTORY_SEPARATOR,
                rtrim($publicRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR
            )
        )
    ) {
        error_log('[kWhiz] Le stockage de télémétrie doit se trouver hors du document root.');
        $resolvedPath = null;
        return null;
    }

    $resolvedPath = $storageDirectory . DIRECTORY_SEPARATOR . 'visits.log';
    migrate_legacy_telemetry_log($resolvedPath);

    return $resolvedPath;
}

/**
 * Déplace automatiquement l’ancien journal public lors du premier accès.
 */
function migrate_legacy_telemetry_log(string $targetPath): void
{
    $publicRoot = defined('KWHIZ_PUBLIC_ROOT')
        ? KWHIZ_PUBLIC_ROOT
        : ($_SERVER['DOCUMENT_ROOT'] ?? '');
    $legacyPath = rtrim($publicRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'visits.log';
    if (!is_file($legacyPath) || is_file($targetPath)) {
        return;
    }

    if (@rename($legacyPath, $targetPath)) {
        @chmod($targetPath, 0640);
        return;
    }

    if (@copy($legacyPath, $targetPath)) {
        @chmod($targetPath, 0640);
        if (!@unlink($legacyPath)) {
            error_log('[kWhiz] Ancien visits.log copié mais impossible à supprimer du document root.');
        }
        return;
    }

    error_log('[kWhiz] Impossible de migrer l’ancien visits.log vers le stockage privé.');
}
