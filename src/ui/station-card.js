import { formatNumber, t } from '../i18n/i18n.js';
import { formatStationSummary } from './station-summary.js';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

export function formatStationStatusAge(observedAt, now = Date.now()) {
  const ageMinutes = Math.max(0, Math.floor((now - Date.parse(observedAt)) / 60000));
  if (!Number.isFinite(ageMinutes)) return '';
  if (ageMinutes < 1) return t('map.status.justUpdated');
  if (ageMinutes === 1) return t('map.status.oneMinuteAgo');
  return t('map.status.minutesAgo', { count: formatNumber(ageMinutes) });
}

export function formatStationStatus(status = {}, now = Date.now()) {
  const age = status.observedAt ? ` · ${formatStationStatusAge(status.observedAt, now)}` : '';
  if (status.status === 'available') {
    const free = Number(status.free);
    const known = Number(status.known);
    const label = Number.isFinite(free) && Number.isFinite(known)
      ? t(free === 1 ? 'map.status.oneAvailable' : 'map.status.manyAvailable', {
          count: formatNumber(free), total: formatNumber(known)
        })
      : t('map.status.available');
    return { state: 'available', label: `${label}${age}` };
  }
  if (status.status === 'busy') {
    const label = t(status.reserved ? 'map.status.occupiedOrReserved' : 'map.status.occupied');
    return { state: 'busy', label: `${label}${age}` };
  }
  if (status.status === 'out_of_service') return { state: 'out_of_service', label: `${t('map.status.outOfService')}${age}` };
  return { state: 'unknown', label: t('map.status.unknown') };
}

function stationStatusBadge(status, className = '', now = Date.now()) {
  const description = formatStationStatus(status, now);
  return `<span class="station-status ${className}" data-status="${description.state}"><i aria-hidden="true"></i>${escapeHtml(description.label)}</span>`;
}

export function renderStationCardHtml(station, { operatorLabel = '', logo = '', selected = false, status = {}, now = Date.now() } = {}) {
  return `<article class="map-station-card${selected ? ' is-selected' : ''}" data-station-id="${escapeHtml(station.id)}" role="button" tabindex="0" aria-label="${escapeHtml(t('map.station.showOnMap', { name: station.name }))}" aria-pressed="${selected}">
        <img src="${logo}" alt="" class="map-station-logo">
        <div><strong>${escapeHtml(station.name)}</strong><span>${formatStationSummary(station, operatorLabel)}</span><small>${escapeHtml(station.address || station.city)}</small>${stationStatusBadge(status, '', now)}</div>
        <button class="map-route-trigger" data-lat="${station.lat}" data-lon="${station.lon}" data-station="${escapeHtml(station.name)}" type="button" aria-label="${escapeHtml(t('map.station.directionsLabel', { name: station.name }))}">${t('map.station.directions')}</button>
      </article>`;
}

export function renderStationPopupHtml(station, { operatorLabel = '', status = {}, now = Date.now() } = {}) {
  return `<strong>${escapeHtml(station.name)}</strong><br>${escapeHtml(operatorLabel)} · ${formatNumber(station.power)} kW<br>${escapeHtml(station.address)}<br>${stationStatusBadge(status, 'station-status--popup', now)}<br><button class="map-route-trigger leaflet-route-trigger" data-lat="${station.lat}" data-lon="${station.lon}" data-station="${escapeHtml(station.name)}" type="button" aria-label="${escapeHtml(t('map.station.directionsLabel', { name: station.name }))}">${t('map.station.startDirections')}</button>`;
}
