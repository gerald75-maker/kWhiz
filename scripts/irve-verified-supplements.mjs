import { readFileSync } from 'node:fs';
import { stationDistanceMeters } from './irve-status-associations.mjs';

function normalize(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function textMatches(a, b) {
  const left = normalize(a);
  const right = normalize(b);
  return left && right && (left === right || left.includes(right) || right.includes(left));
}

export function loadVerifiedSupplements(path) {
  const document = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(document.supplements)) throw new Error('Compléments IRVE invalides');
  return document.supplements;
}

export function mergeVerifiedSupplements(stations, supplements) {
  const merged = [...stations];
  const audit = [];
  for (const supplement of [...supplements].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!supplement.id.startsWith('verified:')) throw new Error(`Identifiant de complément non préfixé : ${supplement.id}`);
    if (supplement.provenance !== 'operator_verified' || supplement.temporary !== true) throw new Error(`Complément non vérifié ou non temporaire : ${supplement.id}`);
    const pointIds = new Set(supplement.pointIds || []);
    if (pointIds.size !== supplement.pointIds?.length) throw new Error(`Identifiants de points dupliqués : ${supplement.id}`);
    const nearby = stations.filter(station => stationDistanceMeters(supplement, station) <= 500);
    const equivalent = nearby.filter(station => {
      const sharedPoint = [...pointIds].some(pointId => station.pointIds?.has(pointId));
      return sharedPoint || (station.operator === supplement.operator
        && (textMatches(station.display?.address, supplement.address) || textMatches(station.display?.name, supplement.name)));
    });
    if (equivalent.length === 1) {
      audit.push({ id: supplement.id, state: 'complément devenu supprimable', stationIds: [equivalent[0].stationId] });
      continue;
    }
    if (equivalent.length > 1) {
      audit.push({ id: supplement.id, state: 'conflit nécessitant une revue', stationIds: equivalent.map(item => item.stationId).sort() });
      continue;
    }
    merged.push({
      stationId: supplement.id,
      operator: supplement.operator,
      lat: supplement.lat,
      lon: supplement.lon,
      pointIds,
      sourceStationIds: new Set([supplement.officialSiteId]),
      names: new Set([supplement.name]),
      addresses: new Set([supplement.address]),
      cities: new Set([supplement.city]),
      points: new Map([...pointIds].map(pointId => [pointId, { id: pointId, power: supplement.power, ccs: true, chademo: false }])),
      display: { name: supplement.name, address: supplement.address, city: supplement.city, access: 'Accès libre', hours: '24/7' },
      verifiedSupplement: supplement
    });
    audit.push({
      id: supplement.id,
      state: nearby.length ? 'rapproché d’une station IRVE' : 'toujours absent de l’IRVE',
      stationIds: nearby.map(item => item.stationId).sort()
    });
  }
  return { stations: merged, audit };
}

export function formatVerifiedSupplementsReport(audit) {
  return `\n## Compléments vérifiés\n\n${audit.map(item =>
    `- ${item.id} : **${item.state}**${item.stationIds.length ? ` — proximité : ${item.stationIds.join(', ')}` : ''}`
  ).join('\n')}\n`;
}
