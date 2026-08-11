<?php
declare(strict_types=1);

define('KWHIZ_STATUS_LIBRARY_ONLY', true);
require __DIR__ . '/../public/status.php';

function assertStationIds(array $expected, array $index, string $pointId, string $scenario): void {
    $actual = stationIdsForPoint($index, $pointId);
    if ($actual !== $expected) {
        fwrite(STDERR, sprintf(
            "%s: attendu %s, obtenu %s\n",
            $scenario,
            json_encode($expected),
            json_encode($actual)
        ));
        exit(1);
    }
}

$index = [
    'pointToStation' => [
        'LEGACY' => 'operator:legacy',
        'SAFE' => 'operator:legacy-safe',
        'AMBIGUOUS' => 'operator:must-not-be-used',
    ],
    'pointToStations' => [
        'SAFE' => ['operator:station-b', 'operator:station-a', 'operator:station-b'],
        'AMBIGUOUS' => ['operator:ambiguous-a', 'operator:ambiguous-b'],
    ],
    'ambiguousPointIds' => ['AMBIGUOUS'],
];

assertStationIds(['operator:legacy'], $index, 'LEGACY', 'ancien format pointToStation');
assertStationIds(['operator:station-a', 'operator:station-b'], $index, 'SAFE', 'association sûre et doublons');
assertStationIds([], $index, 'AMBIGUOUS', 'identifiant ambigu');
assertStationIds([], $index, 'UNKNOWN', 'identifiant inconnu');

echo "Validation comportementale PHP réussie\n";
