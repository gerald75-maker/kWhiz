import { CONFIG } from '../config/app-config.js';

export function buildWattwayLink({ lat, lon, name }, mode) {
    if (mode !== 'destination' && mode !== 'via') throw new TypeError('Mode Wattway invalide');
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
        || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        throw new TypeError('Coordonnées Wattway invalides');
    }
    const url = new URL(CONFIG.wattwayUrl);
    url.searchParams.set('source', 'kwhiz');
    url.searchParams.set('mode', mode);
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lng', String(longitude));
    url.searchParams.set('name', String(name || `${latitude}, ${longitude}`).trim().slice(0, 200));
    return url.toString();
}
