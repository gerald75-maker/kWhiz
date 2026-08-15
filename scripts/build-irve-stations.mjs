import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from 'csv-parse';
import { IRVE_NETWORKS, resolveIrveDate } from './irve-networks.mjs';
import { buildStatusAssociations } from './irve-status-associations.mjs';
import { groupCertainStations } from './irve-station-groups.mjs';
import { preservePublishedStationIds } from './irve-station-identity.mjs';

const args = process.argv.slice(2);
const previousStationsArgument = args.find(arg => arg.startsWith('--previous-stations='));
const previousStatusArgument = args.find(arg => arg.startsWith('--previous-status='));
const positional = args.filter(arg => arg !== previousStationsArgument && arg !== previousStatusArgument);
const [input, output = 'public/irve-fast.json', requestedDate] = positional;
const statusIndexOutput = join(dirname(output), 'irve-status-index.json');
const groupingAuditOutput = join(dirname(output), 'irve-grouping-audit.json');
if (!input) throw new Error('Usage: node scripts/build-irve-stations.mjs <source.csv> [output.json] [source-date]');

const sourceDate = resolveIrveDate({ sourceDate: requestedDate, inputPath: input });

function normalize(value = '') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isTrue(value) {
  return String(value).trim().toLowerCase() === 'true' || String(value).trim() === '1';
}

function networkFor(row) {
  const stationId = String(row.id_station_itinerance || row.id_pdc_itinerance || '').trim().toUpperCase();
  if (stationId.startsWith('FRMFC')) return 'pluginn';
  const haystack = normalize([row.nom_operateur, row.nom_enseigne, row.nom_amenageur, row.nom_station].join(' '));
  return IRVE_NETWORKS.find(([, pattern]) => pattern.test(haystack))?.[0] ?? null;
}

function stableValue(values, fallback = '') {
  return [...values].filter(Boolean).sort((a, b) => normalize(a).localeCompare(normalize(b)) || a.localeCompare(b))[0] || fallback;
}

function stableStationName(names, operatorNames, operator) {
  if (operator === 'engie-vianeo') {
    const brandedNames = [...names].filter(name => /(?:engie\s+)?vianeo/i.test(name));
    if (brandedNames.length) return stableValue(brandedNames);
  }
  const genericNames = new Set([...operatorNames].map(normalize).filter(Boolean));
  const descriptiveNames = [...names].filter(name => !genericNames.has(normalize(name)));
  return stableValue(descriptiveNames.length ? descriptiveNames : names, stableValue(operatorNames));
}

function stableCoordinates(values) {
  return [...values]
    .sort((a, b) => a.lat - b.lat || a.lon - b.lon)[0];
}

function mergePoint(points, point) {
  const existing = points.get(point.id);
  if (!existing) {
    points.set(point.id, point);
    return;
  }
  existing.power = Math.max(existing.power, point.power);
  existing.ccs ||= point.ccs;
  existing.chademo ||= point.chademo;
}

const rawStations = new Map();
const parser = createReadStream(input).pipe(parse({ columns: true, relax_quotes: true, skip_empty_lines: true }));

for await (const row of parser) {
  const operator = networkFor(row);
  const power = Number.parseFloat(String(row.puissance_nominale).replace(',', '.'));
  const lat = Number.parseFloat(row.consolidated_latitude);
  const lon = Number.parseFloat(row.consolidated_longitude);
  if (!operator || !Number.isFinite(power) || power < 100 || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  if (lat < 41 || lat > 52 || lon < -6 || lon > 10.5) continue;

  // La clé historique est conservée pour préserver les identifiants existants.
  const stationId = `${operator}:${lat.toFixed(4)}:${lon.toFixed(4)}`;
  if (!rawStations.has(stationId)) {
    rawStations.set(stationId, {
      stationId,
      operator,
      coordinateVariants: new Map(),
      points: new Map(),
      pointIds: new Set(),
      sourceStationIds: new Set(),
      names: new Set(),
      addresses: new Set(),
      cities: new Set(),
      accesses: new Set(),
      hoursVariants: new Set(),
      operatorNames: new Set()
    });
  }
  const station = rawStations.get(stationId);
  station.coordinateVariants.set(`${lat},${lon}`, { lat, lon });
  const pointId = String(row.id_pdc_itinerance || '').trim().toUpperCase();
  if (pointId) {
    mergePoint(station.points, {
      id: pointId,
      power,
      ccs: isTrue(row.prise_type_combo_ccs),
      chademo: isTrue(row.prise_type_chademo)
    });
    station.pointIds.add(pointId);
  }
  const sourceStationId = String(row.id_station_itinerance || '').trim().toUpperCase();
  if (sourceStationId) station.sourceStationIds.add(sourceStationId);
  if (row.nom_station) station.names.add(row.nom_station);
  if (row.nom_enseigne) station.names.add(row.nom_enseigne);
  if (row.adresse_station) station.addresses.add(row.adresse_station);
  if (row.consolidated_commune) station.cities.add(row.consolidated_commune);
  if (row.condition_acces) station.accesses.add(row.condition_acces);
  if (row.horaires) station.hoursVariants.add(row.horaires);
  if (row.nom_operateur) station.operatorNames.add(row.nom_operateur);
}

const preparedStations = [...rawStations.values()].map(station => {
  const coordinates = stableCoordinates(station.coordinateVariants.values());
  return {
    ...station,
    lat: coordinates.lat,
    lon: coordinates.lon,
    display: {
      name: stableStationName(station.names, station.operatorNames, station.operator),
      address: stableValue(station.addresses),
      city: stableValue(station.cities),
      access: stableValue(station.accesses),
      hours: stableValue(station.hoursVariants)
    }
  };
});

const grouped = groupCertainStations(preparedStations);
const previousStations = previousStationsArgument
  ? JSON.parse(readFileSync(previousStationsArgument.slice('--previous-stations='.length), 'utf8'))
  : null;
const previousStatus = previousStatusArgument
  ? JSON.parse(readFileSync(previousStatusArgument.slice('--previous-status='.length), 'utf8'))
  : null;
const stabilized = previousStations && previousStatus
  ? preservePublishedStationIds(grouped.stations, previousStations, previousStatus)
  : { stations: grouped.stations, renames: {} };
grouped.stations = stabilized.stations;
for (const [alias, canonical] of Object.entries(grouped.stationAliases)) {
  if (stabilized.renames[canonical]) grouped.stationAliases[alias] = stabilized.renames[canonical];
}
const data = grouped.stations.map(station => {
  const points = [...station.points.values()];
  return {
    id: station.stationId,
    operator: station.operator,
    name: station.display.name,
    address: station.display.address,
    city: station.display.city,
    lat: Number(station.lat.toFixed(6)),
    lon: Number(station.lon.toFixed(6)),
    power: Math.max(...points.map(point => point.power)),
    connectors: station.pointIds.size,
    ccs: points.some(point => point.ccs),
    chademo: points.some(point => point.chademo),
    access: station.display.access,
    hours: station.display.hours
  };
}).sort((a, b) => a.operator.localeCompare(b.operator) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

const metadataConflicts = grouped.grouping.metadataConflicts;
const grouping = {
  certainGroups: grouped.grouping.certainGroups,
  probableGroups: grouped.grouping.probableGroups,
  ambiguousGroups: grouped.grouping.ambiguousGroups,
  removedStations: grouped.grouping.removedStations,
  aliases: Object.keys(grouped.stationAliases).length,
  metadataConflictCount: metadataConflicts.length
};
writeFileSync(output, JSON.stringify({
  updatedAt: sourceDate,
  source: 'Base nationale IRVE — data.gouv.fr',
  grouping,
  stations: data
}));

writeFileSync(groupingAuditOutput, JSON.stringify({
  updatedAt: sourceDate,
  grouping,
  stationAliases: grouped.stationAliases,
  metadataConflicts
}, null, 2));

const statusMetadata = grouped.stations.map(station => ({
  stationId: station.stationId,
  operator: station.operator,
  lat: station.lat,
  lon: station.lon,
  pointIds: station.pointIds,
  sourceStationIds: station.sourceStationIds,
  names: station.names,
  addresses: station.addresses,
  cities: station.cities
}));
const statusAssociations = buildStatusAssociations(statusMetadata);
writeFileSync(statusIndexOutput, JSON.stringify({
  updatedAt: sourceDate,
  stationAliases: grouped.stationAliases,
  ...statusAssociations
}));

const counts = Object.fromEntries(IRVE_NETWORKS.map(([key]) => [key, data.filter(item => item.operator === key).length]));
console.log(`Generated ${data.length} fast stations in ${output}`);
console.log(`Grouped ${grouping.certainGroups} certain visual duplicates (${grouping.aliases} aliases)`);
console.log(`Preserved ${Object.keys(stabilized.renames).length} published station identifiers`);
console.log(`Kept ${grouping.probableGroups} probable and ${grouping.ambiguousGroups} ambiguous groups separate`);
console.log(`Wrote grouping audit to ${groupingAuditOutput}`);
console.log(`Generated ${statusAssociations.metrics.indexedPointIds} safe status links in ${statusIndexOutput}`);
console.table(counts);
