<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');

const ORS_BASE = 'https://api.openrouteservice.org';
const MAX_ADDRESS_LENGTH = 160;
const CACHE_SECONDS = 3600;

function respond(int $status, array $payload): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function apiKey(): string {
    $key = trim((string) getenv('OPENROUTESERVICE_API_KEY'));
    $privateConfig = dirname(__DIR__) . '/kwhiz-private.php';
    if ($key === '' && is_file($privateConfig)) {
        $config = require $privateConfig;
        $key = is_array($config) ? trim((string) ($config['openrouteservice_api_key'] ?? '')) : '';
    }
    return $key;
}

function orsRequest(string $url, string $key, ?array $body = null): array {
    $headers = [
        'Authorization: ' . $key,
        'Accept: application/json, application/geo+json'
    ];
    $options = ['timeout' => 20, 'ignore_errors' => true, 'header' => implode("\r\n", $headers)];
    if ($body !== null) {
        $options['method'] = 'POST';
        $options['header'] .= "\r\nContent-Type: application/json";
        $options['content'] = json_encode($body, JSON_UNESCAPED_SLASHES);
    }
    $result = @file_get_contents($url, false, stream_context_create(['http' => $options]));
    if ($result === false) throw new RuntimeException('Service d’itinéraire indisponible. Réessayez dans quelques instants.');
    $decoded = json_decode($result, true);
    if (!is_array($decoded)) throw new RuntimeException('Service d’itinéraire indisponible. Réessayez dans quelques instants.');
    return $decoded;
}

function geocode(string $address, string $key): array {
    $url = ORS_BASE . '/geocode/search?' . http_build_query([
        'text' => $address,
        'size' => 1,
        'lang' => 'fr',
        'boundary.country' => 'FR'
    ]);
    $result = orsRequest($url, $key);
    $coordinates = $result['features'][0]['geometry']['coordinates'] ?? null;
    if (!is_array($coordinates) || count($coordinates) < 2) {
        throw new InvalidArgumentException('Adresse introuvable : ' . $address . '. Précisez une adresse française ou un code postal.');
    }
    $label = trim((string) ($result['features'][0]['properties']['label'] ?? $address));
    return [
        'coordinates' => [(float) $coordinates[0], (float) $coordinates[1]],
        'label' => $label !== '' ? $label : $address
    ];
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, ['error' => 'Méthode non autorisée']);
$contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > 2048) respond(413, ['error' => 'Requête trop volumineuse']);
$input = json_decode((string) file_get_contents('php://input'), true);
$start = trim((string) ($input['start'] ?? ''));
$end = trim((string) ($input['end'] ?? ''));
$providedStart = $input['startCoordinates'] ?? null;
$validProvidedStart = is_array($providedStart) && count($providedStart) === 2
    && is_numeric($providedStart[0]) && is_numeric($providedStart[1])
    && (float) $providedStart[0] >= -180 && (float) $providedStart[0] <= 180
    && (float) $providedStart[1] >= -90 && (float) $providedStart[1] <= 90;
$textLength = static fn(string $value): int => function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
if ((!$validProvidedStart && $start === '') || $end === '' || $textLength($start) > MAX_ADDRESS_LENGTH || $textLength($end) > MAX_ADDRESS_LENGTH) {
    respond(400, ['error' => 'Indiquez une adresse de départ et une adresse d’arrivée valides']);
}

$key = apiKey();
if ($key === '') respond(503, ['error' => 'Le calcul d’itinéraire n’est pas encore configuré']);
$startCacheValue = $validProvidedStart
    ? sprintf('%.5F,%.5F', (float) $providedStart[0], (float) $providedStart[1])
    : $start;
$normalizedRoute = function_exists('mb_strtolower') ? mb_strtolower('fr-labels-v1|' . $startCacheValue . '|' . $end) : strtolower('fr-labels-v1|' . $startCacheValue . '|' . $end);
$cacheFile = sys_get_temp_dir() . '/kwhiz-route-' . hash('sha256', $normalizedRoute) . '.json';
if (is_file($cacheFile) && time() - filemtime($cacheFile) < CACHE_SECONDS) {
    $cached = file_get_contents($cacheFile);
    if ($cached !== false) { echo $cached; exit; }
}

try {
    $startPlace = $validProvidedStart
        ? ['coordinates' => [(float) $providedStart[0], (float) $providedStart[1]], 'label' => 'Position actuelle']
        : geocode($start, $key);
    $endPlace = geocode($end, $key);
    $startCoordinates = $startPlace['coordinates'];
    $endCoordinates = $endPlace['coordinates'];
    $route = orsRequest(ORS_BASE . '/v2/directions/driving-car/geojson', $key, [
        'coordinates' => [$startCoordinates, $endCoordinates],
        'instructions' => false,
        'geometry_simplify' => true
    ]);
    $feature = $route['features'][0] ?? null;
    $geometry = $feature['geometry'] ?? null;
    $distance = $feature['properties']['summary']['distance'] ?? null;
    if (($geometry['type'] ?? '') !== 'LineString' || !is_numeric($distance)) {
        throw new InvalidArgumentException('Aucun itinéraire routier trouvé. Vérifiez les lieux reconnus.');
    }
    $payload = json_encode([
        'geometry' => $geometry,
        'distanceKm' => round(((float) $distance) / 1000, 1),
        'start' => $startCoordinates,
        'end' => $endCoordinates,
        'recognizedStart' => $startPlace['label'],
        'recognizedEnd' => $endPlace['label']
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($payload === false) throw new RuntimeException('Itinéraire invalide');
    file_put_contents($cacheFile, $payload, LOCK_EX);
    echo $payload;
} catch (InvalidArgumentException $error) {
    respond(422, ['error' => $error->getMessage()]);
} catch (Throwable $error) {
    respond(503, ['error' => $error->getMessage()]);
}
