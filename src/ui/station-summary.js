import { formatNumber, t } from '../i18n/i18n.js';

export function formatStationSummary(station, operatorName) {
    const parts = [];
    if (operatorName) parts.push(operatorName);
    const power = Number(station.power);
    if (Number.isFinite(power) && power > 0) {
        parts.push(t('map.station.upTo', { power: formatNumber(power) }));
    }
    const hasConnectors = station.connectors !== null && station.connectors !== undefined && station.connectors !== '';
    const connectors = Number(station.connectors);
    if (hasConnectors && Number.isFinite(connectors) && connectors >= 0) {
        parts.push(t(connectors === 1 ? 'map.station.chargingPoint' : 'map.station.chargingPoints', {
            count: formatNumber(connectors)
        }));
    }
    return parts.join(' · ');
}
