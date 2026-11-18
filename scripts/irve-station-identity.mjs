import { stationDistanceMeters, stationIdentitiesCompatible } from './irve-status-associations.mjs';

const MAX_STABLE_ID_DISTANCE_METERS = 500;

function previousStationMetadata(station) {
  return {
    stationId: station.id,
    operator: station.operator,
    lat: station.lat,
    lon: station.lon,
    sourceStationIds: new Set(),
    names: new Set([station.name].filter(Boolean)),
    addresses: new Set([station.address].filter(Boolean)),
    cities: new Set([station.city].filter(Boolean))
  };
}

export function preservePublishedStationIds(stations, previousStationsPayload, previousStatus) {
  const previousStations = new Map((previousStationsPayload?.stations || [])
    .map(station => [station.id, previousStationMetadata(station)]));
  const previousPointTargets = previousStatus?.pointToStation || {};
  const currentIds = new Set(stations.map(station => station.stationId));
  const proposals = new Map();

  for (const station of stations) {
    const candidates = new Set([...station.pointIds]
      .map(pointId => previousPointTargets[pointId])
      .filter(Boolean));
    if (candidates.size !== 1) continue;

    const [previousId] = candidates;
    if (previousId === station.stationId) continue;
    const previous = previousStations.get(previousId);
    if (!previous || previous.operator !== station.operator) continue;
    if (currentIds.has(previousId)) continue;
    // Position retenue ou l'une des déclarations fusionnées restée proche.
    const positions = [station, ...(station.coordinateCandidates || [])];
    const nearest = Math.min(...positions.map(position => stationDistanceMeters(previous, position)));
    if (nearest > MAX_STABLE_ID_DISTANCE_METERS) continue;
    if (!stationIdentitiesCompatible(previous, station)) continue;
    proposals.set(station.stationId, previousId);
  }

  const targetCounts = new Map();
  for (const target of proposals.values()) targetCounts.set(target, (targetCounts.get(target) || 0) + 1);
  const renames = new Map([...proposals].filter(([, target]) => targetCounts.get(target) === 1));

  return {
    stations: stations.map(station => renames.has(station.stationId)
      ? { ...station, stationId: renames.get(station.stationId) }
      : station),
    renames: Object.fromEntries([...renames].sort(([left], [right]) => left.localeCompare(right)))
  };
}

// Les déclarations fusionnées d'une station peuvent diverger de plusieurs centaines de
// mètres. On garde alors celle qui est la plus proche de la position déjà publiée : une
// source qui déplace une station ne l'emporte pas tant qu'une autre confirme l'ancienne
// position. Contrôle du 18/11/2026 sur 115 stations Lidl géocodées au numéro : la
// déclaration la plus récente était la moins précise 95 fois.
export function keepPublishedPositions(stations, previousStationsPayload) {
  const published = new Map((previousStationsPayload?.stations || [])
    .map(station => [station.id, station]));

  return stations.map(station => {
    const previous = published.get(station.stationId);
    const candidates = station.coordinateCandidates || [];
    if (!previous || candidates.length < 2) return station;
    // Position qui ne vient d'aucune déclaration (source officielle) : ne pas y toucher.
    if (!candidates.some(item => item.lat === station.lat && item.lon === station.lon)) return station;

    let nearest = null;
    let nearestDistance = Infinity;
    for (const candidate of candidates) {
      const distance = stationDistanceMeters(previous, candidate);
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }
    if (nearestDistance > MAX_STABLE_ID_DISTANCE_METERS) return station;
    if (nearest.lat === station.lat && nearest.lon === station.lon) return station;
    return { ...station, lat: nearest.lat, lon: nearest.lon };
  });
}

export function stabilizeStationAliases(stationAliases, renames) {
  return Object.fromEntries(Object.entries(stationAliases)
    .map(([alias, canonical]) => [alias, renames[canonical] || canonical])
    .filter(([alias, canonical]) => alias !== canonical)
    .sort(([left], [right]) => left.localeCompare(right)));
}

export { MAX_STABLE_ID_DISTANCE_METERS };
