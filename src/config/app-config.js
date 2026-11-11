export const CONFIG = Object.freeze({
    apiBase: 'https://kwhiz.aubard.net',
    wattwayUrl: 'https://wattway.aubard.net/',
    pingUrl: 'https://kwhiz.aubard.net/ping.php',
    statsUrl: 'https://aubard.net/stats.php'
});

export const LOGOS = Object.freeze({
    iecharge: './logos/iecharge.webp',
    electra: './logos/electra.webp',
    tesla: './logos/tesla.webp',
    ionity: './logos/ionity.webp',
    lidl: './logos/lidl.webp',
    statione: './logos/statione.webp',
    iziviafast: './logos/iziviafast.webp',
    atlante: './logos/atlante.webp',
    fastned: './logos/fastned.webp',
    electroverse: './logos/electroverse.webp',
    powerdot: './logos/powerdot.webp',
    zunder: './logos/zunder.png',
    pluginn: './logos/pluginn.webp',
    'engie-vianeo': './logos/engie-vianeo.webp'
});

export const VALID_COLORS = new Set([
    'atlante', 'electra', 'electroverse', 'fastned', 'iecharge',
    'powerdot', 'engie-vianeo', 'ionity', 'izivia', 'lidl', 'pluginn', 'statione', 'tesla', 'zunder'
]);

// Réseaux affichés sur la carte kWhiz (base IRVE rapide). Un test vérifie que
// chacun possède des stations dans public/irve-fast.json.
export const MAP_OPERATOR_KEYS = Object.freeze([
    'atlante', 'electra', 'engie-vianeo', 'fastned', 'iecharge', 'ionity',
    'iziviafast', 'lidl', 'pluginn', 'tesla', 'zunder'
]);

export const STORAGE_KEYS = Object.freeze({
    tariffsCache: 'kwhiz_tarifs_cache',
    landingSeen: 'kwhiz-landing-seen',
    fastPercentage: 'kwhiz_fast_pct',
    profileKm: 'kwhiz_profile_km',
    consumption: 'kwhiz_consumption',
    vehicleModel: 'kwhiz_vehicle_model',
    favorites: 'kwhiz_favorites',
    tariffHistory: 'kwhiz_tariff_history',
    mapOperators: 'kwhiz_map_operators',
    mapSort: 'kwhiz_map_sort',
    mapMotorway: 'kwhiz_map_motorway',
    homeZone: 'kwhiz_home_zone',
    language: 'kwhiz_language',
    theme: 'kwhiz_theme',
    legacyTheme: 'crve_theme'
});

export const HOME_RATE_KWH = 0.20;
