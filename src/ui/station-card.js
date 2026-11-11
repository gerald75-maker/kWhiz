import { formatCurrency, formatNumber, localizeCommercialLabel, t } from '../i18n/i18n.js';
import { formatStationSummary } from './station-summary.js';
import { stationDisplayName } from './station-name.js';

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

function atlanteAvailabilityLink(station, className = '') {
  if (station.operator !== 'atlante' || !station.officialUrl) return '';
  return `<a class="atlante-availability-link${className ? ` ${className}` : ''}" href="${escapeHtml(station.officialUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('map.station.atlanteAvailability'))} <span aria-hidden="true">↗</span></a>`;
}

function stationRate(rate) {
  return t('profile.perKwh', { amount: formatCurrency(rate, { minimumFractionDigits: 2, maximumFractionDigits: 3 }) });
}

// Nom court de l'abonnement dans une fiche étroite : sans la période (« - mensuel »).
function shortPlanName(name) {
  return String(name).replace(/\s+[-–—]\s+(mensuel|annuel|monthly|annual)$/i, '');
}

// Lignes de prix d'une station : sans abonnement, puis avec l'abonnement favori ou recommandé.
export function formatStationPrice(price) {
  if (!price) return [];
  const lines = [];
  if (price.payg) {
    const key = price.payg.from ? 'map.price.paygFrom' : price.payg.approx ? 'map.price.paygApprox' : 'map.price.payg';
    lines.push(t(key, { rate: stationRate(price.payg.rate) }));
  }
  if (price.plan) {
    lines.push(t(price.plan.approx ? 'map.price.planApprox' : 'map.price.plan', {
      rate: stationRate(price.plan.rate), formula: shortPlanName(localizeCommercialLabel(price.plan.name))
    }));
  }
  return lines;
}

function stationPriceHtml(price, tag = 'p') {
  const lines = formatStationPrice(price);
  if (!lines.length) return '';
  return `<${tag} class="station-price">${lines.map((line, index) => `<b${index ? ' class="station-price-plan"' : ''}>${escapeHtml(line)}</b>`).join('')}</${tag}>`;
}

export function renderStationCardHtml(station, { operatorLabel = '', logo = '', selected = false, status = {}, price = null, now = Date.now() } = {}) {
  const name = stationDisplayName(station, operatorLabel);
  return `<article class="map-station-card${selected ? ' is-selected' : ''}" data-station-id="${escapeHtml(station.id)}" role="button" tabindex="0" aria-label="${escapeHtml(t('map.station.showOnMap', { name }))}" aria-pressed="${selected}">
        <img src="${logo}" alt="" class="map-station-logo">
        <div><strong>${escapeHtml(name)}</strong><span>${formatStationSummary(station, operatorLabel)}</span><small>${escapeHtml(station.address || station.city)}</small>${stationPriceHtml(price)}${stationStatusBadge(status, '', now)}${atlanteAvailabilityLink(station)}</div>
        <button class="map-route-trigger" data-lat="${station.lat}" data-lon="${station.lon}" data-station="${escapeHtml(name)}" type="button" aria-label="${escapeHtml(t('map.station.directionsLabel', { name }))}">${t('map.station.directions')}</button>
      </article>`;
}

export function renderStationPopupHtml(station, { operatorLabel = '', status = {}, price = null, now = Date.now() } = {}) {
  const name = stationDisplayName(station, operatorLabel);
  const availability = atlanteAvailabilityLink(station, 'atlante-availability-link--popup');
  return `<strong>${escapeHtml(name)}</strong><br>${formatStationSummary(station, operatorLabel)}<br>${escapeHtml(station.address)}<br>${stationPriceHtml(price, 'span')}${stationStatusBadge(status, 'station-status--popup', now)}${availability ? `<br>${availability}` : ''}<br><button class="map-route-trigger leaflet-route-trigger" data-lat="${station.lat}" data-lon="${station.lon}" data-station="${escapeHtml(name)}" type="button" aria-label="${escapeHtml(t('map.station.directionsLabel', { name }))}">${t('map.station.startDirections')}</button>`;
}
