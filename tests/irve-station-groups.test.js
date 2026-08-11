import test from 'node:test';
import assert from 'node:assert/strict';
import { groupCertainStations } from '../scripts/irve-station-groups.mjs';

function station(id, { operator = 'electra', lat, lon, points, stationIds = [], names = ['Site'], addresses = ['1 rue du Test'], cities = ['Ville'], display = {} }) {
  const pointMap = new Map(points.map(point => [point.id, point]));
  return {
    stationId: id,
    operator,
    lat,
    lon,
    points: pointMap,
    pointIds: new Set(pointMap.keys()),
    sourceStationIds: new Set(stationIds),
    names: new Set(names),
    addresses: new Set(addresses),
    cities: new Set(cities),
    display: {
      name: names[0] || '', address: addresses[0] || '', city: cities[0] || '',
      access: 'Accès libre', hours: '24/7', ...display
    }
  };
}

const point = (id, power = 300, ccs = true, chademo = false) => ({ id, power, ccs, chademo });

test('regroupe Ametzondo sur un identifiant existant et huit points uniques', () => {
  const ids = Array.from({ length: 8 }, (_, index) => `FRELC-P${index + 1}`);
  const left = station('electra:43.4817:-1.4457', {
    lat: 43.48172736, lon: -1.44572642, points: ids.map(id => point(id)),
    names: ["Electra Saint-Pierre-d'Irube - CC Ametzondo Shopping"],
    addresses: ["3 avenue du Portou, 64990 Saint-Pierre-d'Irube"], cities: []
  });
  const right = station('electra:43.4819:-1.4460', {
    lat: 43.48195, lon: -1.44596, points: ids.flatMap(id => [point(id), point(id)]),
    names: ["Saint-Pierre-d'Irube - CC Ametzondo Shopping"],
    addresses: ["3 avenue du Portou 64990 Saint-Pierre-d'Irube"], cities: ["Saint-Pierre-d'Irube"]
  });
  const result = groupCertainStations([right, left]);
  assert.equal(result.grouping.certainGroups, 1);
  assert.equal(result.grouping.removedStations, 1);
  assert.equal(result.stations.length, 1);
  assert.equal(result.stations[0].stationId, left.stationId);
  assert.equal(result.stations[0].pointIds.size, 8);
  assert.equal(result.stationAliases[right.stationId], left.stationId);
});

test('ne regroupe ni un probable sans point commun ni un site distant', () => {
  const probable = [
    station('electra:48.0000:2.0000', { lat: 48, lon: 2, points: [point('A')] }),
    station('electra:48.0001:2.0001', { lat: 48.0001, lon: 2.0001, points: [point('B')] })
  ];
  const distant = [
    station('electra:49.0000:2.0000', { lat: 49, lon: 2, points: [point('DISTANT')] }),
    station('electra:49.0015:2.0000', { lat: 49.0015, lon: 2, points: [point('DISTANT')] })
  ];
  const result = groupCertainStations([...probable, ...distant]);
  assert.equal(result.grouping.certainGroups, 0);
  assert.equal(result.grouping.probableGroups, 1);
  assert.equal(result.grouping.ambiguousGroups, 1);
  assert.equal(result.stations.length, 4);
  assert.deepEqual(result.stationAliases, {});
});

test('refuse un regroupement par simple chaînage si toutes les paires ne sont pas sûres', () => {
  const shared = point('SHARED');
  const stations = [0, 0.0007, 0.0014].map((offset, index) => station(`electra:48.${index}:2`, {
    lat: 48 + offset, lon: 2, points: [shared]
  }));
  const result = groupCertainStations(stations);
  assert.equal(result.grouping.certainGroups, 0);
  assert.equal(result.grouping.ambiguousGroups, 1);
  assert.equal(result.stations.length, 3);
});

test('agrège puissance et connecteurs sur les points uniques et signale les métadonnées', () => {
  const left = station('electra:47.0000:2.0000', {
    lat: 47, lon: 2, points: [point('A', 150, true, false), point('B', 200, false, true)],
    display: { access: 'Accès réservé' }
  });
  const right = station('electra:47.0001:2.0001', {
    lat: 47.0001, lon: 2.0001, points: [point('A', 300, false, true), point('B', 200, true, false)],
    display: { access: 'Accès libre' }
  });
  const result = groupCertainStations([left, right]);
  assert.equal(result.stations[0].points.size, 2);
  assert.deepEqual(result.stations[0].points.get('A'), { id: 'A', power: 300, ccs: true, chademo: true });
  assert.equal(result.stations[0].display.access, 'Accès réservé');
  assert.deepEqual(result.grouping.metadataConflicts[0].fields.map(field => field.field), ['access']);
});

test('produit exactement le même résultat après permutation des stations', () => {
  const shared = [point('A'), point('B')];
  const stations = [
    station('electra:46.0001:2.0001', { lat: 46.0001, lon: 2.0001, points: shared }),
    station('electra:46.0000:2.0000', { lat: 46, lon: 2, points: shared })
  ];
  assert.deepEqual(groupCertainStations(stations), groupCertainStations([...stations].reverse()));
});
