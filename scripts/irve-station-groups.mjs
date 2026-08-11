export const MAX_CERTAIN_GROUP_DISTANCE_METERS = 100;
export const MAX_VISUAL_CANDIDATE_DISTANCE_METERS = 500;

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

export function visualDuplicateEvidence(a, b) {
  const distanceMeters = stationDistanceMeters(a, b);
  const sameOperator = a.operator === b.operator;
  const sharedPointId = intersects(a.pointIds, b.pointIds);
  const sharedStationId = intersects(a.sourceStationIds, b.sourceStationIds);
  const compatibleName = textCompatible(a.names, b.names);
  const compatibleAddress = textCompatible(a.addresses, b.addresses);
  const citiesA = normalizedSet(a.cities);
  const citiesB = normalizedSet(b.cities);
  const compatibleCity = !citiesA.size || !citiesB.size || intersects(citiesA, citiesB);

  let category = null;
  if (sameOperator && distanceMeters <= MAX_CERTAIN_GROUP_DISTANCE_METERS
      && sharedPointId && compatibleCity && (compatibleName || compatibleAddress)) {
    category = 'certain';
  } else if (sameOperator && distanceMeters <= MAX_CERTAIN_GROUP_DISTANCE_METERS && compatibleCity
      && ((sharedStationId && (compatibleName || compatibleAddress))
        || (!sharedPointId && compatibleName && compatibleAddress))) {
    category = 'probable';
  } else if (sameOperator && distanceMeters <= MAX_VISUAL_CANDIDATE_DISTANCE_METERS
      && (sharedPointId || sharedStationId || compatibleName || compatibleAddress)) {
    category = 'ambiguous';
  }

  return {
    category, distanceMeters, sameOperator, sharedPointId, sharedStationId,
    compatibleName, compatibleAddress, compatibleCity
  };
}

function mergePoint(target, source) {
  const existing = target.get(source.id);
  if (!existing) {
    target.set(source.id, { ...source });
    return;
  }
  existing.power = Math.max(existing.power, source.power);
  existing.ccs ||= source.ccs;
  existing.chademo ||= source.chademo;
}

function metadataConflicts(members, canonicalId) {
  const fields = ['name', 'address', 'city', 'access', 'hours'];
  return fields.filter(field => {
    const values = new Set(members.map(member => normalized(member.display[field])).filter(Boolean));
    return values.size > 1;
  }).map(field => ({
    field,
    kept: members.find(member => member.stationId === canonicalId).display[field],
    alternatives: [...new Set(members.map(member => member.display[field]).filter(Boolean))].sort()
  }));
}

function mergeCertainGroup(members) {
  const sorted = [...members].sort((a, b) => a.stationId.localeCompare(b.stationId));
  const canonical = sorted[0];
  const points = new Map();
  const sourceStationIds = new Set();
  const names = new Set();
  const addresses = new Set();
  const cities = new Set();
  for (const member of sorted) {
    for (const point of member.points.values()) mergePoint(points, point);
    for (const value of member.sourceStationIds) sourceStationIds.add(value);
    for (const value of member.names) names.add(value);
    for (const value of member.addresses) addresses.add(value);
    for (const value of member.cities) cities.add(value);
  }
  const conflicts = metadataConflicts(sorted, canonical.stationId);
  return {
    station: {
      ...canonical,
      points,
      pointIds: new Set(points.keys()),
      sourceStationIds,
      names,
      addresses,
      cities
    },
    aliases: sorted.slice(1).map(member => [member.stationId, canonical.stationId]),
    conflict: conflicts.length ? {
      canonicalId: canonical.stationId,
      mergedIds: sorted.map(member => member.stationId),
      fields: conflicts
    } : null
  };
}

function groupCategory(members) {
  let category = 'certain';
  for (let left = 0; left < members.length; left++) {
    for (let right = left + 1; right < members.length; right++) {
      const pairCategory = visualDuplicateEvidence(members[left], members[right]).category;
      if (!pairCategory || pairCategory === 'ambiguous') return 'ambiguous';
      if (pairCategory === 'probable') category = 'probable';
    }
  }
  return category;
}

export function groupCertainStations(inputStations) {
  const stations = [...inputStations].sort((a, b) => a.stationId.localeCompare(b.stationId));
  const byId = new Map(stations.map(station => [station.stationId, station]));
  const parent = new Map(stations.map(station => [station.stationId, station.stationId]));
  const find = id => {
    const current = parent.get(id);
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const union = (left, right) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    parent.set(leftRoot.localeCompare(rightRoot) <= 0 ? rightRoot : leftRoot,
      leftRoot.localeCompare(rightRoot) <= 0 ? leftRoot : rightRoot);
  };

  for (let left = 0; left < stations.length; left++) {
    for (let right = left + 1; right < stations.length; right++) {
      if (stations[left].operator !== stations[right].operator) continue;
      if (visualDuplicateEvidence(stations[left], stations[right]).category) {
        union(stations[left].stationId, stations[right].stationId);
      }
    }
  }

  const candidates = new Map();
  for (const station of stations) {
    const root = find(station.stationId);
    if (!candidates.has(root)) candidates.set(root, []);
    candidates.get(root).push(station);
  }

  const stationAliases = {};
  const metadataConflictList = [];
  const result = [];
  const metrics = { certainGroups: 0, probableGroups: 0, ambiguousGroups: 0, removedStations: 0 };
  for (const members of candidates.values()) {
    if (members.length === 1) {
      result.push(members[0]);
      continue;
    }
    const category = groupCategory(members);
    metrics[`${category}Groups`]++;
    if (category !== 'certain') {
      result.push(...members);
      continue;
    }
    const merged = mergeCertainGroup(members);
    result.push(merged.station);
    for (const [alias, canonical] of merged.aliases) stationAliases[alias] = canonical;
    if (merged.conflict) metadataConflictList.push(merged.conflict);
    metrics.removedStations += members.length - 1;
  }

  return {
    stations: result.sort((a, b) => a.stationId.localeCompare(b.stationId)),
    stationAliases: Object.fromEntries(Object.entries(stationAliases).sort()),
    grouping: {
      ...metrics,
      metadataConflicts: metadataConflictList.sort((a, b) => a.canonicalId.localeCompare(b.canonicalId))
    }
  };
}
