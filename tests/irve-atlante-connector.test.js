import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAtlanteCatalog, mergeAtlanteCatalog, formatAtlanteReport } from '../scripts/irve-atlante-connector.mjs';
import { qualifyFastStation } from '../scripts/irve-fast-qualification.mjs';
import { buildStatusAssociations } from '../scripts/irve-status-associations.mjs';

function rawStation(overrides = {}) {
  return {
    id: 'FRATLFR00716', party_id: 'ATL', name: 'Atlante - Bayonne - Centre Commercial Ametzondo Shopping',
    housenumber: '2-4', street: 'Av. du Portou', city: 'Bayonne', postal_code: '64990', country: 'FRA',
    coordinates: { latitude: 43.48227, longitude: -1.44582 },
    evses: Array.from({ length: 34 }, (_, index) => ({
      evse_id: `FR*ATL*E102${57 + Math.floor(index / 2)}*${index % 2 + 1}`,
      status: index === 0 ? 'CHARGING' : 'AVAILABLE',
      connectors: [{ standard: 'IEC_62196_T2_COMBO', max_electric_power: index < 20 ? 300000 : 50000 }]
    })),
    ...overrides
  };
}

test('normalise les données statiques françaises sans figer la disponibilité', () => {
  const catalog = normalizeAtlanteCatalog([rawStation(), rawStation({ id: 'ITATL1', country: 'ITA' })], '2026-08-15');
  assert.equal(catalog.stationCount, 1);
  assert.equal(catalog.evseCount, 34);
  const [station] = catalog.stations;
  assert.equal(station.stableId, 'verified:atlante:fratlfr00716');
  assert.equal(station.maxPowerKw, 300);
  assert.equal(station.city, "Saint-Pierre-d'Irube");
  assert.equal(station.officialUrl, 'https://map.atlante.energy/?iframe=true&lang=fr');
  assert.deepEqual(station.powersKw, [50, 300]);
  assert.equal(station.pointIds.length, 34);
  assert.ok(station.points.every(point => !Object.hasOwn(point, 'status')));
});

test('conserve FRATLFR00716 distincte d’Electra Ametzondo', () => {
  const catalog = normalizeAtlanteCatalog([rawStation()], '2026-08-15');
  const electra = { stationId: 'electra:43.4817:-1.4457', operator: 'electra', lat: 43.48195, lon: -1.44596, pointIds: new Set(['FRELC1']), sourceStationIds: new Set(['FRELC']), points: new Map(), display: { name: 'Ametzondo', address: '3 avenue du Portou' } };
  const result = mergeAtlanteCatalog([electra], catalog);
  assert.equal(result.stations.length, 2);
  const atlante = result.stations.find(station => station.stationId === 'verified:atlante:fratlfr00716');
  assert.equal(atlante.pointIds.size, 0);
  assert.equal(atlante.officialEvseCount, 34);
  assert.equal(atlante.officialMaxPower, 300);
  assert.deepEqual(buildStatusAssociations(result.stations).pointToStation, { FRELC1: electra.stationId });
  assert.equal(result.counts['absente de l’IRVE et ajoutée temporairement depuis Atlante'], 1);
});

test('privilégie et enrichit une station IRVE équivalente', () => {
  const catalog = normalizeAtlanteCatalog([rawStation()], '2026-08-15');
  const official = catalog.stations[0];
  const irve = { stationId: 'atlante:43.4823:-1.4458', operator: 'atlante', lat: official.lat, lon: official.lon, pointIds: new Set(['FR*IRV*E1']), sourceStationIds: new Set(['FR*IRV*S1']), points: new Map([['FR*IRV*E1', { id: 'FR*IRV*E1', power: 150, ccs: true, chademo: false }]]), display: { name: official.name, address: official.address } };
  const result = mergeAtlanteCatalog([irve], catalog);
  assert.equal(result.stations.length, 1);
  assert.equal(result.stations[0].stationId, irve.stationId);
  assert.equal(result.stations[0].pointIds.size, 1);
  assert.equal(result.stations[0].officialEvseCount, 34);
  assert.equal(result.stations[0].officialMaxPower, 300);
  assert.equal(result.stations[0].sourceStationIds.has('FRATLFR00716'), false);
  assert.deepEqual(buildStatusAssociations(result.stations).pointToStation, { 'FR*IRV*E1': irve.stationId });
  assert.equal(result.counts['présente mais enrichie par Atlante'], 1);
});

test('déduplique les EVSE sources et refuse les variations massives', () => {
  const duplicate = rawStation();
  duplicate.evses[1].evse_id = duplicate.evses[0].evse_id;
  assert.equal(normalizeAtlanteCatalog([duplicate], '2026-08-15').evseCount, 33);
  const catalog = normalizeAtlanteCatalog([rawStation()], '2026-08-15');
  assert.throws(() => mergeAtlanteCatalog([], catalog, { scope: 'all_official_france', stationCount: 10 }), /Variation brutale/);
});

test('publie seulement les stations rapides sans retirer leurs EVSE moins puissants', () => {
  const slow = rawStation({
    id: 'FRATLFR00050',
    evses: [{ evse_id: 'FR*ATL*SLOW*1', connectors: [{ standard: 'IEC_62196_T2_COMBO', max_electric_power: 50000 }] }]
  });
  const unknown = rawStation({
    id: 'FRATLFR00000',
    evses: [{ evse_id: 'FR*ATL*UNKNOWN*1', connectors: [{ standard: 'IEC_62196_T2_COMBO', max_electric_power: null }] }]
  });
  const catalog = normalizeAtlanteCatalog([slow, rawStation(), unknown], '2026-08-15');
  const result = mergeAtlanteCatalog([], catalog);
  assert.equal(result.stations.length, 1);
  assert.equal(result.stations[0].stationId, 'verified:atlante:fratlfr00716');
  assert.equal(result.stations[0].pointIds.size, 0);
  assert.equal(result.stations[0].officialEvseCount, 34);
  assert.equal(result.stations[0].officialMaxPower, 300);
  assert.deepEqual(buildStatusAssociations(result.stations).pointToStation, {});
  assert.equal(result.counts['hors périmètre rapide'], 1);
  assert.equal(result.counts['puissance inconnue à revoir'], 1);
  assert.equal(result.metadata.publishableStationCount, 1);
  assert.equal(result.metadata.publishableEvseCount, 34);
});

test('qualifie de façon identique les stations mixtes IZIVIA Fast et Atlante', () => {
  const mixed = operator => ({ operator, points: new Map([
    ['slow', { id: 'slow', power: 50 }],
    ['fast', { id: 'fast', power: 150 }]
  ]) });
  assert.deepEqual(qualifyFastStation(mixed('iziviafast')), { category: 'fast', maxPowerKw: 150 });
  assert.deepEqual(qualifyFastStation(mixed('atlante')), { category: 'fast', maxPowerKw: 150 });
  assert.equal(mixed('iziviafast').points.size, 2);
  assert.equal(mixed('atlante').points.size, 2);
});

test('reste déterministe et produit le rapport synthétique', () => {
  const a = rawStation();
  const b = rawStation({ id: 'FRATLFR00999', name: 'Atlante Paris', city: 'Paris', postal_code: '75000', coordinates: { latitude: 48.85, longitude: 2.35 }, evses: [{ evse_id: 'FR*ATL*E999*1', status: 'AVAILABLE', connectors: [{ standard: 'CHADEMO', max_electric_power: 50000 }] }] });
  const left = normalizeAtlanteCatalog([a, b], '2026-08-15');
  const right = normalizeAtlanteCatalog([b, a], '2026-08-15');
  assert.deepEqual(left, right);
  const merged = mergeAtlanteCatalog([], left);
  assert.match(formatAtlanteReport(merged), /Stations officielles : \*\*2\*\*/);
});
