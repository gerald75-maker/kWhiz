const MAX_SAFE_DISTANCE_METERS = 500;

function normalized(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizedSet(values = []) {
  return new Set([...values].map(normalized).filter(Boolean));
}

function intersects(left, right) {
  return [...left].some(value => right.has(value));
}

function tokens(value) {
  return new Set(value.split(' ').filter(token => token.length > 1));
}

function textCompatible(leftValues, rightValues) {
  const left = normalizedSet(leftValues);
  const right = normalizedSet(rightValues);
  if (!left.size || !right.size) return false;
  if (intersects(left, right)) return true;

  for (const a of left) {
    for (const b of right) {
      if (a.length >= 8 && b.length >= 8 && (a.includes(b) || b.includes(a))) return true;
      const aTokens = tokens(a);
      const bTokens = tokens(b);
      const common = [...aTokens].filter(token => bTokens.has(token)).length;
      const union = new Set([...aTokens, ...bTokens]).size;
      if (union && common / union >= 0.6) return true;
    }
  }
  return false;
}

export function stationDistanceMeters(a, b) {
  const radius = 6_371_000;
  const radians = value => value * Math.PI / 180;
  const deltaLat = radians(b.lat - a.lat);
  const deltaLon = radians(b.lon - a.lon);
  const latitudeA = radians(a.lat);
  const latitudeB = radians(b.lat);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(haversine));
}

export function stationIdentitiesCompatible(a, b) {
  const stationIdsA = normalizedSet(a.sourceStationIds);
  const stationIdsB = normalizedSet(b.sourceStationIds);
  if (stationIdsA.size && stationIdsB.size && intersects(stationIdsA, stationIdsB)) return true;

  const citiesA = normalizedSet(a.cities);
  const citiesB = normalizedSet(b.cities);
  const citiesCompatible = !citiesA.size || !citiesB.size || intersects(citiesA, citiesB);
  const namesCompatible = textCompatible(a.names, b.names);
  const addressesCompatible = textCompatible(a.addresses, b.addresses);
  return citiesCompatible && (namesCompatible || addressesCompatible);
}

function candidatesAreSafe(candidates) {
  for (let left = 0; left < candidates.length; left++) {
    for (let right = left + 1; right < candidates.length; right++) {
      const a = candidates[left];
      const b = candidates[right];
      if (a.operator !== b.operator) return false;
      if (stationDistanceMeters(a, b) > MAX_SAFE_DISTANCE_METERS) return false;
      if (!stationIdentitiesCompatible(a, b)) return false;
    }
  }
  return true;
}

function maxCandidateDistance(candidates) {
  let maximum = 0;
  for (let left = 0; left < candidates.length; left++) {
    for (let right = left + 1; right < candidates.length; right++) {
      maximum = Math.max(maximum, stationDistanceMeters(candidates[left], candidates[right]));
    }
  }
  return maximum;
}

export function buildStatusAssociations(stations) {
  const candidatesByPoint = new Map();
  for (const station of stations) {
    for (const pointId of station.pointIds || []) {
      if (!candidatesByPoint.has(pointId)) candidatesByPoint.set(pointId, []);
      candidatesByPoint.get(pointId).push(station);
    }
  }

  const pointToStation = {};
  const pointToStations = {};
  const ambiguousPointCandidates = {};
  const ambiguousPointIds = [];
  let associations = 0;
  let conflictingPointIds = 0;
  let resolvedNearbyConflicts = 0;
  let distantConflicts = 0;

  for (const pointId of [...candidatesByPoint.keys()].sort()) {
    const candidates = candidatesByPoint.get(pointId)
      .filter((station, index, all) => all.findIndex(item => item.stationId === station.stationId) === index)
      .sort((a, b) => a.stationId.localeCompare(b.stationId));
    const stationIds = candidates.map(station => station.stationId);
    associations += stationIds.length;

    if (stationIds.length === 1) {
      pointToStation[pointId] = stationIds[0];
      continue;
    }

    conflictingPointIds++;
    const maximumDistance = maxCandidateDistance(candidates);
    if (maximumDistance > MAX_SAFE_DISTANCE_METERS) distantConflicts++;
    if (candidatesAreSafe(candidates)) {
      pointToStation[pointId] = stationIds[0];
      pointToStations[pointId] = stationIds;
      resolvedNearbyConflicts++;
    } else {
      ambiguousPointIds.push(pointId);
      ambiguousPointCandidates[pointId] = stationIds;
    }
  }

  return {
    metrics: {
      pointIds: candidatesByPoint.size,
      indexedPointIds: Object.keys(pointToStation).length,
      associations,
      conflictingPointIds,
      resolvedNearbyConflicts,
      ambiguousPointIds: ambiguousPointIds.length,
      distantConflicts,
      overwrittenAssociations: 0
    },
    pointToStation,
    pointToStations,
    ambiguousPointIds,
    ambiguousPointCandidates
  };
}

export { MAX_SAFE_DISTANCE_METERS };
