import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFavorites, saveFavorites, toggleFavorite } from '../src/ui/favorites.js';
import { showFavoriteFeedback } from '../src/ui/favorite-feedback.js';
import { setLanguage, t } from '../src/i18n/i18n.js';

function element() {
    return { textContent: '', hidden: true, dataset: {} };
}

test('affiche les messages visibles d’ajout et de retrait en FR et EN', () => {
    const status = element();
    const pending = [];
    const schedule = callback => (pending.push(callback), pending.length);
    setLanguage('fr', { persist: false, translate: false });
    showFavoriteFeedback(status, t('favorites.added'), { schedule, cancel() {} });
    assert.equal(status.textContent, 'Ajouté aux favoris');
    assert.equal(status.hidden, false);
    showFavoriteFeedback(status, t('favorites.removed'), { schedule, cancel() {} });
    assert.equal(status.textContent, 'Retiré des favoris');
    setLanguage('en', { persist: false, translate: false });
    showFavoriteFeedback(status, t('favorites.added'), { schedule, cancel() {} });
    assert.equal(status.textContent, 'Added to favourites');
    showFavoriteFeedback(status, t('favorites.removed'), { schedule, cancel() {} });
    assert.equal(status.textContent, 'Removed from favourites');
});

test('masque automatiquement le message après environ deux secondes', () => {
    const status = element();
    let callback;
    let delay;
    showFavoriteFeedback(status, 'Ajouté aux favoris', { schedule(fn, ms) { callback = fn; delay = ms; return 1; }, cancel() {} });
    assert.equal(delay, 2000);
    assert.equal(status.hidden, false);
    callback();
    assert.equal(status.hidden, true);
    assert.equal(status.dataset.visible, undefined);
});

test('ajout et retrait persistent sans modifier la logique des favoris', () => {
    const values = new Map();
    globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const key = 'favorite-test';
    const id = 'iziviafast::Tarif standard';
    let favorites = toggleFavorite(new Set(), id);
    saveFavorites(key, favorites);
    assert.equal(loadFavorites(key).has(id), true);
    favorites = toggleFavorite(favorites, id);
    saveFavorites(key, favorites);
    assert.equal(loadFavorites(key).has(id), false);
});

test('un changement de langue seul ne déclenche aucune notification', () => {
    const status = element();
    setLanguage('fr', { persist: false, translate: false });
    setLanguage('en', { persist: false, translate: false });
    assert.equal(status.hidden, true);
    assert.equal(status.textContent, '');
});
