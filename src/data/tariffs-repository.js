import { validateTariffs } from '../domain/tariffs-validator.js';

function cleanPayload(payload) {
    const data = { ...payload };
    const updatedAt = data._updated || null;
    delete data._comment;
    delete data._updated;
    return { data, updatedAt };
}

function validatePayload(data, validColors) {
    const colors = validColors instanceof Set ? validColors : new Set(validColors || []);
    const validation = validateTariffs(data, { validColors: colors });
    if (validation.errors.length) {
        console.warn('⚠️ tarifs.json — données rejetées ou neutralisées :', validation.errors);
    }
    if (Object.keys(validation.data).length === 0) {
        throw new Error('Aucune donnée tarifaire valide');
    }
    return validation.data;
}

export async function loadTariffs({ url, cacheKey, validColors }) {
    try {
        // Garder une URL stable : le Service Worker peut ainsi retrouver la
        // dernière réponse mise en cache lorsque le réseau devient indisponible.
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const payload = await response.json();
        const { data, updatedAt } = cleanPayload(payload);
        const validatedData = validatePayload(data, validColors);

        try {
            localStorage.setItem(cacheKey, JSON.stringify({
                data: validatedData,
                updatedAt,
                fetchedAt: new Date().toISOString(),
                source: 'network'
            }));
        } catch (_) {}

        return { data: validatedData, updatedAt, source: 'network' };
    } catch (networkError) {
        console.warn('⚠️ Chargement tarifs.json échoué', networkError.message);

        const cached = localStorage.getItem(cacheKey);
        if (!cached) throw networkError;

        let parsed;
        try {
            parsed = JSON.parse(cached);
        } catch (_) {
            localStorage.removeItem(cacheKey);
            throw networkError;
        }
        const validatedData = validatePayload(parsed.data, validColors);
        return {
            data: validatedData,
            updatedAt: parsed.updatedAt || parsed._updated || null,
            fetchedAt: parsed.fetchedAt || null,
            source: 'localStorage'
        };
    }
}
