import test from 'node:test';
import assert from 'node:assert/strict';
import { canStartPull } from '../src/ui/pull-to-refresh.js';

// Élément minimal : un parent, un défilement et les zones qu'il traverse.
function node({ areas = [], scrollTop = 0, parent = null } = {}) {
    return {
        scrollTop,
        parentElement: parent,
        closest: selector => (areas.some(area => selector.split(',').map(part => part.trim()).includes(area)) ? {} : null)
    };
}
const root = { classList: { contains: () => false } };

test('sur l’écran principal en haut, le geste d’actualisation peut démarrer', () => {
    assert.equal(canStartPull(node(), { scrollY: 0, root }), true);
});

test('pas d’actualisation si la page principale a défilé ou si une page du Menu est ouverte', () => {
    assert.equal(canStartPull(node(), { scrollY: 40, root }), false);
    assert.equal(canStartPull(node(), { scrollY: 0, root: { classList: { contains: name => name === 'menu-open' } } }), false);
});

test('les pages, panneaux, Menu, fenêtres et carte gardent leur propre geste', () => {
    // Défaut signalé en 2.33.3 : en bas de Tarifs et sources, glisser vers le bas ne remontait pas.
    for (const area of ['.page-overlay', '.menu-drawer', '.sheet', '.help-overlay', '.leaflet-container', '#tab-map', '#landing-overlay']) {
        assert.equal(canStartPull(node({ areas: [area] }), { scrollY: 0, root }), false, area);
    }
    assert.equal(canStartPull(node({ areas: ['input'] }), { scrollY: 0, root }), false);
});

test('une liste qui défile et n’est pas en haut garde la priorité', () => {
    const list = node({ scrollTop: 120 });
    assert.equal(canStartPull(node({ parent: list }), { scrollY: 0, root }), false);
    assert.equal(canStartPull(node({ parent: node({ scrollTop: 0 }) }), { scrollY: 0, root }), true);
});
