import { createReadStream, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from 'csv-parse';
import { IRVE_NETWORKS, resolveIrveDate } from './irve-networks.mjs';

const [input, output = 'public/irve-fast.json', requestedDate] = process.argv.slice(2);
const statusIndexOutput = join(dirname(output), 'irve-status-index.json');
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

const stations = new Map();
const stationPointIds = new Map();
const parser = createReadStream(input).pipe(parse({ columns: true, relax_quotes: true, skip_empty_lines: true }));

for await (const row of parser) {
  const operator = networkFor(row);
  const power = Number.parseFloat(String(row.puissance_nominale).replace(',', '.'));
  const lat = Number.parseFloat(row.consolidated_latitude);
  const lon = Number.parseFloat(row.consolidated_longitude);
  if (!operator || !Number.isFinite(power) || power < 100 || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  if (lat < 41 || lat > 52 || lon < -6 || lon > 10.5) continue;

  // Plusieurs producteurs réutilisent un identifiant de PDC comme identifiant de
  // station. Une clé géographique évite alors d'afficher chaque prise séparément.
  const id = `${operator}:${lat.toFixed(4)}:${lon.toFixed(4)}`;
  const pointId = String(row.id_pdc_itinerance || '').trim().toUpperCase();
  if (!stationPointIds.has(id)) stationPointIds.set(id, new Set());
  const pointIds = stationPointIds.get(id);
  const isNewPoint = !pointId || !pointIds.has(pointId);
  if (pointId) pointIds.add(pointId);
  const existing = stations.get(id);
  if (existing) {
    existing.power = Math.max(existing.power, power);
    if (operator !== 'engie-vianeo' || isNewPoint) existing.connectors += 1;
    existing.ccs ||= row.prise_type_combo_ccs === 'true' || (operator === 'engie-vianeo' && isTrue(row.prise_type_combo_ccs));
    existing.chademo ||= row.prise_type_chademo === 'true' || (operator === 'engie-vianeo' && isTrue(row.prise_type_chademo));
    continue;
  }

  stations.set(id, {
    id,
    operator,
    name: row.nom_station || row.nom_enseigne || row.nom_operateur,
    address: row.adresse_station || '',
    city: row.consolidated_commune || '',
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
    power,
    connectors: 1,
    ccs: row.prise_type_combo_ccs === 'true' || (operator === 'engie-vianeo' && isTrue(row.prise_type_combo_ccs)),
    chademo: row.prise_type_chademo === 'true' || (operator === 'engie-vianeo' && isTrue(row.prise_type_chademo)),
    access: row.condition_acces || '',
    hours: row.horaires || ''
  });
}

const data = [...stations.values()].sort((a, b) => a.operator.localeCompare(b.operator) || a.name.localeCompare(b.name));
writeFileSync(output, JSON.stringify({ updatedAt: sourceDate, source: 'Base nationale IRVE — data.gouv.fr', stations: data }));
const pointToStation = {};
let associationCount = 0;
const stationsByPoint = new Map();
for (const [stationId, pointIds] of stationPointIds) {
  associationCount += pointIds.size;
  for (const pointId of pointIds) {
    if (!stationsByPoint.has(pointId)) stationsByPoint.set(pointId, new Set());
    stationsByPoint.get(pointId).add(stationId);
    pointToStation[pointId] = stationId;
  }
}
const conflictingPointIds = [...stationsByPoint.values()].filter(stationIds => stationIds.size > 1).length;
writeFileSync(statusIndexOutput, JSON.stringify({
  updatedAt: sourceDate,
  metrics: { pointIds: Object.keys(pointToStation).length, associations: associationCount, conflictingPointIds },
  pointToStation
}));

const counts = Object.fromEntries(IRVE_NETWORKS.map(([key]) => [key, data.filter(item => item.operator === key).length]));
console.log(`Generated ${data.length} fast stations in ${output}`);
console.log(`Generated ${Object.keys(pointToStation).length} status links in ${statusIndexOutput}`);
console.table(counts);
