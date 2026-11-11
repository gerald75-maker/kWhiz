import { buildPlaceIndex, findPlace, placeOptionLabel, COVERAGE_RADIUS_KM } from '../../domain/coverage.js';
import { t } from '../../i18n/i18n.js';

// Zone de recharge de l'utilisateur : une commune de la base IRVE ou la position du
// navigateur. Elle reste sur l'appareil (localStorage), comme le reste du profil.

function readZone(storageKey) {
    try {
        const zone = JSON.parse(localStorage.getItem(storageKey) || 'null');
        return zone && Number.isFinite(zone.lat) && Number.isFinite(zone.lon) ? zone : null;
    } catch {
        return null;
    }
}

export function initZoneControls({ storageKey, loadStations, onChange }) {
    const input = document.getElementById('profile-zone-input');
    const locate = document.getElementById('profile-zone-locate');
    const clear = document.getElementById('profile-zone-clear');
    const datalist = document.getElementById('profile-zone-places');
    const status = document.getElementById('profile-zone-status');
    let zone = readZone(storageKey);
    let placeIndex = null;

    async function places() {
        if (!placeIndex) placeIndex = buildPlaceIndex(await loadStations());
        return placeIndex;
    }

    function zoneLabel(value = zone) {
        return value?.source === 'position' ? t('profile.zone.myPosition') : value?.label || '';
    }

    function renderStatus(key = null, params = {}) {
        if (input && zone && document.activeElement !== input) input.value = zone.source === 'position' ? '' : zone.label;
        if (clear) clear.hidden = !zone;
        if (!status) return;
        status.dataset.state = key ? 'message' : zone ? 'active' : 'empty';
        status.textContent = key
            ? t(key, params)
            : zone
                ? t('profile.zone.active', { place: zoneLabel(), radius: COVERAGE_RADIUS_KM })
                : t('profile.zone.hint');
    }

    function save(next) {
        zone = next;
        try {
            if (zone) localStorage.setItem(storageKey, JSON.stringify(zone));
            else localStorage.removeItem(storageKey);
        } catch { /* stockage indisponible : la zone vaut pour la session */ }
        renderStatus();
        onChange?.(zone);
    }

    input?.addEventListener('focus', async () => {
        if (!datalist || datalist.childElementCount) return;
        try {
            const options = (await places()).map(place => `<option value="${placeOptionLabel(place).replace(/"/g, '&quot;')}"></option>`);
            datalist.innerHTML = options.join('');
        } catch { /* liste indisponible : la saisie reste possible */ }
    }, { once: false });

    // Commune saisie (Mon profil ou premier lancement) : renvoie le statut d'erreur, ou null.
    async function applyQuery(query) {
        const text = String(query || '').trim();
        if (!text) return 'profile.zone.notFound';
        try {
            const place = findPlace(await places(), text);
            if (!place) {
                renderStatus('profile.zone.notFound');
                return 'profile.zone.notFound';
            }
            if (input) input.value = place.label;
            save({ source: 'place', label: place.label, lat: place.lat, lon: place.lon });
            return null;
        } catch {
            renderStatus('profile.zone.unavailable');
            return 'profile.zone.unavailable';
        }
    }

    input?.addEventListener('change', () => {
        if (input.value.trim()) void applyQuery(input.value);
    });

    // Le bouton lui-même affiche l'attente : sur mobile, la ligne d'état peut être
    // masquée par le clavier ou hors de l'écran.
    function setLocating(active) {
        if (!locate) return;
        locate.disabled = active;
        locate.setAttribute('aria-busy', String(active));
        locate.querySelector('[data-i18n="profile.zone.locate"]')?.replaceChildren(t(active ? 'profile.zone.locatingShort' : 'profile.zone.locate'));
    }

    function locationErrorStatus(error) {
        if (error?.code === 1) return 'profile.zone.locationDenied';
        if (error?.code === 3) return 'profile.zone.locationTimeout';
        return 'profile.zone.locationError';
    }

    // Position du navigateur : renvoie le statut d'erreur, ou null.
    function locateZone() {
        return new Promise(resolve => {
            if (!navigator.geolocation) {
                renderStatus('profile.zone.locationError');
                resolve('profile.zone.locationError');
                return;
            }
            input?.blur();
            setLocating(true);
            renderStatus('profile.zone.locating');
            navigator.geolocation.getCurrentPosition(
                position => {
                    setLocating(false);
                    if (input) input.value = '';
                    save({ source: 'position', label: '', lat: position.coords.latitude, lon: position.coords.longitude });
                    resolve(null);
                },
                error => {
                    setLocating(false);
                    const key = locationErrorStatus(error);
                    renderStatus(key);
                    resolve(key);
                },
                { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }
            );
        });
    }

    locate?.addEventListener('click', () => {
        if (!locate.disabled) void locateZone();
    });

    clear?.addEventListener('click', () => {
        if (input) input.value = '';
        save(null);
    });

    renderStatus();

    return {
        getZone: () => zone,
        getLabel: () => zoneLabel(),
        applyQuery,
        locate: locateZone,
        loadPlaces: places,
        refreshLanguage: () => renderStatus()
    };
}
