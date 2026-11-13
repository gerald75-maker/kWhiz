import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LOGOS, STORAGE_KEYS } from '../config/app-config.js';
import { buildWattwayLink } from '../domain/wattway-link.js';
import { compareByPrice } from '../domain/station-pricing.js';
import { isMotorwayStation } from '../domain/motorway.js';
import { buildPlaceIndex, findPlace, placeOptionLabel } from '../domain/coverage.js';
import { getLanguage, formatDate, formatDistance, formatNumber, formatStationListUpdatedAt, plural, t } from '../i18n/i18n.js';
import { loadIrve } from '../data/irve-repository.js';
import { openModal } from './modal-manager.js';
import { formatStationStatus, renderStationCardHtml, renderStationPopupHtml } from './station-card.js';
import { stationDisplayName } from './station-name.js';
import { locationErrorKey, routeErrorKey } from './map-route-ui.js';

const LABELS = {
  powerdot: 'Powerdot', ionity: 'IONITY', tesla: 'Tesla', electra: 'Electra', iecharge: 'IECharge',
  fastned: 'Fastned', atlante: 'Atlante', zunder: 'Zunder', iziviafast: 'Izivia Fast',
  lidl: 'Lidl', pluginn: 'Plug Inn fast charge', 'engie-vianeo': 'ENGIE Vianeo'
};

const COLORS = {
  powerdot: '#00bce0', ionity: '#6d5dfc', tesla: '#e82127', electra: '#6f4bf2', iecharge: '#16a34a',
  fastned: '#f7c600', atlante: '#00a7a7', zunder: '#4db9e5', iziviafast: '#ef7d00',
  lidl: '#0050aa', pluginn: '#f45b20', 'engie-vianeo': '#008bd2'
};

const LOGO_DISTANCE_THRESHOLD_METERS = 450000;
// Regroupement des stations proches à l'écran (cellules de 72 px) jusqu'au zoom 13.
const CLUSTER_CELL_PX = 72;
const CLUSTER_MAX_ZOOM = 13;
const STATUS_COLORS = { available: '#16a34a', busy: '#f59e0b', out_of_service: '#dc2626', unknown: '#94a3b8' };

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function readSelection(keys) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.mapOperators) || '[]');
    const valid = saved.filter(key => keys.includes(key));
    return new Set(valid.length ? valid : keys);
  } catch (_) { return new Set(keys); }
}

export function initStationsMap({ getHomeZone, onRouteShown } = {}) {
  const root = document.getElementById('stations-map');
  const filters = document.getElementById('map-operator-filters');
  const count = document.getElementById('map-station-count');
  const list = document.getElementById('map-station-list');
  if (!root || !filters || !count || !list) return { activate() {} };

  let map = null;
  let stations = [];
  let selected = new Set();
  let markers = [];
  let markersById = new Map();
  let markerRenderer = null;
  let locationMarker = null;
  let userCoordinates = null;
  let locationPending = false;
  let selectedStationId = null;
  let renderedStations = [];
  let stationStatuses = {};
  let statusRequest = null;
  let lastStatusFetch = 0;
  let mapPositionReady = false;
  let routeLayer = null;
  let routeStationMetrics = null;
  let stationPrices = new Map();
  let sortMode = localStorage.getItem(STORAGE_KEYS.mapSort) === 'price' ? 'price' : 'distance';
  let showMotorway = localStorage.getItem(STORAGE_KEYS.mapMotorway) === '1';
  let loaded = false;
  let irveUpdatedAt = null;
  let routeUiState = { key: null, params: {}, state: '' };
  let locationButtonState = 'locate';
  let currentLocationIsRouteStart = false;
  let routeChoiceUsesFallback = false;
  let loadFailed = false;
  let placeIndex = null;
  let placeStatusKey = null;
  let placeStatusParams = {};
  // Tant qu'aucun lieu n'est connu (position, ville, zone de recharge, trajet ou carte
  // déplacée), la liste ne propose pas de stations « proches » du centre de la France.
  let placeKnown = false;

  function renderLoadError() {
    count.textContent = t('map.error.unavailableTitle');
    list.innerHTML = `<p class="map-empty">${t('map.error.loadFailed')}</p>`;
  }

  function renderIrveUpdatedAt() {
    const updatedLine = document.getElementById('map-station-updated');
    const source = document.getElementById('map-source');
    const sourceDate = document.getElementById('map-data-date');
    const label = formatStationListUpdatedAt(irveUpdatedAt);
    if (updatedLine) {
      updatedLine.textContent = label;
      updatedLine.hidden = !label;
    }
    if (source) source.hidden = !label;
    if (sourceDate) sourceDate.textContent = label ? formatDate(irveUpdatedAt) : '';
  }

  function setRouteStatus(key = null, params = {}, state = '') {
    routeUiState = { key, params, state };
    const element = document.getElementById('route-planner-status');
    if (!element) return;
    if (state) element.dataset.state = state;
    else delete element.dataset.state;
    element.textContent = key === 'map.route.success'
      ? t(key, {
          places: params.recognizedPlaces,
          distance: formatDistance(Math.round(params.distanceKm)),
          stations: plural('count.station', params.matching)
        })
      : key ? t(key, params) : '';
  }

  // Champ « Autour de… » : centre la carte sur une commune de la base IRVE,
  // sans géolocalisation. Les communes viennent des adresses des stations.
  function setPlaceStatus(key = null, params = {}) {
    placeStatusKey = key;
    placeStatusParams = params;
    const status = document.getElementById('map-place-status');
    if (!status) return;
    status.hidden = !key;
    status.textContent = key ? t(key, params) : '';
  }

  function places() {
    placeIndex ||= buildPlaceIndex(stations);
    return placeIndex;
  }

  function renderListHeading() {
    const title = document.getElementById('map-list-title');
    if (title) title.textContent = routeStationMetrics ? t('map.list.route') : placeKnown ? t('map.list.nearby') : t('map.list.all');
    const panel = document.getElementById('map-panel');
    if (panel) panel.dataset.place = placeKnown || routeStationMetrics ? 'known' : 'none';
  }

  function centerOn(lat, lon, zoom = 11) {
    mapPositionReady = true;
    placeKnown = true;
    map.setView([lat, lon], zoom, { animate: true });
    renderStations();
  }

  // Sans position, la carte se place sur la zone de recharge choisie dans Mon choix.
  function centerOnHomeZone() {
    const home = getHomeZone?.();
    if (!home || routeStationMetrics) return false;
    placeKnown = true;
    map.setView([home.lat, home.lon], 10, { animate: false });
    return true;
  }

  function renderLocationButton() {
    const button = document.getElementById('map-locate');
    if (!button) return;
    const labels = {
      locate: 'map.location.locate', recenter: 'map.location.recenter', loading: 'map.location.loading',
      denied: 'map.location.denied', unavailable: 'map.location.unavailable',
      timeout: 'map.location.timeout', notFound: 'map.location.notFound',
      mapUnavailable: 'map.error.unavailableTitle'
    };
    const key = labels[locationButtonState] || labels.locate;
    // Bouton rond : l'état se lit dans son libellé accessible, l'aide s'affiche sous la recherche.
    button.innerHTML = `<span aria-hidden="true">${locationButtonState === 'loading' ? '…' : '⌖'}</span>`;
    button.setAttribute('aria-label', t(key));
    button.title = t(key);
    button.dataset.state = locationButtonState;
  }

  function renderRouteChoice() {
    if (routeChoiceUsesFallback) document.getElementById('route-choice-station').textContent = t('map.station.selected');
    [['route-apple', 'Plans'], ['route-google', 'Google Maps'], ['route-waze', 'Waze']].forEach(([id, app]) => {
      document.getElementById(id)?.setAttribute('aria-label', t('map.gps.openWith', { app }));
    });
  }

  function visibleStations() {
    return stations.filter(station => selected.has(station.operator) && (showMotorway || !station.motorway) && (!routeStationMetrics || routeStationMetrics.has(station.id)));
  }

  function statusFor(station) {
    return stationStatuses[station.id] || { status: 'unknown' };
  }

  function statusDescription(station) {
    return formatStationStatus(statusFor(station));
  }

  function stationDistance(station) {
    if (routeStationMetrics) return routeStationMetrics.get(station.id)?.progress ?? Infinity;
    return map ? map.getCenter().distanceTo([station.lat, station.lon]) : 0;
  }

  // « Les moins chères » : parmi les 40 stations les plus proches (ou tout le trajet),
  // classement par prix au kWh puis par distance.
  function cheapestStations(items) {
    const pool = routeStationMetrics
      ? [...items]
      : [...items].sort((a, b) => stationDistance(a) - stationDistance(b)).slice(0, 40);
    return pool.sort(compareByPrice(stationPrices, stationDistance)).slice(0, routeStationMetrics ? 60 : 12);
  }

  function renderSortState() {
    document.querySelectorAll('#map-sort [data-map-sort]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.mapSort === sortMode));
    });
  }

  function renderList(items) {
    renderListHeading();
    if (!placeKnown && !routeStationMetrics && !selectedStationId) {
      list.innerHTML = `<p class="map-empty map-empty--place">${t('map.list.needPlace')}</p>`;
      return;
    }
    let nearby = sortMode === 'price' && stationPrices.size
      ? cheapestStations(items)
      : routeStationMetrics
      ? [...items].sort((a, b) => routeStationMetrics.get(a.id).progress - routeStationMetrics.get(b.id).progress).slice(0, 60)
      : map
      ? [...items].sort((a, b) => map.getCenter().distanceTo([a.lat, a.lon]) - map.getCenter().distanceTo([b.lat, b.lon])).slice(0, 12)
      : items.slice(0, 12);
    const selectedStation = selectedStationId ? items.find(station => station.id === selectedStationId) : null;
    if (selectedStation && !nearby.some(station => station.id === selectedStationId)) {
      nearby = [selectedStation, ...nearby.slice(0, 11)];
    }
    list.innerHTML = nearby.map(station => renderStationCardHtml(station, {
      operatorLabel: LABELS[station.operator], logo: LOGOS[station.operator] || '',
      selected: station.id === selectedStationId, status: statusFor(station), price: stationPrices.get(station.operator)
    })).join('') || `<p class="map-empty">${t('map.list.empty')}</p>`;
  }

  // Prix affiché sur un marqueur : le plus bas connu pour le réseau, jamais sur autoroute.
  function markerRate(station) {
    if (station.motorway === true) return null;
    const rate = stationPrices.get(station.operator)?.sortRate;
    return Number.isFinite(rate) ? rate : null;
  }

  function shortPrice(rate) {
    return formatNumber(rate, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Stations proches à l'écran regroupées par cellule ; la station sélectionnée reste seule.
  function groupStations(items) {
    if (map.getZoom() > CLUSTER_MAX_ZOOM) return items.map(station => [station]);
    const cells = new Map();
    items.forEach(station => {
      if (station.id === selectedStationId) { cells.set(`selected:${station.id}`, [station]); return; }
      const point = map.latLngToContainerPoint([station.lat, station.lon]);
      const key = `${Math.floor(point.x / CLUSTER_CELL_PX)}:${Math.floor(point.y / CLUSTER_CELL_PX)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(station);
    });
    return [...cells.values()];
  }

  function clusterMarker(group) {
    const lat = group.reduce((sum, station) => sum + station.lat, 0) / group.length;
    const lon = group.reduce((sum, station) => sum + station.lon, 0) / group.length;
    const size = group.length < 10 ? 30 : group.length < 100 ? 36 : 42;
    const label = t('map.cluster.label', { count: formatNumber(group.length) });
    const marker = L.marker([lat, lon], {
      icon: L.divIcon({
        className: 'map-cluster',
        html: `<span class="map-cluster-count">${formatNumber(group.length)}</span>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      }),
      bubblingMouseEvents: false,
      keyboard: true,
      title: label
    }).addTo(map);
    marker.getElement()?.setAttribute('aria-label', label);
    marker.on('click', () => map.setView([lat, lon], Math.min(map.getZoom() + 2, 16), { animate: true }));
    return marker;
  }

  function renderStations() {
    if (!map || !mapPositionReady) return;
    markers.forEach(marker => marker.remove());
    markersById = new Map();
    const filtered = visibleStations();
    const bounds = map.getBounds().pad(0.15);
    const center = map.getCenter();
    const visibleWidth = map.distance([center.lat, map.getBounds().getWest()], [center.lat, map.getBounds().getEast()]);
    const showOperatorLogos = visibleWidth <= LOGO_DISTANCE_THRESHOLD_METERS;
    const inView = filtered.filter(station => bounds.contains([station.lat, station.lon]));
    const groups = groupStations(inView);
    const clusters = groups.filter(group => group.length > 1).map(clusterMarker);
    const singles = groups.filter(group => group.length === 1).map(group => group[0]);
    renderedStations = singles;
    markers = clusters.concat(singles.map(station => {
      const selected = station.id === selectedStationId;
      const currentStatus = statusDescription(station).state;
      const marker = (showOperatorLogos || selected)
        ? L.marker([station.lat, station.lon], { icon: createOperatorIcon(station, selected), riseOnHover: true, bubblingMouseEvents: false })
        : L.circleMarker([station.lat, station.lon], {
          renderer: markerRenderer, radius: 10, weight: 2.5,
          color: STATUS_COLORS[currentStatus], fillColor: COLORS[station.operator], fillOpacity: 0.92,
          bubblingMouseEvents: false
        });
      marker.bindPopup(renderStationPopupHtml(station, { operatorLabel: LABELS[station.operator], status: statusFor(station), price: stationPrices.get(station.operator) }), { autoPan: false }).addTo(map);
      marker.getElement()?.setAttribute('aria-label', t('map.station.showOnMap', { name: stationDisplayName(station, LABELS[station.operator]) }));
      marker.on('click', () => selectStation(station.id, { centerMap: false }));
      markersById.set(station.id, marker);
      return marker;
    }));
    count.textContent = t('map.count.inView', { visible: formatNumber(inView.length), stations: plural('count.station', filtered.length) });
    renderList(filtered);
    if (selectedStationId) markersById.get(selectedStationId)?.openPopup();
  }

  function createOperatorIcon(station, selected = false) {
    const size = selected ? 42 : 32;
    return L.divIcon({
      className: `map-operator-marker status-${statusDescription(station).state}${selected ? ' is-selected' : ''}`,
      html: `<img src="${LOGOS[station.operator]}" alt="">${markerRate(station) !== null ? `<span class="map-marker-price">${shortPrice(markerRate(station))}</span>` : ''}`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -(size / 2 + 4)]
    });
  }

  async function loadStatuses() {
    if (statusRequest) return statusRequest;
    statusRequest = (async () => {
      try {
        const response = await fetch('./status.php', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        stationStatuses = payload.stations || {};
        lastStatusFetch = Date.now();
        renderStations();
      } catch (_) {
        // Le statut est une information facultative : la carte statique reste utilisable.
      } finally {
        statusRequest = null;
      }
    })();
    return statusRequest;
  }

  function routeMetric(station, coordinates) {
    let bestDistance = Infinity;
    let bestProgress = 0;
    let travelled = 0;
    for (let index = 1; index < coordinates.length; index++) {
      const [lonA, latA] = coordinates[index - 1];
      const [lonB, latB] = coordinates[index];
      const meanLat = ((latA + latB + station.lat) / 3) * Math.PI / 180;
      const lonScale = 111.32 * Math.cos(meanLat);
      const ax = lonA * lonScale;
      const ay = latA * 111.32;
      const bx = lonB * lonScale;
      const by = latB * 111.32;
      const px = station.lon * lonScale;
      const py = station.lat * 111.32;
      const dx = bx - ax;
      const dy = by - ay;
      const segmentLengthSquared = dx * dx + dy * dy;
      const factor = segmentLengthSquared ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / segmentLengthSquared)) : 0;
      const distance = Math.hypot(px - (ax + factor * dx), py - (ay + factor * dy));
      const segmentLength = Math.sqrt(segmentLengthSquared);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestProgress = travelled + factor * segmentLength;
      }
      travelled += segmentLength;
    }
    return { distance: bestDistance, progress: bestProgress };
  }

  function clearRoute() {
    routeLayer?.remove();
    routeLayer = null;
    routeStationMetrics = null;
    selectedStationId = null;
    setRouteStatus();
    document.getElementById('route-clear').hidden = true;
    renderStations();
  }

  async function searchRoute() {
    const startInput = document.getElementById('route-start');
    const start = startInput.value.trim();
    const end = document.getElementById('route-end').value.trim();
    const button = document.getElementById('route-search');
    const status = document.getElementById('route-planner-status');
    if (!start || !end || !map) return;
    button.disabled = true;
    setRouteStatus('map.route.searchingAddresses', {}, 'loading');
    try {
      const response = await fetch('./route.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          start,
          end,
          startCoordinates: startInput.dataset.lat && startInput.dataset.lon
            ? [Number(startInput.dataset.lon), Number(startInput.dataset.lat)]
            : null
        })
      });
      const responseText = await response.text();
      let payload = null;
      try { payload = JSON.parse(responseText); } catch (_) { /* réponse invalide traitée ci-dessous */ }
      if (!payload) throw { uiKey: routeErrorKey({ responseValid: false }) };
      if (!response.ok || !payload.geometry?.coordinates?.length) {
        throw { uiKey: routeErrorKey({ code: payload.code, responseValid: Boolean(payload) }) };
      }
      setRouteStatus('map.route.calculating', {}, 'loading');
      routeLayer?.remove();
      routeLayer = L.geoJSON(payload.geometry, { style: { color: '#00aeea', weight: 5, opacity: 0.86 } }).addTo(map);
      routeStationMetrics = new Map();
      stations.forEach(station => {
        const metric = routeMetric(station, payload.geometry.coordinates);
        if (metric.distance <= 15) routeStationMetrics.set(station.id, metric);
      });
      mapPositionReady = true;
      selectedStationId = null;
      placeKnown = true;
      document.getElementById('route-clear').hidden = false;
      const matching = visibleStations().length;
      const recognizedPlaces = `${payload.recognizedStart || start} → ${payload.recognizedEnd || end}`;
      const successParams = { recognizedPlaces, distanceKm: payload.distanceKm, matching };
      setRouteStatus(matching ? 'map.route.success' : 'map.route.noMatchingStations', matching ? successParams : {}, matching ? 'success' : 'empty');
      map.fitBounds(routeLayer.getBounds(), { padding: [18, 18] });
      renderStations();
      if (matching) onRouteShown?.();
    } catch (error) {
      const uiKey = error?.uiKey || routeErrorKey({ networkError: error instanceof TypeError || error?.message === 'Failed to fetch' });
      setRouteStatus(uiKey, {}, 'error');
    } finally {
      button.disabled = false;
    }
  }

  function locateUser({ automatic = false } = {}) {
    const button = document.getElementById('map-locate');
    if (userCoordinates && locationMarker) {
      mapPositionReady = true;
      placeKnown = true;
      map.setView(userCoordinates, Math.max(map.getZoom(), 10), { animate: true });
      locationMarker.openPopup();
      button.disabled = false;
      locationButtonState = 'recenter';
      renderLocationButton();
      renderStations();
      return;
    }
    if (locationPending) return;
    if (!navigator.geolocation) {
      mapPositionReady = true;
      // Sans zone de recharge non plus, l'invitation est dans le panneau de liste.
      if (centerOnHomeZone()) setPlaceStatus('map.place.locationHint');
      locationButtonState = 'unavailable';
      renderLocationButton();
      renderStations();
      return;
    }
    locationPending = true;
    button.disabled = true;
    locationButtonState = 'loading';
    renderLocationButton();
    navigator.geolocation.getCurrentPosition(position => {
      const coordinates = [position.coords.latitude, position.coords.longitude];
      userCoordinates = coordinates;
      locationPending = false;
      locationMarker?.remove();
      locationMarker = L.circleMarker(coordinates, {
        radius: 9, weight: 4, color: '#fff', fillColor: '#00c2ff', fillOpacity: 1
      }).bindPopup(t('map.location.yourPosition')).addTo(map);
      mapPositionReady = true;
      placeKnown = true;
      if (!routeStationMetrics) {
        map.setView(coordinates, automatic ? 9 : Math.max(map.getZoom(), 10), { animate: !automatic });
        locationMarker.openPopup();
      }
      button.disabled = false;
      locationButtonState = 'recenter';
      renderLocationButton();
      renderStations();
    }, error => {
      locationPending = false;
      mapPositionReady = true;
      if (!userCoordinates && centerOnHomeZone()) setPlaceStatus('map.place.locationHint');
      button.disabled = false;
      locationButtonState = locationErrorKey(error).replace('map.location.', '');
      renderLocationButton();
      renderStations();
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }

  function selectStation(id, { centerMap = true } = {}) {
    const station = stations.find(item => item.id === id);
    if (!station) return;
    selectedStationId = id;
    if (centerMap) map.panTo([station.lat, station.lon]);
    markersById.forEach((marker, markerId) => {
      const selected = markerId === selectedStationId;
      if (typeof marker.setRadius === 'function') {
        const markerStation = stations.find(item => item.id === markerId);
        marker.setRadius(selected ? 15 : 10);
        marker.setStyle({ weight: selected ? 5 : 2.5, color: selected ? '#00c2ff' : STATUS_COLORS[markerStation ? statusDescription(markerStation).state : 'unknown'] });
      } else {
        const markerStation = stations.find(item => item.id === markerId);
        if (markerStation) marker.setIcon(createOperatorIcon(markerStation, selected));
      }
    });
    renderList(visibleStations());
    markersById.get(selectedStationId)?.openPopup();
    const selectedMarker = markersById.get(selectedStationId);
    if (selectedMarker && typeof selectedMarker.setRadius === 'function') {
      window.setTimeout(renderStations, 0);
    }
  }

  function renderFilters(keys) {
    filters.innerHTML = keys.map(key => `<button class="map-operator-chip" data-operator="${key}" aria-pressed="${selected.has(key)}" type="button"><img src="${LOGOS[key]}" alt=""><span>${LABELS[key]}</span></button>`).join('');
    filters.addEventListener('click', event => {
      const button = event.target.closest('[data-operator]');
      if (!button) return;
      const key = button.dataset.operator;
      selected.has(key) ? selected.delete(key) : selected.add(key);
      button.setAttribute('aria-pressed', selected.has(key));
      localStorage.setItem(STORAGE_KEYS.mapOperators, JSON.stringify([...selected]));
      renderFiltersLabel();
      renderStations();
      void loadStatuses();
    });
    document.getElementById('map-select-all')?.addEventListener('click', () => { selected = new Set(keys); renderFiltersState(); renderStations(); });
    document.getElementById('map-select-none')?.addEventListener('click', () => { selected.clear(); renderFiltersState(); renderStations(); });
  }

  function renderFiltersState() {
    filters.querySelectorAll('[data-operator]').forEach(button => button.setAttribute('aria-pressed', selected.has(button.dataset.operator)));
    localStorage.setItem(STORAGE_KEYS.mapOperators, JSON.stringify([...selected]));
    renderFiltersLabel();
  }

  // Bouton « Réseaux » de la carte : nombre de réseaux affichés.
  function renderFiltersLabel() {
    const label = document.getElementById('map-filters-label');
    if (!label) return;
    const total = filters.querySelectorAll('[data-operator]').length;
    label.textContent = !total || selected.size === total
      ? t('map.filters.allNetworks')
      : t(selected.size === 1 ? 'map.filters.oneNetwork' : 'map.filters.someNetworks', { count: formatNumber(selected.size) });
  }

  // Panneau de liste : replié (aperçu) ou déplié.
  function setPanelExpanded(expanded) {
    const panel = document.getElementById('map-panel');
    const toggle = document.getElementById('map-panel-toggle');
    if (!panel || !toggle) return;
    panel.dataset.expanded = String(expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
  }
  document.getElementById('map-panel-toggle')?.addEventListener('click', () => {
    setPanelExpanded(document.getElementById('map-panel')?.dataset.expanded !== 'true');
  });

  function openRouteChoice(trigger) {
    const lat = Number(trigger.dataset.lat);
    const lon = Number(trigger.dataset.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    routeChoiceUsesFallback = !trigger.dataset.station;
    const station = trigger.dataset.station || t('map.station.selected');
    document.getElementById('route-choice-station').textContent = station;
    document.getElementById('route-apple').href = `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
    document.getElementById('route-google').href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    document.getElementById('route-waze').href = `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
    document.getElementById('route-wattway-destination').href = buildWattwayLink({ lat, lon, name: station }, 'destination');
    document.getElementById('route-wattway-via').href = buildWattwayLink({ lat, lon, name: station }, 'via');
    const isAndroid = /Android/i.test(navigator.userAgent || '');
    document.querySelector('[data-route-app="apple"]').hidden = isAndroid;
    renderRouteChoice();
    openModal('route-choice-overlay', trigger);
  }

  document.addEventListener('click', event => {
    if (event.target.closest('.atlante-availability-link')) return;
    const trigger = event.target.closest('.map-route-trigger');
    if (trigger) {
      openRouteChoice(trigger);
      return;
    }
    const stationCard = event.target.closest('.map-station-card');
    if (stationCard) selectStation(stationCard.dataset.stationId);
  });

  list.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const stationCard = event.target.closest('.map-station-card');
    if (!stationCard || event.target.closest('.map-route-trigger, .atlante-availability-link')) return;
    event.preventDefault();
    selectStation(stationCard.dataset.stationId);
  });

  const motorwayToggle = document.getElementById('map-motorway');
  if (motorwayToggle) {
    motorwayToggle.checked = showMotorway;
    motorwayToggle.addEventListener('change', () => {
      showMotorway = motorwayToggle.checked;
      localStorage.setItem(STORAGE_KEYS.mapMotorway, showMotorway ? '1' : '0');
      if (stations.length) renderStations();
    });
  }

  renderSortState();
  document.getElementById('map-sort')?.addEventListener('click', event => {
    const button = event.target.closest?.('[data-map-sort]');
    if (!button || button.dataset.mapSort === sortMode) return;
    sortMode = button.dataset.mapSort === 'price' ? 'price' : 'distance';
    localStorage.setItem(STORAGE_KEYS.mapSort, sortMode);
    renderSortState();
    if (stations.length) renderList(visibleStations());
  });

  async function load() {
    if (loaded) return;
    loaded = true;
    try {
      const payload = await loadIrve();
      stations = payload.stations.map(station => ({ ...station, motorway: isMotorwayStation(station) }));
      const keys = [...new Set(stations.map(station => station.operator))]
        .filter(key => Object.hasOwn(LABELS, key))
        .sort((a, b) => LABELS[a].localeCompare(LABELS[b]));
      selected = readSelection(keys);
      renderFilters(keys);
      renderFiltersLabel();
      irveUpdatedAt = payload.updatedAt;
      renderIrveUpdatedAt();
      // Boutons de zoom à droite, sous la barre de recherche (le pincement reste possible).
      map = L.map(root, { zoomControl: false, preferCanvas: true }).setView([46.6, 2.4], 5.5);
      L.control.zoom({ position: 'topright' }).addTo(map);
      // Un seul canvas partagé pour toutes les stations. Créer un renderer par
      // marqueur épuise rapidement la mémoire de WebKit dans une PWA iOS.
      markerRenderer = L.canvas({ padding: 0.4, tolerance: 12 });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
      map.on('moveend', renderStations);
      // Déplacer ou zoomer la carte, c'est choisir un lieu : la liste suit alors son centre.
      map.on('dragstart zoomstart', () => {
        placeKnown = true;
        if (placeStatusKey === 'map.place.locationHint') setPlaceStatus(null);
      });
      map.on('click', event => {
        const touchedPoint = map.latLngToContainerPoint(event.latlng);
        let nearest = null;
        let nearestDistance = 29;
        renderedStations.forEach(station => {
          const point = map.latLngToContainerPoint([station.lat, station.lon]);
          const distance = touchedPoint.distanceTo(point);
          if (distance < nearestDistance) {
            nearest = station;
            nearestDistance = distance;
          }
        });
        if (nearest) selectStation(nearest.id, { centerMap: false });
      });
      renderStations();
    } catch (error) {
      loadFailed = true;
      renderLoadError();
      console.warn('[kWhiz] Chargement des stations impossible', error);
    }
  }

  document.getElementById('map-locate')?.addEventListener('click', async () => {
    await load();
    if (!map) {
      const button = document.getElementById('map-locate');
      button.disabled = false;
      locationButtonState = 'mapUnavailable';
      renderLocationButton();
      return;
    }
    locateUser();
  });

  document.getElementById('map-place-input')?.addEventListener('focus', async () => {
    const datalist = document.getElementById('map-place-list');
    if (!datalist || datalist.childElementCount) return;
    await load();
    if (!stations.length) return;
    datalist.innerHTML = places().map(place => `<option value="${escapeHtml(placeOptionLabel(place))}"></option>`).join('');
  });
  document.getElementById('map-place-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const input = document.getElementById('map-place-input');
    const query = input?.value.trim() || '';
    if (!query) return;
    await load();
    if (!map) {
      setPlaceStatus('map.error.unavailableTitle');
      return;
    }
    const place = findPlace(places(), query);
    if (!place) {
      setPlaceStatus('map.place.notFound');
      return;
    }
    input.value = place.label;
    input.blur();
    setPlaceStatus(null);
    centerOn(place.lat, place.lon);
  });

  document.getElementById('route-planner-form')?.addEventListener('submit', event => {
    event.preventDefault();
    void load().then(searchRoute);
  });
  document.getElementById('route-clear')?.addEventListener('click', clearRoute);
  document.getElementById('route-start')?.addEventListener('input', event => {
    currentLocationIsRouteStart = false;
    delete event.target.dataset.lat;
    delete event.target.dataset.lon;
  });
  document.getElementById('route-use-location')?.addEventListener('click', () => {
    const button = document.getElementById('route-use-location');
    const input = document.getElementById('route-start');
    const status = document.getElementById('route-planner-status');
    const applyCoordinates = coordinates => {
      userCoordinates = coordinates;
      currentLocationIsRouteStart = true;
      input.value = t('map.route.currentLocation');
      input.dataset.lat = String(coordinates[0]);
      input.dataset.lon = String(coordinates[1]);
      setRouteStatus('map.location.usedAsStart');
      button.disabled = false;
      button.innerHTML = `<span aria-hidden="true">⌖</span> ${t('map.route.myLocation')}`;
    };
    if (userCoordinates) {
      applyCoordinates(userCoordinates);
      return;
    }
    if (!navigator.geolocation) {
      setRouteStatus('map.location.unavailable', {}, 'error');
      return;
    }
    button.disabled = true;
    button.textContent = t('map.location.loading');
    navigator.geolocation.getCurrentPosition(
      position => applyCoordinates([position.coords.latitude, position.coords.longitude]),
      error => {
        button.disabled = false;
        button.innerHTML = `<span aria-hidden="true">⌖</span> ${t('map.route.myLocation')}`;
        const key = locationErrorKey(error);
        setRouteStatus(key === 'map.location.denied' ? 'map.location.deniedHelp' : key, {}, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });

  return {
    refreshLanguage() {
      renderListHeading();
      if (currentLocationIsRouteStart) document.getElementById('route-start').value = t('map.route.currentLocation');
      setRouteStatus(routeUiState.key, routeUiState.params, routeUiState.state);
      setPlaceStatus(placeStatusKey, placeStatusParams);
      renderFiltersLabel();
      renderLocationButton();
      renderIrveUpdatedAt();
      const locationPopupWasOpen = locationMarker?.isPopupOpen?.() || false;
      locationMarker?.setPopupContent?.(t('map.location.yourPosition'));
      if (locationPopupWasOpen) locationMarker.openPopup();
      renderRouteChoice();
      if (loadFailed) renderLoadError();
      else if (stations.length) renderStations();
    },
    activate() {
      load().then(() => {
        window.setTimeout(() => map?.invalidateSize(), 80);
        if (map && !mapPositionReady) locateUser({ automatic: true });
        if (Date.now() - lastStatusFetch > 120000) void loadStatuses();
      });
    },
    // Affiche uniquement les stations d'un réseau (bouton de l'offre n°1).
    // La sélection reste modifiable avec les filtres « Tous » / « Aucun ».
    showOperator(key) {
      return load().then(() => {
        if (!filters.querySelector(`[data-operator="${CSS.escape(key)}"]`)) return;
        selected = new Set([key]);
        renderFiltersState();
        renderStations();
        void loadStatuses();
      });
    },
    // Prix par réseau calculés depuis les tarifs et le profil (app.js).
    setPrices(prices) {
      stationPrices = prices instanceof Map ? prices : new Map();
      if (stations.length) renderStations();
    }
  };
}
