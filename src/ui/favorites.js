export function formulaFavoriteId(opKey, formulaName) {
    return `${opKey}::${formulaName}`;
}

export function loadFavorites(storageKey) {
    try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
        return new Set(Array.isArray(parsed) ? parsed.filter(value => typeof value === 'string') : []);
    } catch {
        return new Set();
    }
}

export function saveFavorites(storageKey, favorites) {
    localStorage.setItem(storageKey, JSON.stringify([...favorites]));
}

export function toggleFavorite(favorites, id) {
    const next = new Set(favorites);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
}
