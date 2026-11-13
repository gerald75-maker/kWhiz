// Base IRVE rapide (public/irve-fast.json) : un seul téléchargement partagé par la carte,
// la couverture locale de Mon offre et la recherche de ville. En cas d'échec, l'appel
// suivant réessaie.
let request = null;

export function loadIrve({ url = './irve-fast.json', fetchImpl = globalThis.fetch } = {}) {
    request ||= fetchImpl(url)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(payload => ({ updatedAt: payload.updatedAt || null, stations: payload.stations || [] }))
        .catch(error => {
            request = null;
            throw error;
        });
    return request;
}

export function resetIrveCache() {
    request = null;
}
