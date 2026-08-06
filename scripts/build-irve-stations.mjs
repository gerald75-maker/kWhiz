import { createReadStream, writeFileSync } from 'node:fs';
import { parse } from 'csv-parse';

const [input, output = 'public/irve-fast.json'] = process.argv.slice(2);
if (!input) throw new Error('Usage: node scripts/build-irve-stations.mjs <source.csv> [output.json]');

const NETWORKS = [
  ['ionity', /\bionity\b/],
  ['tesla', /\btesla\b|supercharger/],
  ['electra', /\belectra\b/],
  ['iecharge', /\biecharge\b|nw ie charge/],
  ['fastned', /\bfastned\b/],
  ['atlante', /\batlante\b/],
  ['zunder', /\bzunder\b/],
  ['iziviafast', /\bizivia\b/],
  ['lidl', /\blidl\b/],
  ['statione', /\bstation[ -]?e\b/]
];

function normalize(value = '') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function networkFor(row) {
  const haystack = normalize([row.nom_operateur, row.nom_enseigne, row.nom_amenageur, row.nom_station].join(' '));
  return NETWORKS.find(([, pattern]) => pattern.test(haystack))?.[0] ?? null;
}

const stations = new Map();
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
  const existing = stations.get(id);
  if (existing) {
    existing.power = Math.max(existing.power, power);
    existing.connectors += 1;
    existing.ccs ||= row.prise_type_combo_ccs === 'true';
    existing.chademo ||= row.prise_type_chademo === 'true';
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
    ccs: row.prise_type_combo_ccs === 'true',
    chademo: row.prise_type_chademo === 'true',
    access: row.condition_acces || '',
    hours: row.horaires || ''
  });
}

const data = [...stations.values()].sort((a, b) => a.operator.localeCompare(b.operator) || a.name.localeCompare(b.name));
writeFileSync(output, JSON.stringify({ updatedAt: '2026-08-06', source: 'Base nationale IRVE — data.gouv.fr', stations: data }));

const counts = Object.fromEntries(NETWORKS.map(([key]) => [key, data.filter(item => item.operator === key).length]));
console.log(`Generated ${data.length} fast stations in ${output}`);
console.table(counts);
