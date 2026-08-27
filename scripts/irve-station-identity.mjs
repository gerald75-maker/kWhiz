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
    if (stationDistanceMeters(previous, station) > MAX_STABLE_ID_DISTANCE_METERS) continue;
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

export function stabilizeStationAliases(stationAliases, renames) {
  return Object.fromEntries(Object.entries(stationAliases)
    .map(([alias, canonical]) => [alias, renames[canonical] || canonical])
    .filter(([alias, canonical]) => alias !== canonical)
    .sort(([left], [right]) => left.localeCompare(right)));
}

export { MAX_STABLE_ID_DISTANCE_METERS };
