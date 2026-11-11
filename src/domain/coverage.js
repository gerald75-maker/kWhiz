// Couverture locale des réseaux : combien de stations rapides de chaque réseau se
// trouvent autour de la zone de recharge de l'utilisateur. Les aires d'autoroute
// sont exclues, comme sur la carte. Aucune donnée ne quitte l'appareil : la zone est
// une position du navigateur ou une commune issue des adresses des stations.

import { isMotorwayStation } from './motorway.js';
import { communeFromAddress } from '../ui/station-name.js';

export const COVERAGE_RADIUS_KM = 20;

export function distanceKm(a, b) {
    const radians = value => value * Math.PI / 180;
    const deltaLat = radians(b.lat - a.lat);
    const deltaLon = radians(b.lon - a.lon);
    const h = Math.sin(deltaLat / 2) ** 2
        + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(deltaLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function countStationsByOperator(stations = [], center, radiusKm = COVERAGE_RADIUS_KM) {
    const counts = new Map();
    if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lon)) return counts;
    for (const station of stations) {
        if (!Number.isFinite(station.lat) || !Number.isFinite(station.lon)) continue;
        if (station.motorway === true || (station.motorway === undefined && isMotorwayStation(station))) continue;
        if (distanceKm(center, station) > radiusKm) continue;
        counts.set(station.operator, (counts.get(station.operator) || 0) + 1);
    }
    return counts;
}

const simplify = value => String(value || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/^(st|ste)\b/, match => (match === 'st' ? 'saint' : 'sainte'))
    .replace(/[-'’_]+/g, ' ').replace(/\s+/g, ' ').trim();

// Répertoire des communes présentes dans la base : position moyenne de leurs stations.
export function buildPlaceIndex(stations = []) {
    const places = new Map();
    for (const station of stations) {
        if (!Number.isFinite(station.lat) || !Number.isFinite(station.lon)) continue;
        const commune = communeFromAddress(station.address);
        if (!commune) continue;
        const key = simplify(commune);
        const postcode = String(station.address || '').match(/\b\d{5}\b/)?.[0] || '';
        const place = places.get(key) || { label: commune, postcodes: new Set(), lat: 0, lon: 0, count: 0 };
        place.lat += station.lat;
        place.lon += station.lon;
        place.count += 1;
        if (postcode) place.postcodes.add(postcode);
        places.set(key, place);
    }
    return [...places.entries()].map(([key, place]) => ({
        key,
        label: place.label,
        postcode: [...place.postcodes].sort()[0] || '',
        postcodes: [...place.postcodes],
        lat: place.lat / place.count,
        lon: place.lon / place.count
    })).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

// Retrouve une commune par son nom (« Montluçon », « montlucon », « Montluçon (03100) »)
// ou par son code postal (« 03100 »).
export function findPlace(index = [], query = '') {
    const text = String(query || '').trim();
    if (!text) return null;
    const postcode = text.match(/\b\d{5}\b/)?.[0];
    const name = simplify(text.replace(/\(?\b\d{5}\b\)?/, ''));
    if (name) {
        const byName = index.filter(place => place.key === name);
        if (byName.length) return (postcode && byName.find(place => place.postcodes.includes(postcode))) || byName[0];
    }
    if (postcode) return index.find(place => place.postcodes.includes(postcode)) || null;
    return null;
}

export function placeOptionLabel(place) {
    return place.postcode ? `${place.label} (${place.postcode})` : place.label;
}
