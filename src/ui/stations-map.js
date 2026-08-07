import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LOGOS, STORAGE_KEYS } from '../config/app-config.js';
import { openModal } from './modal-manager.js';

const LABELS = {
  ionity: 'IONITY', tesla: 'Tesla', electra: 'Electra', iecharge: 'IECharge',
  fastned: 'Fastned', atlante: 'Atlante', zunder: 'Zunder', iziviafast: 'Izivia Fast',
  lidl: 'Lidl', pluginn: 'Plug Inn fast charge', statione: 'Station E'
};

const COLORS = {
  ionity: '#6d5dfc', tesla: '#e82127', electra: '#6f4bf2', iecharge: '#16a34a',
  fastned: '#f7c600', atlante: '#00a7a7', zunder: '#4db9e5', iziviafast: '#ef7d00',
  lidl: '#0050aa', pluginn: '#f45b20', statione: '#0ea5e9'
};

const LOGO_DISTANCE_THRESHOLD_METERS = 450000;
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

export function initStationsMap() {
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
  let loaded = false;

  function visibleStations() {
    return stations.filter(station => selected.has(station.operator) && (!routeStationMetrics || routeStationMetrics.has(station.id)));
  }

  function statusFor(station) {
    return stationStatuses[station.id] || { status: 'unknown' };
  }

  function formatStatusAge(observedAt) {
    const ageMinutes = Math.max(0, Math.floor((Date.now() - Date.parse(observedAt)) / 60000));
    if (!Number.isFinite(ageMinutes)) return '';
    return ageMinutes < 1 ? 'à l’instant' : `il y a ${ageMinutes} min`;
  }

  function statusDescription(station) {
    const status = statusFor(station);
    const age = status.observedAt ? ` · ${formatStatusAge(status.observedAt)}` : '';
    if (status.status === 'available') return { state: 'available', label: `${status.free} libre${status.free > 1 ? 's' : ''} sur ${status.known}${age}` };
    if (status.status === 'busy') return { state: 'busy', label: `Occupée${status.reserved ? ' ou réservée' : ''}${age}` };
    if (status.status === 'out_of_service') return { state: 'out_of_service', label: `Hors service${age}` };
    return { state: 'unknown', label: 'Statut inconnu' };
  }

  function statusBadge(station, className = '') {
    const status = statusDescription(station);
    return `<span class="station-status ${className}" data-status="${status.state}"><i aria-hidden="true"></i>${escapeHtml(status.label)}</span>`;
  }

  function renderList(items) {
    let nearby = routeStationMetrics
      ? [...items].sort((a, b) => routeStationMetrics.get(a.id).progress - routeStationMetrics.get(b.id).progress).slice(0, 60)
      : map
      ? [...items].sort((a, b) => map.getCenter().distanceTo([a.lat, a.lon]) - map.getCenter().distanceTo([b.lat, b.lon])).slice(0, 12)
      : items.slice(0, 12);
    const selectedStation = selectedStationId ? items.find(station => station.id === selectedStationId) : null;
    if (selectedStation && !nearby.some(station => station.id === selectedStationId)) {
      nearby = [selectedStation, ...nearby.slice(0, 11)];
    }
    list.innerHTML = nearby.map(station => `
      <article class="map-station-card${station.id === selectedStationId ? ' is-selected' : ''}" data-station-id="${escapeHtml(station.id)}" role="button" tabindex="0" aria-label="Afficher ${escapeHtml(station.name)} sur la carte" aria-pressed="${station.id === selectedStationId}">
        <img src="${LOGOS[station.operator] || ''}" alt="" class="map-station-logo">
        <div><strong>${escapeHtml(station.name)}</strong><span>${LABELS[station.operator]} · jusqu’à ${station.power} kW · ${station.connectors} point${station.connectors > 1 ? 's' : ''}</span><small>${escapeHtml(station.address || station.city)}</small>${statusBadge(station)}</div>
        <button class="map-route-trigger" data-lat="${station.lat}" data-lon="${station.lon}" data-station="${escapeHtml(station.name)}" type="button" aria-label="Itinéraire vers ${escapeHtml(station.name)}">Itinéraire</button>
      </article>`).join('') || '<p class="map-empty">Aucune station ne correspond à cette sélection.</p>';
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
    renderedStations = inView;
    markers = inView.map(station => {
      const selected = station.id === selectedStationId;
      const currentStatus = statusDescription(station).state;
      const marker = (showOperatorLogos || selected)
        ? L.marker([station.lat, station.lon], { icon: createOperatorIcon(station, selected), riseOnHover: true, bubblingMouseEvents: false })
        : L.circleMarker([station.lat, station.lon], {
          renderer: markerRenderer, radius: 10, weight: 2.5,
          color: STATUS_COLORS[currentStatus], fillColor: COLORS[station.operator], fillOpacity: 0.92,
          bubblingMouseEvents: false
        });
      marker.bindPopup(`<strong>${escapeHtml(station.name)}</strong><br>${LABELS[station.operator]} · ${station.power} kW<br>${escapeHtml(station.address)}<br>${statusBadge(station, 'station-status--popup')}<br><button class="map-route-trigger leaflet-route-trigger" data-lat="${station.lat}" data-lon="${station.lon}" data-station="${escapeHtml(station.name)}" type="button">Lancer l’itinéraire</button>`, { autoPan: false }).addTo(map);
      marker.on('click', () => selectStation(station.id, { centerMap: false }));
      markersById.set(station.id, marker);
      return marker;
    });
    count.textContent = `${filtered.length.toLocaleString('fr-FR')} station${filtered.length > 1 ? 's' : ''} · ${inView.length.toLocaleString('fr-FR')} dans la carte`;
    renderList(filtered);
    if (selectedStationId) markersById.get(selectedStationId)?.openPopup();
  }

  function createOperatorIcon(station, selected = false) {
    const size = selected ? 42 : 32;
    return L.divIcon({
      className: `map-operator-marker status-${statusDescription(station).state}${selected ? ' is-selected' : ''}`,
      html: `<img src="${LOGOS[station.operator]}" alt="">`,
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
    document.getElementById('map-list-title').textContent = 'Stations proches du centre de la carte';
    document.getElementById('route-planner-status').textContent = '';
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
    status.dataset.state = 'loading';
    status.textContent = 'Calcul de l’itinéraire…';
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
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.geometry?.coordinates?.length) throw new Error(payload.error || 'Itinéraire indisponible');
      routeLayer?.remove();
      routeLayer = L.geoJSON(payload.geometry, { style: { color: '#00aeea', weight: 5, opacity: 0.86 } }).addTo(map);
      routeStationMetrics = new Map();
      stations.forEach(station => {
        const metric = routeMetric(station, payload.geometry.coordinates);
        if (metric.distance <= 15) routeStationMetrics.set(station.id, metric);
      });
      mapPositionReady = true;
      selectedStationId = null;
      document.getElementById('map-list-title').textContent = 'Stations sur votre trajet';
      document.getElementById('route-clear').hidden = false;
      const matching = visibleStations().length;
      status.dataset.state = 'success';
      const recognizedPlaces = `${payload.recognizedStart || start} → ${payload.recognizedEnd || end}`;
      status.textContent = `${recognizedPlaces} · ${Math.round(payload.distanceKm).toLocaleString('fr-FR')} km · ${matching.toLocaleString('fr-FR')} station${matching > 1 ? 's' : ''} à moins de 15 km du trajet`;
      map.fitBounds(routeLayer.getBounds(), { padding: [18, 18] });
      renderStations();
    } catch (error) {
      status.dataset.state = 'error';
      status.textContent = error.message === 'Failed to fetch'
        ? 'Service d’itinéraire indisponible. Réessayez dans quelques instants.'
        : error.message || 'Service d’itinéraire indisponible. Réessayez dans quelques instants.';
    } finally {
      button.disabled = false;
    }
  }

  function locateUser({ automatic = false } = {}) {
    const button = document.getElementById('map-locate');
    if (userCoordinates && locationMarker) {
      mapPositionReady = true;
      map.setView(userCoordinates, Math.max(map.getZoom(), 10), { animate: true });
      locationMarker.openPopup();
      button.disabled = false;
      button.innerHTML = '<span aria-hidden="true">⌖</span> Recentrer';
      renderStations();
      return;
    }
    if (locationPending) return;
    if (!navigator.geolocation) {
      mapPositionReady = true;
      button.textContent = 'Localisation indisponible';
      renderStations();
      return;
    }
    locationPending = true;
    button.disabled = true;
    button.textContent = 'Localisation…';
    navigator.geolocation.getCurrentPosition(position => {
      const coordinates = [position.coords.latitude, position.coords.longitude];
      userCoordinates = coordinates;
      locationPending = false;
      locationMarker?.remove();
      locationMarker = L.circleMarker(coordinates, {
        radius: 9, weight: 4, color: '#fff', fillColor: '#00c2ff', fillOpacity: 1
      }).bindPopup('Votre position').addTo(map);
      mapPositionReady = true;
      if (!routeStationMetrics) {
        map.setView(coordinates, automatic ? 9 : Math.max(map.getZoom(), 10), { animate: !automatic });
        locationMarker.openPopup();
      }
      button.disabled = false;
      button.innerHTML = '<span aria-hidden="true">⌖</span> Recentrer';
      renderStations();
    }, error => {
      locationPending = false;
      mapPositionReady = true;
      button.disabled = false;
      button.textContent = error.code === 1 ? 'Me localiser' : 'Position introuvable';
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
      renderStations();
      void loadStatuses();
    });
    document.getElementById('map-select-all')?.addEventListener('click', () => { selected = new Set(keys); renderFiltersState(); renderStations(); });
    document.getElementById('map-select-none')?.addEventListener('click', () => { selected.clear(); renderFiltersState(); renderStations(); });
  }

  function renderFiltersState() {
    filters.querySelectorAll('[data-operator]').forEach(button => button.setAttribute('aria-pressed', selected.has(button.dataset.operator)));
    localStorage.setItem(STORAGE_KEYS.mapOperators, JSON.stringify([...selected]));
  }

  function openRouteChoice(trigger) {
    const lat = Number(trigger.dataset.lat);
    const lon = Number(trigger.dataset.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const station = trigger.dataset.station || 'Station sélectionnée';
    document.getElementById('route-choice-station').textContent = station;
    document.getElementById('route-apple').href = `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
    document.getElementById('route-google').href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    document.getElementById('route-waze').href = `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
    const isAndroid = /Android/i.test(navigator.userAgent || '');
    document.querySelector('[data-route-app="apple"]').hidden = isAndroid;
    openModal('route-choice-overlay', trigger);
  }

  document.addEventListener('click', event => {
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
    if (!stationCard || event.target.closest('.map-route-trigger')) return;
    event.preventDefault();
    selectStation(stationCard.dataset.stationId);
  });

  async function load() {
    if (loaded) return;
    loaded = true;
    try {
      const response = await fetch('./irve-fast.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      stations = payload.stations || [];
      const keys = [...new Set(stations.map(station => station.operator))].sort((a, b) => LABELS[a].localeCompare(LABELS[b]));
      selected = readSelection(keys);
      renderFilters(keys);
      document.getElementById('map-data-date').textContent = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${payload.updatedAt}T12:00:00`));
      map = L.map(root, { zoomControl: true, preferCanvas: true }).setView([46.6, 2.4], 5.5);
      // Un seul canvas partagé pour toutes les stations. Créer un renderer par
      // marqueur épuise rapidement la mémoire de WebKit dans une PWA iOS.
      markerRenderer = L.canvas({ padding: 0.4, tolerance: 12 });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
      map.on('moveend', renderStations);
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
      count.textContent = 'Carte indisponible';
      list.innerHTML = '<p class="map-empty">Les stations n’ont pas pu être chargées. Réessayez lorsque la connexion est disponible.</p>';
      console.warn('[kWhiz] Chargement des stations impossible', error);
    }
  }

  document.getElementById('map-locate')?.addEventListener('click', async () => {
    await load();
    if (!map) {
      const button = document.getElementById('map-locate');
      button.disabled = false;
      button.textContent = 'Carte indisponible';
      return;
    }
    locateUser();
  });

  document.getElementById('route-planner-form')?.addEventListener('submit', event => {
    event.preventDefault();
    void load().then(searchRoute);
  });
  document.getElementById('route-clear')?.addEventListener('click', clearRoute);
  document.getElementById('route-start')?.addEventListener('input', event => {
    delete event.target.dataset.lat;
    delete event.target.dataset.lon;
  });
  document.getElementById('route-use-location')?.addEventListener('click', () => {
    const button = document.getElementById('route-use-location');
    const input = document.getElementById('route-start');
    const status = document.getElementById('route-planner-status');
    const applyCoordinates = coordinates => {
      userCoordinates = coordinates;
      input.value = 'Ma position actuelle';
      input.dataset.lat = String(coordinates[0]);
      input.dataset.lon = String(coordinates[1]);
      delete status.dataset.state;
      status.textContent = 'La position actuelle sera utilisée comme départ.';
      button.disabled = false;
      button.innerHTML = '<span aria-hidden="true">⌖</span> Ma position';
    };
    if (userCoordinates) {
      applyCoordinates(userCoordinates);
      return;
    }
    if (!navigator.geolocation) {
      status.dataset.state = 'error';
      status.textContent = 'La localisation n’est pas disponible sur cet appareil.';
      return;
    }
    button.disabled = true;
    button.textContent = 'Localisation…';
    navigator.geolocation.getCurrentPosition(
      position => applyCoordinates([position.coords.latitude, position.coords.longitude]),
      () => {
        button.disabled = false;
        button.innerHTML = '<span aria-hidden="true">⌖</span> Ma position';
        status.dataset.state = 'error';
        status.textContent = 'Localisation refusée ou indisponible. Vérifiez les réglages de localisation de votre navigateur.';
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });

  return {
    activate() {
      load().then(() => {
        window.setTimeout(() => map?.invalidateSize(), 80);
        if (map && !mapPositionReady) locateUser({ automatic: true });
        if (Date.now() - lastStatusFetch > 120000) void loadStatuses();
      });
    }
  };
}
