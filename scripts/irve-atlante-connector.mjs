import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stationDistanceMeters } from './irve-status-associations.mjs';
import { qualifyFastStation } from './irve-fast-qualification.mjs';

export const ATLANTE_SOURCE_URL = 'https://map.atlante.energy/geodata.json';
export const ATLANTE_MAP_URL = 'https://map.atlante.energy/?iframe=true&lang=fr';
export const ATLANTE_STATION_DECREASE_LIMIT = 0.20;
export const ATLANTE_STATION_INCREASE_LIMIT = 0.50;

function normalizeText(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeId(value = '') {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function textMatches(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const l = new Set(left.split(' ').filter(token => token.length > 2));
  const r = new Set(right.split(' ').filter(token => token.length > 2));
  const common = [...l].filter(token => r.has(token)).length;
  return common >= 2 && common / new Set([...l, ...r]).size >= 0.5;
}

function sha256(values) {
  return createHash('sha256').update([...values].sort().join('\n')).digest('hex');
}

export function normalizeAtlanteCatalog(document, collectedAt) {
  if (!Array.isArray(document)) throw new Error('Catalogue Atlante invalide');
  const seenStations = new Set();
  const stations = document.filter(item => item.country === 'FRA').map(item => {
    if (!item.id || seenStations.has(item.id)) throw new Error(`Identifiant Atlante absent ou dupliqué : ${item.id || '(vide)'}`);
    seenStations.add(item.id);
    const evses = new Map();
    for (const evse of item.evses || []) {
      if (!evse.evse_id) throw new Error(`EVSE Atlante absent dans ${item.id}`);
      const connectors = (evse.connectors || []).filter(value => value && typeof value === 'object');
      const existing = evses.get(evse.evse_id) || { powersKw: [], connectorTypes: [] };
      evses.set(evse.evse_id, {
        id: evse.evse_id,
        powersKw: [...new Set([...existing.powersKw, ...connectors.map(value => Number(value.max_electric_power) / 1000).filter(Number.isFinite)])].sort((a, b) => a - b),
        connectorTypes: [...new Set([...existing.connectorTypes, ...connectors.map(value => value.standard).filter(Boolean)])].sort()
      });
    }
    const lat = Number(item.coordinates?.latitude);
    const lon = Number(item.coordinates?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error(`Coordonnées Atlante invalides : ${item.id}`);
    const points = [...evses.values()].sort((a, b) => a.id.localeCompare(b.id));
    const powersKw = [...new Set(points.flatMap(point => point.powersKw))].sort((a, b) => a - b);
    const connectorTypes = [...new Set(points.flatMap(point => point.connectorTypes))].sort();
    const address = [item.housenumber, item.street, item.postal_code, item.city].map(value => String(value || '').trim()).filter(Boolean).join(' ');
    const verifiedOverride = item.id === 'FRATLFR00716' ? {
      name: "Atlante Saint-Pierre-d'Irube - Centre Commercial Ametzondo Shopping",
      address: "2-4 avenue du Portou, 64990 Saint-Pierre-d'Irube",
      city: "Saint-Pierre-d'Irube"
    } : {};
    return {
      id: item.id,
      stableId: `verified:atlante:${item.id.toLowerCase()}`,
      operator: 'atlante',
      name: String(item.name || '').trim() || `Atlante ${item.city || item.id}`,
      address,
      city: String(item.city || '').trim(),
      postalCode: String(item.postal_code || '').trim(),
      lat, lon,
      evseCount: points.length,
      pointIds: points.map(point => point.id),
      points,
      powersKw,
      maxPowerKw: powersKw.length ? Math.max(...powersKw) : 0,
      connectorTypes,
      collectedAt,
      sourceUrl: ATLANTE_SOURCE_URL,
      officialUrl: ATLANTE_MAP_URL,
      provenance: 'operator_verified',
      temporary: true,
      ...verifiedOverride
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const stationIds = stations.map(station => station.id);
  const evseIds = stations.flatMap(station => station.pointIds);
  return {
    collectedAt,
    sourceUrl: ATLANTE_SOURCE_URL,
    country: 'FRA',
    stationCount: stations.length,
    evseCount: evseIds.length,
    stationIdsSha256: sha256(stationIds),
    evseIdsSha256: sha256(evseIds),
    stations
  };
}

export function loadAtlanteCatalog(path, collectedAt) {
  return normalizeAtlanteCatalog(JSON.parse(readFileSync(path, 'utf8')), collectedAt);
}

function point(station, item) {
  return {
    id: item.id,
    power: item.powersKw.length ? Math.max(...item.powersKw) : station.maxPowerKw,
    ccs: item.connectorTypes.some(value => /COMBO|CCS/i.test(value)),
    chademo: item.connectorTypes.some(value => /CHADEMO/i.test(value))
  };
}

function asGeneratedStation(station) {
  return {
    stationId: station.stableId,
    operator: 'atlante', lat: station.lat, lon: station.lon,
    pointIds: new Set(),
    sourceStationIds: new Set(),
    names: new Set([station.name]), addresses: new Set([station.address]), cities: new Set([station.city]),
    points: new Map(),
    display: { name: station.name, address: station.address, city: station.city, access: 'Accès libre', hours: '24/7' },
    atlanteOfficialId: station.id,
    officialEvseCount: station.evseCount,
    officialMaxPower: station.maxPowerKw,
    officialCcs: station.connectorTypes.some(value => /COMBO|CCS/i.test(value)),
    officialChademo: station.connectorTypes.some(value => /CHADEMO/i.test(value)),
    officialUrl: station.officialUrl,
    atlanteCollectedAt: station.collectedAt,
    provenance: station.provenance
  };
}

function equivalentCandidates(stations, official) {
  const officialPoints = new Set(official.pointIds.map(normalizeId));
  return stations.filter(station => {
    if (station.operator !== 'atlante' || stationDistanceMeters(official, station) > 500) return false;
    const sharedPoint = [...station.pointIds].some(id => officialPoints.has(normalizeId(id)));
    const sharedStation = [...station.sourceStationIds].some(id => normalizeId(id) === normalizeId(official.id));
    const closeIdentity = stationDistanceMeters(official, station) <= 200
      && (textMatches(station.display?.name, official.name) || textMatches(station.display?.address, official.address));
    return sharedPoint || sharedStation || closeIdentity;
  });
}

export function mergeAtlanteCatalog(stations, catalog, previousMetadata = null) {
  if (previousMetadata?.scope === 'all_official_france' && previousMetadata?.stationCount) {
    const delta = (catalog.stationCount - previousMetadata.stationCount) / previousMetadata.stationCount;
    if (delta < -ATLANTE_STATION_DECREASE_LIMIT || delta > ATLANTE_STATION_INCREASE_LIMIT) {
      throw new Error(`Variation brutale du catalogue Atlante (${previousMetadata.stationCount} → ${catalog.stationCount})`);
    }
  }
  const merged = [...stations];
  const audit = [];
  const conflictEvses = new Set();
  const unpublishedEvses = new Set();
  let publishableStationCount = 0;
  let publishableEvseCount = 0;
  for (const official of catalog.stations) {
    const officialStation = asGeneratedStation(official);
    const qualification = qualifyFastStation(officialStation);
    if (qualification.category === 'review') {
      official.pointIds.forEach(id => unpublishedEvses.add(normalizeId(id)));
      audit.push({ id: official.id, category: 'puissance inconnue à revoir', stationIds: [], evseCount: official.evseCount });
      continue;
    }
    if (qualification.category === 'slow') {
      official.pointIds.forEach(id => unpublishedEvses.add(normalizeId(id)));
      audit.push({ id: official.id, category: 'hors périmètre rapide', stationIds: [], evseCount: official.evseCount, maxPowerKw: qualification.maxPowerKw });
      continue;
    }
    publishableStationCount += 1;
    publishableEvseCount += official.evseCount;
    const candidates = equivalentCandidates(stations, official);
    if (candidates.length > 1) {
      official.pointIds.forEach(id => conflictEvses.add(normalizeId(id)));
      audit.push({ id: official.id, category: 'conflit ou ambiguïté', stationIds: candidates.map(item => item.stationId).sort(), evseCount: official.evseCount });
      continue;
    }
    if (candidates.length === 1) {
      const candidate = candidates[0];
      const beforePoints = candidate.pointIds.size;
      const beforePower = Math.max(0, ...candidate.points.values().map(item => item.power));
      candidate.atlanteOfficialId = official.id;
      candidate.officialEvseCount = official.evseCount;
      candidate.officialMaxPower = official.maxPowerKw;
      candidate.officialCcs = official.connectorTypes.some(value => /COMBO|CCS/i.test(value));
      candidate.officialChademo = official.connectorTypes.some(value => /CHADEMO/i.test(value));
      candidate.officialUrl = official.officialUrl;
      candidate.atlanteCollectedAt = official.collectedAt;
      candidate.provenance = official.provenance;
      const enriched = official.evseCount > beforePoints || official.maxPowerKw > beforePower;
      audit.push({ id: official.id, category: enriched ? 'présente mais enrichie par Atlante' : 'déjà présente et cohérente dans l’IRVE', stationIds: [candidate.stationId], evseCount: official.evseCount });
      continue;
    }
    merged.push(officialStation);
    audit.push({ id: official.id, category: 'absente de l’IRVE et ajoutée temporairement depuis Atlante', stationIds: [official.stableId], evseCount: official.evseCount });
  }
  const accountedEvses = audit.reduce((total, item) => total + item.evseCount, 0);
  if (audit.length !== catalog.stationCount || accountedEvses !== catalog.evseCount) {
    throw new Error(`Catalogue Atlante incomplètement classé (${audit.length}/${catalog.stationCount} stations, ${accountedEvses}/${catalog.evseCount} EVSE)`);
  }
  const counts = Object.fromEntries([
    'déjà présente et cohérente dans l’IRVE',
    'présente mais enrichie par Atlante',
    'absente de l’IRVE et ajoutée temporairement depuis Atlante',
    'conflit ou ambiguïté',
    'hors périmètre rapide',
    'puissance inconnue à revoir'
  ].map(category => [category, audit.filter(item => item.category === category).length]));
  return { stations: merged, audit, counts, metadata: {
    scope: 'all_official_france',
    collectedAt: catalog.collectedAt,
    sourceUrl: catalog.sourceUrl,
    stationCount: catalog.stationCount,
    evseCount: catalog.evseCount,
    publishableStationCount,
    publishableEvseCount,
    stationIdsSha256: catalog.stationIdsSha256,
    evseIdsSha256: catalog.evseIdsSha256,
    conflictEvseCount: conflictEvses.size,
    counts
  } };
}

export function formatAtlanteReport(atlante) {
  const c = atlante.metadata.counts;
  return `\n## Catalogue officiel Atlante France\n\n` +
    `- Collecte : **${atlante.metadata.collectedAt}**\n` +
    `- Stations officielles : **${atlante.metadata.stationCount}**\n` +
    `- EVSE physiques uniques : **${atlante.metadata.evseCount}**\n` +
    `- Stations rapides publiables : **${atlante.metadata.publishableStationCount}** (${atlante.metadata.publishableEvseCount} EVSE)\n` +
    `- Déjà couvertes et cohérentes : **${c['déjà présente et cohérente dans l’IRVE']}**\n` +
    `- Présentes mais enrichies : **${c['présente mais enrichie par Atlante']}**\n` +
    `- Ajoutées temporairement : **${c['absente de l’IRVE et ajoutée temporairement depuis Atlante']}**\n` +
    `- Conflits ou ambiguïtés : **${c['conflit ou ambiguïté']}**\n` +
    `- Hors périmètre rapide : **${c['hors périmètre rapide']}**\n` +
    `- Puissance inconnue à revoir : **${c['puissance inconnue à revoir']}**\n` +
    `- EVSE retenus en revue de conflit : **${atlante.metadata.conflictEvseCount}**\n` +
    `- Disponibilité instantanée : **non publiée** (absence de licence explicite de redistribution)\n`;
}
