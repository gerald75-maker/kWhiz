export const FAST_STATION_MIN_POWER_KW = 100;

export function reliableStationMaxPower(station) {
  const powers = [...station.points.values()]
    .map(point => Number(point.power))
    .filter(power => Number.isFinite(power) && power > 0);
  const officialMaxPower = Number(station.officialMaxPower);
  if (Number.isFinite(officialMaxPower) && officialMaxPower > 0) powers.push(officialMaxPower);
  return powers.length ? Math.max(...powers) : null;
}

export function qualifyFastStation(station) {
  const maxPowerKw = reliableStationMaxPower(station);
  if (maxPowerKw === null) return { category: 'review', maxPowerKw: null };
  return {
    category: maxPowerKw >= FAST_STATION_MIN_POWER_KW ? 'fast' : 'slow',
    maxPowerKw
  };
}
