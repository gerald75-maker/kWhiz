import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIVE_WITHOUT_OWN_STATIONS, IRVE_OPERATOR_KEYS } from './irve-networks.mjs';

export const IRVE_UPDATE_THRESHOLDS = Object.freeze({
  globalDecrease: 0.15,
  globalIncrease: 0.15,
  pointDecrease: 0.25,
  pointIncrease: 0.25,
  conflictIncrease: 0.25,
  operatorDecrease: 0.30,
  operatorIncrease: 0.60
});

function countByOperator(stations) {
  return Object.fromEntries(IRVE_OPERATOR_KEYS.map(key => [key, stations.filter(station => station.operator === key).length]));
}

function variation(before, after) {
  return before > 0 ? (after - before) / before : after > 0 ? Infinity : 0;
}

function percent(value) {
  if (!Number.isFinite(value)) return 'nouveau';
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)} %`;
}

function checkVariation(errors, label, before, after, decreaseLimit, increaseLimit) {
  const delta = variation(before, after);
  if (before > 0 && delta < -decreaseLimit) errors.push(`${label}: baisse anormale (${before} → ${after}, ${percent(delta)}, seuil -${decreaseLimit * 100} %)`);
  if (before > 0 && delta > increaseLimit) errors.push(`${label}: hausse anormale (${before} → ${after}, ${percent(delta)}, seuil +${increaseLimit * 100} %)`);
}

export function analyzeIrveUpdate({ currentStations, candidateStations, currentStatus, candidateStatus, tariffs, thresholds = IRVE_UPDATE_THRESHOLDS }) {
  const errors = [];
  const beforeStations = currentStations.stations || [];
  const afterStations = candidateStations.stations || [];
  const beforeIds = new Set();
  const afterIds = new Set();
  let duplicateStations = 0;
  let invalidCoordinates = 0;

  for (const station of beforeStations) beforeIds.add(station.id);
  for (const station of afterStations) {
    if (afterIds.has(station.id)) duplicateStations++;
    afterIds.add(station.id);
    if (!Number.isFinite(station.lat) || !Number.isFinite(station.lon) || station.lat < 41 || station.lat > 52 || station.lon < -6 || station.lon > 10.5) invalidCoordinates++;
  }
  if (duplicateStations) errors.push(`${duplicateStations} identifiant(s) de station dupliqué(s)`);
  if (invalidCoordinates) errors.push(`${invalidCoordinates} station(s) avec coordonnées invalides`);

  const candidateLinks = Object.entries(candidateStatus.pointToStation || {});
  const multipleLinks = Object.entries(candidateStatus.pointToStations || {});
  const ambiguousCandidates = Object.entries(candidateStatus.ambiguousPointCandidates || {});
  const allCandidateStationIds = [
    ...candidateLinks.map(([, stationId]) => stationId),
    ...multipleLinks.flatMap(([, stationIds]) => Array.isArray(stationIds) ? stationIds : []),
    ...ambiguousCandidates.flatMap(([, stationIds]) => Array.isArray(stationIds) ? stationIds : [])
  ];
  const danglingAssociations = allCandidateStationIds.filter(stationId => !afterIds.has(stationId)).length;
  if (danglingAssociations) errors.push(`${danglingAssociations} association(s) point–station orpheline(s)`);

  const beforePointIds = currentStatus.metrics?.pointIds ?? Object.keys(currentStatus.pointToStation || {}).length;
  const afterPointIds = candidateStatus.metrics?.pointIds ?? candidateLinks.length;
  const indexedPointIds = candidateLinks.length;
  const beforeAssociations = currentStatus.metrics?.associations ?? null;
  const afterAssociations = candidateStatus.metrics?.associations ?? afterPointIds;
  const beforeConflictingPointIds = currentStatus.metrics?.conflictingPointIds ?? null;
  const conflictingPointIds = candidateStatus.metrics?.conflictingPointIds ?? 0;
  const resolvedNearbyConflicts = candidateStatus.metrics?.resolvedNearbyConflicts ?? 0;
  const ambiguousPointIds = candidateStatus.metrics?.ambiguousPointIds ?? 0;
  const distantConflicts = candidateStatus.metrics?.distantConflicts ?? 0;
  const overwrittenAssociations = candidateStatus.metrics?.overwrittenAssociations ?? null;
  const ambiguousIds = candidateStatus.ambiguousPointIds || [];
  const ambiguousCandidateIds = Object.keys(candidateStatus.ambiguousPointCandidates || {});
  const totalClassifiedPointIds = indexedPointIds + ambiguousIds.length;
  if (candidateStatus.metrics?.pointIds !== undefined && candidateStatus.metrics.pointIds !== totalClassifiedPointIds) {
    errors.push(`Métrique pointIds incohérente (${candidateStatus.metrics.pointIds} annoncés, ${totalClassifiedPointIds} classés)`);
  }
  if (candidateStatus.metrics?.indexedPointIds !== undefined && candidateStatus.metrics.indexedPointIds !== indexedPointIds) {
    errors.push(`Métrique indexedPointIds incohérente (${candidateStatus.metrics.indexedPointIds} annoncés, ${indexedPointIds} indexés)`);
  }
  if (ambiguousPointIds !== ambiguousIds.length) errors.push(`Métrique ambiguousPointIds incohérente (${ambiguousPointIds} annoncés, ${ambiguousIds.length} listés)`);
  if (new Set(ambiguousIds).size !== ambiguousIds.length) errors.push('Identifiants ambigus dupliqués');
  if (JSON.stringify(ambiguousIds) !== JSON.stringify([...ambiguousIds].sort())) errors.push('Identifiants ambigus non déterministes');
  if (JSON.stringify(ambiguousIds) !== JSON.stringify(ambiguousCandidateIds)) errors.push('Candidats ambigus incomplets ou non déterministes');
  if (ambiguousIds.some(pointId => candidateStatus.pointToStation?.[pointId] || candidateStatus.pointToStations?.[pointId])) {
    errors.push('Identifiant ambigu encore attribué à une station');
  }
  for (const [pointId, stationIds] of multipleLinks) {
    const sorted = Array.isArray(stationIds) ? [...new Set(stationIds)].sort() : [];
    if (sorted.length < 2 || JSON.stringify(stationIds) !== JSON.stringify(sorted)) errors.push(`Association multiple non déterministe ou invalide : ${pointId}`);
    if (candidateStatus.pointToStation?.[pointId] !== sorted[0]) errors.push(`Repli pointToStation incohérent : ${pointId}`);
  }
  for (const [pointId, stationIds] of ambiguousCandidates) {
    const sorted = Array.isArray(stationIds) ? [...new Set(stationIds)].sort() : [];
    if (sorted.length < 2 || JSON.stringify(stationIds) !== JSON.stringify(sorted)) errors.push(`Candidats ambigus non déterministes ou invalides : ${pointId}`);
  }
  const computedAssociations = indexedPointIds - multipleLinks.length
    + multipleLinks.reduce((total, [, stationIds]) => total + (Array.isArray(stationIds) ? stationIds.length : 0), 0)
    + ambiguousCandidates.reduce((total, [, stationIds]) => total + (Array.isArray(stationIds) ? stationIds.length : 0), 0);
  if (afterAssociations !== computedAssociations) errors.push(`Métrique associations incohérente (${afterAssociations} annoncées, ${computedAssociations} conservées)`);
  if (conflictingPointIds !== multipleLinks.length + ambiguousIds.length) errors.push(`Métrique conflictingPointIds incohérente (${conflictingPointIds} annoncés, ${multipleLinks.length + ambiguousIds.length} classés)`);
  if (resolvedNearbyConflicts !== multipleLinks.length) errors.push(`Métrique resolvedNearbyConflicts incohérente (${resolvedNearbyConflicts} annoncés, ${multipleLinks.length} résolus)`);
  if (distantConflicts > ambiguousIds.length) errors.push(`Métrique distantConflicts incohérente (${distantConflicts} > ${ambiguousIds.length})`);
  if (overwrittenAssociations !== null && overwrittenAssociations !== 0) errors.push(`Associations encore écrasées : ${overwrittenAssociations}`);
  if (afterAssociations < afterPointIds) errors.push(`Associations point–station inférieures aux identifiants de points (${afterAssociations} < ${afterPointIds})`);
  if (candidateStations.updatedAt < currentStations.updatedAt) {
    errors.push(`Date source antérieure aux données publiées (${currentStations.updatedAt} → ${candidateStations.updatedAt})`);
  }

  const beforeByOperator = countByOperator(beforeStations);
  const afterByOperator = countByOperator(afterStations);
  const activeOperators = Object.entries(tariffs)
    .filter(([, operator]) => Array.isArray(operator?.formulas))
    .map(([key]) => key);
  const unsupportedActive = activeOperators.filter(key => !IRVE_OPERATOR_KEYS.includes(key) && !ACTIVE_WITHOUT_OWN_STATIONS.includes(key));
  if (unsupportedActive.length) errors.push(`Opérateur(s) actif(s) sans règle IRVE : ${unsupportedActive.join(', ')}`);
  const absentActive = activeOperators.filter(key => IRVE_OPERATOR_KEYS.includes(key) && !afterByOperator[key]);
  if (absentActive.length) errors.push(`Opérateur(s) actif(s) absent(s) de la nouvelle base : ${absentActive.join(', ')}`);

  checkVariation(errors, 'Stations globales', beforeStations.length, afterStations.length, thresholds.globalDecrease, thresholds.globalIncrease);
  checkVariation(errors, 'Identifiants de points', beforePointIds, afterPointIds, thresholds.pointDecrease, thresholds.pointIncrease);
  if (beforeAssociations !== null) {
    checkVariation(errors, 'Associations point–station', beforeAssociations, afterAssociations, thresholds.pointDecrease, thresholds.pointIncrease);
  }
  if (beforeConflictingPointIds !== null && beforeConflictingPointIds > 0) {
    checkVariation(errors, 'Identifiants associés à plusieurs stations', beforeConflictingPointIds, conflictingPointIds, thresholds.conflictIncrease, thresholds.conflictIncrease);
  }
  for (const key of IRVE_OPERATOR_KEYS) {
    checkVariation(errors, `Stations ${key}`, beforeByOperator[key], afterByOperator[key], thresholds.operatorDecrease, thresholds.operatorIncrease);
  }

  const report = {
    sourceDate: candidateStations.updatedAt,
    before: { stations: beforeStations.length, pointIds: beforePointIds, associations: beforeAssociations, conflictingPointIds: beforeConflictingPointIds },
    after: { stations: afterStations.length, pointIds: afterPointIds, indexedPointIds, associations: afterAssociations },
    duplicateStations,
    invalidCoordinates,
    danglingAssociations,
    conflictingPointIds,
    resolvedNearbyConflicts,
    ambiguousPointIds,
    distantConflicts,
    overwrittenAssociations,
    operators: Object.fromEntries(IRVE_OPERATOR_KEYS.map(key => [key, {
      before: beforeByOperator[key], after: afterByOperator[key], variation: variation(beforeByOperator[key], afterByOperator[key])
    }])),
    errors
  };
  return report;
}

export function formatIrveReport(report) {
  const rows = Object.entries(report.operators).map(([key, item]) => `| ${key} | ${item.before} | ${item.after} | ${percent(item.variation)} |`).join('\n');
  const beforeAssociations = report.before.associations ?? 'indisponible (ancien format)';
  return `## Actualisation de la Base nationale IRVE\n\n` +
    `- Date de la source : **${report.sourceDate}**\n` +
    `- Stations : **${report.before.stations} → ${report.after.stations}**\n` +
    `- Identifiants de points : **${report.before.pointIds} → ${report.after.pointIds}**\n` +
    `- Associations point–station : **${beforeAssociations} → ${report.after.associations}**\n` +
    `- Coordonnées invalides : **${report.invalidCoordinates}**\n` +
    `- Doublons de station : **${report.duplicateStations}**\n` +
    `- Associations orphelines : **${report.danglingAssociations}**\n` +
    `- Identifiants associés à plusieurs stations : **${report.conflictingPointIds}**\n` +
    `- Conflits proches résolus : **${report.resolvedNearbyConflicts}**\n` +
    `- Conflits ambigus exclus : **${report.ambiguousPointIds}**\n` +
    `- Conflits dépassant 500 m : **${report.distantConflicts}**\n` +
    `- Associations encore écrasées : **${report.overwrittenAssociations ?? 'indisponible (ancien format)'}**\n\n` +
    `| Opérateur | Avant | Après | Écart |\n| --- | ---: | ---: | ---: |\n${rows}\n\n` +
    (report.errors.length ? `### Échec des contrôles\n\n${report.errors.map(error => `- ${error}`).join('\n')}\n` : `Tous les contrôles de variation sont satisfaits.\n`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function run() {
  const [currentStationsPath, candidateStationsPath, currentStatusPath, candidateStatusPath, tariffsPath, reportPath] = process.argv.slice(2);
  if (!tariffsPath) throw new Error('Usage: node scripts/validate-irve-update.mjs <current-stations> <candidate-stations> <current-status> <candidate-status> <tariffs> [report.md]');
  const report = analyzeIrveUpdate({
    currentStations: readJson(currentStationsPath), candidateStations: readJson(candidateStationsPath),
    currentStatus: readJson(currentStatusPath), candidateStatus: readJson(candidateStatusPath), tariffs: readJson(tariffsPath)
  });
  const markdown = formatIrveReport(report);
  process.stdout.write(markdown);
  if (reportPath) appendFileSync(reportPath, markdown);
  if (report.errors.length) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
