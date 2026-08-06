import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LOGOS, STORAGE_KEYS } from '../config/app-config.js';

const LABELS = {
  ionity: 'IONITY', tesla: 'Tesla', electra: 'Electra', iecharge: 'IECharge',
  fastned: 'Fastned', atlante: 'Atlante', zunder: 'Zunder', iziviafast: 'Izivia Fast',
  lidl: 'Lidl', statione: 'Station E'
};

const COLORS = {
  ionity: '#6d5dfc', tesla: '#e82127', electra: '#6f4bf2', iecharge: '#16a34a',
  fastned: '#f7c600', atlante: '#00a7a7', zunder: '#4db9e5', iziviafast: '#ef7d00',
  lidl: '#0050aa', statione: '#0ea5e9'
};

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
  let markerRenderer = null;
  let locationMarker = null;
  let loaded = false;

  function visibleStations() {
    return stations.filter(station => selected.has(station.operator));
  }

  function renderList(items) {
    const nearby = map
      ? [...items].sort((a, b) => map.getCenter().distanceTo([a.lat, a.lon]) - map.getCenter().distanceTo([b.lat, b.lon])).slice(0, 12)
      : items.slice(0, 12);
    list.innerHTML = nearby.map(station => `
      <article class="map-station-card">
        <img src="${LOGOS[station.operator] || ''}" alt="" class="map-station-logo">
        <div><strong>${escapeHtml(station.name)}</strong><span>${LABELS[station.operator]} · jusqu’à ${station.power} kW · ${station.connectors} point${station.connectors > 1 ? 's' : ''}</span><small>${escapeHtml(station.address || station.city)}</small></div>
        <a href="https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}" target="_blank" rel="noopener noreferrer" aria-label="Itinéraire vers ${escapeHtml(station.name)}">Itinéraire</a>
      </article>`).join('') || '<p class="map-empty">Aucune station ne correspond à cette sélection.</p>';
  }

  function renderStations() {
    if (!map) return;
    markers.forEach(marker => marker.remove());
    const filtered = visibleStations();
    const bounds = map.getBounds().pad(0.15);
    const inView = filtered.filter(station => bounds.contains([station.lat, station.lon]));
    markers = inView.map(station => L.circleMarker([station.lat, station.lon], {
      renderer: markerRenderer, radius: 7, weight: 2, color: '#fff', fillColor: COLORS[station.operator], fillOpacity: 0.92
    }).bindPopup(`<strong>${escapeHtml(station.name)}</strong><br>${LABELS[station.operator]} · ${station.power} kW<br>${escapeHtml(station.address)}<br><a href="https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}" target="_blank" rel="noopener">Lancer l’itinéraire</a>`).addTo(map));
    count.textContent = `${filtered.length.toLocaleString('fr-FR')} station${filtered.length > 1 ? 's' : ''} · ${inView.length.toLocaleString('fr-FR')} dans la carte`;
    renderList(filtered);
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
    });
    document.getElementById('map-select-all')?.addEventListener('click', () => { selected = new Set(keys); renderFiltersState(); renderStations(); });
    document.getElementById('map-select-none')?.addEventListener('click', () => { selected.clear(); renderFiltersState(); renderStations(); });
  }

  function renderFiltersState() {
    filters.querySelectorAll('[data-operator]').forEach(button => button.setAttribute('aria-pressed', selected.has(button.dataset.operator)));
    localStorage.setItem(STORAGE_KEYS.mapOperators, JSON.stringify([...selected]));
  }

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
      markerRenderer = L.canvas({ padding: 0.4 });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
      map.on('moveend', renderStations);
      renderStations();
    } catch (error) {
      count.textContent = 'Carte indisponible';
      list.innerHTML = '<p class="map-empty">Les stations n’ont pas pu être chargées. Réessayez lorsque la connexion est disponible.</p>';
      console.warn('[kWhiz] Chargement des stations impossible', error);
    }
  }

  document.getElementById('map-locate')?.addEventListener('click', async () => {
    const button = document.getElementById('map-locate');
    if (!navigator.geolocation) {
      button.textContent = 'Localisation indisponible';
      return;
    }
    button.disabled = true;
    button.textContent = 'Localisation…';
    await load();
    if (!map) {
      button.disabled = false;
      button.textContent = 'Carte indisponible';
      return;
    }
    navigator.geolocation.getCurrentPosition(position => {
      const coordinates = [position.coords.latitude, position.coords.longitude];
      locationMarker?.remove();
      locationMarker = L.circleMarker(coordinates, {
        radius: 9, weight: 4, color: '#fff', fillColor: '#00c2ff', fillOpacity: 1
      }).bindPopup('Votre position').addTo(map);
      map.flyTo(coordinates, 11, { duration: 0.8 });
      button.disabled = false;
      button.innerHTML = '<span aria-hidden="true">⌖</span> Recentrer';
    }, error => {
      button.disabled = false;
      button.textContent = error.code === 1 ? 'Position non autorisée' : 'Position introuvable';
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });

  return { activate() { load().then(() => window.setTimeout(() => map?.invalidateSize(), 80)); } };
}
