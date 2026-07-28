import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTariffs } from '../src/data/tariffs-repository.js';

const validPayload = {
    _updated: '2026-07-20',
    electra: {
        name: 'Electra',
        color: 'electra',
        formulas: [{ name: 'Sans abonnement', rate: 0.49, cost: 0, ref: 0.59, period: 'monthly' }]
    }
};

function installLocalStorage(initial = {}) {
    const store = new Map(Object.entries(initial));
    globalThis.localStorage = {
        getItem: key => store.get(key) ?? null,
        setItem: (key, value) => store.set(key, value),
        removeItem: key => store.delete(key)
    };
    return store;
}

test('charge et met en cache des tarifs réseau valides', async () => {
    const store = installLocalStorage();
    globalThis.fetch = async () => ({ ok: true, json: async () => structuredClone(validPayload) });
    const result = await loadTariffs({ url: './tarifs.json', cacheKey: 'tariffs', validColors: ['electra'] });
    assert.equal(result.source, 'network');
    assert.equal(result.updatedAt, '2026-07-20');
    assert.equal(result.data.electra.formulas[0].rate, 0.49);
    const cached = JSON.parse(store.get('tariffs'));
    assert.equal(cached.source, 'network');
    assert.ok(cached.fetchedAt);
});

test('utilise le cache local lorsque le réseau échoue', async () => {
    installLocalStorage({ tariffs: JSON.stringify({ data: { electra: validPayload.electra }, updatedAt: '2026-07-19' }) });
    globalThis.fetch = async () => { throw new Error('offline'); };
    const result = await loadTariffs({ url: './tarifs.json', cacheKey: 'tariffs', validColors: ['electra'] });
    assert.equal(result.source, 'localStorage');
    assert.equal(result.updatedAt, '2026-07-19');
});

test('rejette un cache qui ne contient aucune formule valide', async () => {
    installLocalStorage({ tariffs: JSON.stringify({ data: { electra: { name: 'Electra', color: 'electra', formulas: [{ name: 'Cassée', rate: 'x', cost: 0, period: 'monthly' }] } } }) });
    globalThis.fetch = async () => { throw new Error('offline'); };
    await assert.rejects(loadTariffs({ url: './tarifs.json', cacheKey: 'tariffs', validColors: ['electra'] }), /Aucune donnée tarifaire valide/);
});
