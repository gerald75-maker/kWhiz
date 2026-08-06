<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');

const DYNAMIC_URL = 'https://www.data.gouv.fr/api/1/datasets/r/89185b1f-f958-4c5b-9282-399a66ecee97';
const CACHE_SECONDS = 120;
const FRESH_SECONDS = 900;

$cacheFile = sys_get_temp_dir() . '/kwhiz-irve-status-v1.json';
$lockFile = sys_get_temp_dir() . '/kwhiz-irve-status-v1.lock';

function serveCache(string $path): bool {
    if (!is_file($path)) return false;
    $contents = file_get_contents($path);
    if ($contents === false) return false;
    echo $contents;
    return true;
}

if (is_file($cacheFile) && time() - filemtime($cacheFile) < CACHE_SECONDS) {
    serveCache($cacheFile);
    exit;
}

$lock = fopen($lockFile, 'c');
if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
    if (serveCache($cacheFile)) exit;
    http_response_code(503);
    echo json_encode(['error' => 'Statuts momentanément indisponibles']);
    exit;
}

$index = json_decode((string) file_get_contents(__DIR__ . '/irve-status-index.json'), true);
$pointToStation = $index['pointToStation'] ?? [];
$context = stream_context_create(['http' => ['timeout' => 20, 'user_agent' => 'kWhiz/2.23']]);
$stream = @fopen(DYNAMIC_URL, 'r', false, $context);

if ($stream === false || !$pointToStation) {
    flock($lock, LOCK_UN);
    if (serveCache($cacheFile)) exit;
    http_response_code(503);
    echo json_encode(['error' => 'Source dynamique indisponible']);
    exit;
}

$headers = fgetcsv($stream, null, ',', '"', '\\');
$columns = $headers ? array_flip($headers) : [];
$required = ['id_pdc_itinerance', 'etat_pdc', 'occupation_pdc', 'horodatage'];
foreach ($required as $column) {
    if (!isset($columns[$column])) {
        fclose($stream);
        flock($lock, LOCK_UN);
        http_response_code(502);
        echo json_encode(['error' => 'Format dynamique invalide']);
        exit;
    }
}

$latestPoints = [];
$now = time();
while (($row = fgetcsv($stream, null, ',', '"', '\\')) !== false) {
    $pointId = strtoupper(trim($row[$columns['id_pdc_itinerance']] ?? ''));
    $stationId = $pointToStation[$pointId] ?? null;
    if ($stationId === null) continue;
    $observedAt = strtotime($row[$columns['horodatage']] ?? '');
    if ($observedAt === false || $now - $observedAt > FRESH_SECONDS || $observedAt > $now + 60) continue;
    $state = $row[$columns['etat_pdc']] ?? 'inconnu';
    $occupation = $row[$columns['occupation_pdc']] ?? 'inconnu';
    if ($state === 'inconnu' || $occupation === 'inconnu') continue;

    if (!isset($latestPoints[$pointId]) || $observedAt > $latestPoints[$pointId]['observedAt']) {
        $latestPoints[$pointId] = ['stationId' => $stationId, 'state' => $state, 'occupation' => $occupation, 'observedAt' => $observedAt];
    }
}
fclose($stream);

$stations = [];
foreach ($latestPoints as $point) {
    $stationId = $point['stationId'];
    $state = $point['state'];
    $occupation = $point['occupation'];
    $observedAt = $point['observedAt'];
    if (!isset($stations[$stationId])) {
        $stations[$stationId] = ['free' => 0, 'occupied' => 0, 'reserved' => 0, 'outOfService' => 0, 'known' => 0, 'observedAt' => gmdate('c', $observedAt)];
    }
    $item = &$stations[$stationId];
    $item['known']++;
    if ($state === 'hors_service') $item['outOfService']++;
    elseif ($occupation === 'libre') $item['free']++;
    elseif ($occupation === 'occupe') $item['occupied']++;
    elseif ($occupation === 'reserve') $item['reserved']++;
    if ($observedAt > strtotime($item['observedAt'])) $item['observedAt'] = gmdate('c', $observedAt);
    unset($item);
}

foreach ($stations as &$station) {
    if ($station['free'] > 0) $station['status'] = 'available';
    elseif ($station['occupied'] + $station['reserved'] > 0) $station['status'] = 'busy';
    elseif ($station['outOfService'] === $station['known']) $station['status'] = 'out_of_service';
    else $station['status'] = 'unknown';
}
unset($station);

$payload = json_encode(['generatedAt' => gmdate('c'), 'freshnessSeconds' => FRESH_SECONDS, 'stations' => $stations], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($payload !== false) {
    $temporary = $cacheFile . '.tmp';
    file_put_contents($temporary, $payload, LOCK_EX);
    rename($temporary, $cacheFile);
    echo $payload;
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Agrégation impossible']);
}
flock($lock, LOCK_UN);
fclose($lock);
