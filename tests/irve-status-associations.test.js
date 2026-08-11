import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildStatusAssociations } from '../scripts/irve-status-associations.mjs';

function station({
  stationId,
  pointId = 'FRTESTE001',
  operator = 'electra',
  lat = 48.85,
  lon = 2.35,
  sourceStationIds = ['FRTESTP001'],
  names = ['Station République'],
  addresses = ['1 place de la République'],
  cities = ['Paris']
}) {
  return { stationId, operator, lat, lon, pointIds: new Set([pointId]), sourceStationIds: new Set(sourceStationIds), names: new Set(names), addresses: new Set(addresses), cities: new Set(cities) };
}

test('résout une microvariation de coordonnées avec le même identifiant de station', () => {
  const result = buildStatusAssociations([
    station({ stationId: 'electra:48.8500:2.3500' }),
    station({ stationId: 'electra:48.8501:2.3501' })
  ]);
  assert.deepEqual(result.pointToStations.FRTESTE001, ['electra:48.8500:2.3500', 'electra:48.8501:2.3501']);
  assert.equal(result.pointToStation.FRTESTE001, 'electra:48.8500:2.3500');
  assert.deepEqual(result.ambiguousPointIds, []);
  assert.equal(result.metrics.resolvedNearbyConflicts, 1);
  assert.equal(result.metrics.overwrittenAssociations, 0);
});

test('résout un même site étendu avec des identités commerciales cohérentes', () => {
  const result = buildStatusAssociations([
    station({ stationId: 'electra:48.8500:2.3500', sourceStationIds: ['FRA'], names: ['Electra Centre commercial Qwartz'] }),
    station({ stationId: 'electra:48.8520:2.3500', sourceStationIds: ['FRB'], names: ['Centre commercial Qwartz'] })
  ]);
  assert.equal(result.metrics.resolvedNearbyConflicts, 1);
  assert.equal(result.pointToStations.FRTESTE001.length, 2);
});

test('exclut des noms et communes incompatibles même à courte distance', () => {
  const result = buildStatusAssociations([
    station({ stationId: 'electra:48.8500:2.3500', sourceStationIds: ['FRA'], names: ['Hôtel du Parc'], cities: ['Paris'] }),
    station({ stationId: 'electra:48.8510:2.3500', sourceStationIds: ['FRB'], names: ['Supermarché des Lilas'], cities: ['Montreuil'] })
  ]);
  assert.deepEqual(result.ambiguousPointIds, ['FRTESTE001']);
  assert.deepEqual(result.ambiguousPointCandidates.FRTESTE001, ['electra:48.8500:2.3500', 'electra:48.8510:2.3500']);
  assert.equal(result.pointToStation.FRTESTE001, undefined);
});

test('exclut un identifiant réutilisé à plus de 500 mètres', () => {
  const result = buildStatusAssociations([
    station({ stationId: 'tesla:48.8500:2.3500', operator: 'tesla' }),
    station({ stationId: 'tesla:48.8600:2.3500', operator: 'tesla', lat: 48.86 })
  ]);
  assert.deepEqual(result.ambiguousPointIds, ['FRTESTE001']);
  assert.equal(result.metrics.distantConflicts, 1);
  assert.equal(result.metrics.overwrittenAssociations, 0);
});

test('produit le même index quel que soit l’ordre des lignes candidates', () => {
  const candidates = [
    station({ stationId: 'electra:48.8501:2.3501' }),
    station({ stationId: 'electra:48.8500:2.3500' }),
    station({ stationId: 'electra:48.8600:2.3600', pointId: 'FRTESTE002' })
  ];
  assert.deepEqual(buildStatusAssociations(candidates), buildStatusAssociations([...candidates].reverse()));
});

test('status.php préfère le nouveau format et conserve le repli historique', async () => {
  const source = await readFile(new URL('../public/status.php', import.meta.url), 'utf8');
  assert.match(source, /\$index\['pointToStations'\]\[\$pointId\]/);
  assert.match(source, /\$index\['pointToStation'\]\[\$pointId\]/);
  assert.match(source, /in_array\(\$pointId, \$ambiguousPointIds, true\)/);
  assert.match(source, /foreach \(\$point\['stationIds'\] as \$stationId\)/);
  assert.ok(source.indexOf("$index['pointToStations']") < source.indexOf("$index['pointToStation']"));
});
