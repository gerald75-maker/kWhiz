import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ACTIVE_WITHOUT_OWN_STATIONS, IRVE_OPERATOR_KEYS, resolveIrveDate } from '../scripts/irve-networks.mjs';
import { analyzeIrveUpdate, formatIrveReport, IRVE_UPDATE_THRESHOLDS } from '../scripts/validate-irve-update.mjs';

const root = new URL('../', import.meta.url);

function fixture(countPerOperator = 10, date = '2026-08-11') {
  const stations = [];
  const pointToStation = {};
  for (const [operatorIndex, operator] of IRVE_OPERATOR_KEYS.entries()) {
    for (let index = 0; index < countPerOperator; index++) {
      const id = `${operator}:46.${operatorIndex}${index}:2.${index}`;
      stations.push({ id, operator, lat: 46 + operatorIndex / 100, lon: 2 + index / 100, power: 150, connectors: 1 });
      pointToStation[`${operator}-${index}`] = id;
    }
  }
  return {
    stations: { updatedAt: date, stations },
    status: {
      updatedAt: date,
      metrics: { pointIds: stations.length, indexedPointIds: stations.length, associations: stations.length, conflictingPointIds: 0, resolvedNearbyConflicts: 0, ambiguousPointIds: 0, distantConflicts: 0, overwrittenAssociations: 0 },
      pointToStation,
      pointToStations: {},
      ambiguousPointIds: [],
      ambiguousPointCandidates: {}
    }
  };
}

function activeTariffs() {
  return Object.fromEntries([...IRVE_OPERATOR_KEYS, ...ACTIVE_WITHOUT_OWN_STATIONS].map(key => [key, { formulas: [{}] }]));
}

test('détermine la date IRVE depuis la source, le nom de fichier ou UTC', () => {
  assert.equal(resolveIrveDate({ sourceDate: '2026-09-02', inputPath: 'source.csv' }), '2026-09-02');
  assert.equal(resolveIrveDate({ inputPath: 'consolidation-v2.3.1-20260903.csv' }), '2026-09-03');
  assert.equal(resolveIrveDate({ inputPath: 'source.csv', now: new Date('2026-09-04T23:59:00Z') }), '2026-09-04');
  assert.throws(() => resolveIrveDate({ sourceDate: '02/09/2026' }), /Date IRVE invalide/);
});

test('accepte une évolution hebdomadaire modérée et produit le rapport PR', () => {
  const current = fixture(10);
  const candidate = fixture(11, '2026-08-18');
  const report = analyzeIrveUpdate({ currentStations: current.stations, candidateStations: candidate.stations, currentStatus: current.status, candidateStatus: candidate.status, tariffs: activeTariffs() });
  assert.deepEqual(report.errors, []);
  const markdown = formatIrveReport(report);
  assert.match(markdown, /Date de la source : \*\*2026-08-18\*\*/);
  assert.match(markdown, /Stations : \*\*110 → 121\*\*/);
  assert.match(markdown, /\| engie-vianeo \| 10 \| 11 \| \+10\.0 % \|/);
  assert.match(markdown, /Conflits proches résolus : \*\*0\*\*/);
  assert.match(markdown, /Associations encore écrasées : \*\*0\*\*/);
});


test('amorce les associations lorsque le fichier publié utilise encore l’ancien format', () => {
  const current = fixture(10);
  delete current.status.metrics;
  const candidate = fixture(10, '2026-08-18');
  const pointIds = Object.keys(candidate.status.pointToStation).slice(0, 35);
  for (const [index, pointId] of pointIds.entries()) {
    const currentStationId = candidate.status.pointToStation[pointId];
    const otherStationId = candidate.stations.stations[(index + 1) % candidate.stations.stations.length].id;
    const stationIds = [currentStationId, otherStationId].sort();
    candidate.status.pointToStation[pointId] = stationIds[0];
    candidate.status.pointToStations[pointId] = stationIds;
  }
  candidate.status.metrics.associations = 145;
  candidate.status.metrics.conflictingPointIds = 35;
  candidate.status.metrics.resolvedNearbyConflicts = 35;
  const report = analyzeIrveUpdate({ currentStations: current.stations, candidateStations: candidate.stations, currentStatus: current.status, candidateStatus: candidate.status, tariffs: activeTariffs() });
  assert.deepEqual(report.errors, []);
  assert.match(formatIrveReport(report), /indisponible \(ancien format\) → 145/);
});

test('refuse disparition, variation de points et opérateur sans règle', () => {
  const current = fixture(10);
  const candidate = fixture(10, '2026-08-18');
  candidate.stations.stations = candidate.stations.stations.filter(station => station.operator !== 'engie-vianeo');
  candidate.status.pointToStation = {};
  candidate.status.metrics = { pointIds: 0, indexedPointIds: 0, associations: 0, conflictingPointIds: 0, resolvedNearbyConflicts: 0, ambiguousPointIds: 0, distantConflicts: 0, overwrittenAssociations: 0 };
  const tariffs = { ...activeTariffs(), inconnu: { formulas: [{}] } };
  const report = analyzeIrveUpdate({ currentStations: current.stations, candidateStations: candidate.stations, currentStatus: current.status, candidateStatus: candidate.status, tariffs });
  assert.ok(report.errors.some(error => /absent.*engie-vianeo/.test(error)));
  assert.ok(report.errors.some(error => /Identifiants de points.*baisse anormale/.test(error)));
  assert.ok(report.errors.some(error => /sans règle IRVE.*inconnu/.test(error)));
});

test('refuse les variations anormales globales et par opérateur', () => {
  const current = fixture(10);
  const candidate = fixture(10, '2026-08-18');
  const template = candidate.stations.stations.find(station => station.operator === 'engie-vianeo');
  for (let index = 0; index < 7; index++) {
    candidate.stations.stations.push({ ...template, id: `engie-vianeo:extra:${index}`, lat: 47, lon: 3 + index / 100 });
  }
  let report = analyzeIrveUpdate({ currentStations: current.stations, candidateStations: candidate.stations, currentStatus: current.status, candidateStatus: candidate.status, tariffs: activeTariffs() });
  assert.ok(report.errors.some(error => /Stations engie-vianeo.*hausse anormale/.test(error)));

  candidate.stations.stations = candidate.stations.stations.slice(0, 80);
  report = analyzeIrveUpdate({ currentStations: current.stations, candidateStations: candidate.stations, currentStatus: current.status, candidateStatus: candidate.status, tariffs: activeTariffs() });
  assert.ok(report.errors.some(error => /Stations globales.*baisse anormale/.test(error)));
});

test('refuse coordonnées, doublons, associations orphelines et date antérieure', () => {
  const current = fixture(10);
  const candidate = fixture(10, '2026-08-01');
  candidate.stations.stations[0].lat = 90;
  candidate.stations.stations[1].id = candidate.stations.stations[0].id;
  candidate.status.pointToStation.orphan = 'station-inconnue';
  const report = analyzeIrveUpdate({ currentStations: current.stations, candidateStations: candidate.stations, currentStatus: current.status, candidateStatus: candidate.status, tariffs: activeTariffs() });
  assert.ok(report.errors.some(error => /coordonnées invalides/.test(error)));
  assert.ok(report.errors.some(error => /station dupliqué/.test(error)));
  assert.ok(report.errors.some(error => /orpheline/.test(error)));
  assert.ok(report.errors.some(error => /Date source antérieure/.test(error)));
});

test('refuse une association ambiguë publiée ou encore écrasée', () => {
  const current = fixture(10);
  const candidate = fixture(10, '2026-08-18');
  const pointId = Object.keys(candidate.status.pointToStation)[0];
  const stationIds = candidate.stations.stations.slice(0, 2).map(station => station.id).sort();
  candidate.status.ambiguousPointIds = [pointId];
  candidate.status.ambiguousPointCandidates = { [pointId]: stationIds };
  candidate.status.metrics.ambiguousPointIds = 1;
  candidate.status.metrics.conflictingPointIds = 1;
  candidate.status.metrics.associations += 1;
  candidate.status.metrics.overwrittenAssociations = 1;
  const report = analyzeIrveUpdate({ currentStations: current.stations, candidateStations: candidate.stations, currentStatus: current.status, candidateStatus: candidate.status, tariffs: activeTariffs() });
  assert.ok(report.errors.some(error => /Identifiant ambigu encore attribué/.test(error)));
  assert.ok(report.errors.some(error => /Associations encore écrasées/.test(error)));
});

test('documente des seuils relatifs non liés aux volumes courants', () => {
  assert.deepEqual(IRVE_UPDATE_THRESHOLDS, { globalDecrease: 0.15, globalIncrease: 0.15, pointDecrease: 0.25, pointIncrease: 0.25, conflictIncrease: 0.25, operatorDecrease: 0.30, operatorIncrease: 0.60 });
});

test('autorise ponctuellement une migration entièrement couverte par des alias', () => {
  const current = fixture(10);
  const candidate = fixture(10, '2026-08-18');
  const removed = candidate.stations.stations.filter((_, index) => index % 5 === 0);
  const removedIds = new Set(removed.map(station => station.id));
  const aliases = {};
  for (const station of removed) {
    const canonical = candidate.stations.stations.find(item => item.operator === station.operator && !removedIds.has(item.id));
    aliases[station.id] = canonical.id;
    for (const [pointId, stationId] of Object.entries(candidate.status.pointToStation)) {
      if (stationId === station.id) candidate.status.pointToStation[pointId] = canonical.id;
    }
  }
  candidate.stations.stations = candidate.stations.stations.filter(station => !aliases[station.id]);
  candidate.status.stationAliases = Object.fromEntries(Object.entries(aliases).sort());
  candidate.stations.grouping = { aliases: removed.length, removedStations: removed.length, certainGroups: removed.length, probableGroups: 0, ambiguousGroups: 0, metadataConflictCount: 1 };
  const groupingAudit = {
    grouping: candidate.stations.grouping,
    stationAliases: candidate.status.stationAliases,
    metadataConflicts: [{ canonicalId: Object.values(aliases)[0], fields: [{ field: 'access', kept: 'Libre', alternatives: ['Libre', 'Réservé'] }] }]
  };

  let report = analyzeIrveUpdate({ currentStations: current.stations, candidateStations: candidate.stations, currentStatus: current.status, candidateStatus: candidate.status, tariffs: activeTariffs() });
  assert.ok(report.errors.some(error => /Stations globales.*baisse anormale/.test(error)));
  report = analyzeIrveUpdate({ currentStations: current.stations, candidateStations: candidate.stations, currentStatus: current.status, candidateStatus: candidate.status, tariffs: activeTariffs(), groupingAudit, allowStationAliasMigration: true });
  assert.deepEqual(report.errors, []);
  assert.equal(report.stationAliasMigrationValid, true);
  assert.match(formatIrveReport(report), /Migration ponctuelle d’alias : \*\*autorisée et valide\*\*/);
  assert.match(formatIrveReport(report), /Stations avec conflits de métadonnées[\s\S]*access/);

  delete candidate.status.stationAliases[removed[0].id];
  report = analyzeIrveUpdate({ currentStations: current.stations, candidateStations: candidate.stations, currentStatus: current.status, candidateStatus: candidate.status, tariffs: activeTariffs(), groupingAudit, allowStationAliasMigration: true });
  assert.ok(report.errors.some(error => /Migration d’alias refusée/.test(error)));
});

test('le workflow est hebdomadaire, manuel, officiel et limité aux deux JSON', async () => {
  const workflow = await readFile(new URL('.github/workflows/update-irve.yml', root), 'utf8');
  assert.match(workflow, /schedule:[\s\S]*cron: '23 4 \* \* 3'/);
  assert.match(workflow, /pull_request:[\s\S]*scripts\/\*irve\*\.mjs/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /allow_station_alias_migration/);
  assert.match(workflow, /--allow-station-alias-migration/);
  assert.match(workflow, /--grouping-audit=.*irve-grouping-audit\.json/);
  assert.match(workflow, /--previous-stations=public\/irve-fast\.json/);
  assert.match(workflow, /--previous-status=public\/irve-status-index\.json/);
  assert.match(workflow, /--atlante-source=.*steps\.atlante\.outputs\.json/);
  assert.match(workflow, /candidate\/irve-grouping-audit\.json/);
  assert.match(workflow, /https:\/\/www\.data\.gouv\.fr\/api\/1\/datasets\/r\/eb76d20a-8501-400e-b336-d85724de5435/);
  assert.match(workflow, /static\.data\.gouv\.fr\/resources\/base-nationale-des-irve/);
  assert.match(workflow, /https:\/\/map\.atlante\.energy\/geodata\.json/);
  assert.match(workflow, /git add -- public\/irve-fast\.json public\/irve-status-index\.json/);
  assert.doesNotMatch(workflow, /git add --[^\n]*irve-grouping-audit/);
  assert.match(workflow, /gh pr create/);
  assert.match(workflow, /gh pr edit/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /tests\/service-worker\.test\.js tests\/version-consistency\.test\.js/);
  assert.match(workflow, /php -l public\/status\.php/);
  assert.match(workflow, /php tests\/irve-status-associations\.php/);
  assert.match(workflow, /git diff --check/);
  assert.match(workflow, /steps\.base\.outputs\.publish == 'true'/);
  assert.doesNotMatch(workflow, /git add -A|gh pr merge|npm version|deploy/i);
});

test('le registre couvre tous les opérateurs actifs ou leur exception documentée', async () => {
  const tariffs = JSON.parse(await readFile(new URL('public/tarifs.json', root), 'utf8'));
  const active = Object.entries(tariffs).filter(([, operator]) => Array.isArray(operator?.formulas)).map(([key]) => key);
  assert.deepEqual(active.filter(key => !IRVE_OPERATOR_KEYS.includes(key)), ['electroverse']);
  assert.deepEqual(ACTIVE_WITHOUT_OWN_STATIONS, ['electroverse']);
  assert.ok(IRVE_OPERATOR_KEYS.includes('engie-vianeo'));
});
