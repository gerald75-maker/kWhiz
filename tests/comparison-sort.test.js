import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PERIOD, calculateBreakeven } from '../src/domain/pricing.js';
import { nextSortDirection, sortComparisonFormulas } from '../src/ui/views/comparison-view.js';

test('le prix du kWh et le coût aux 100 km produisent le même classement', () => {
    const consumption = 18;
    const formulas = [
        { name: 'B', rate: 0.55, costPer100km: 0.55 * consumption },
        { name: 'A', rate: 0.29, costPer100km: 0.29 * consumption },
        { name: 'C', rate: 0.69, costPer100km: 0.69 * consumption }
    ];
    assert.deepEqual(
        sortComparisonFormulas(formulas, 'rate', 'asc').map(item => item.name),
        sortComparisonFormulas(formulas, 'costPer100km', 'asc').map(item => item.name)
    );
});

test('le tri Abonnement utilise monthlyCost et diffère du coût aux 100 km', () => {
    const formulas = [
        { name: 'Sans abonnement', costPer100km: 12, monthlyCost: 0 },
        { name: 'Premium', costPer100km: 5, monthlyCost: 10 },
        { name: 'Intermédiaire', costPer100km: 8, monthlyCost: 4 }
    ];
    assert.deepEqual(sortComparisonFormulas(formulas, 'costPer100km', 'asc').map(item => item.name), ['Premium', 'Intermédiaire', 'Sans abonnement']);
    assert.deepEqual(sortComparisonFormulas(formulas, 'monthlyCost', 'asc').map(item => item.name), ['Sans abonnement', 'Intermédiaire', 'Premium']);
});

test('les abonnements annuels sont ramenés à un coût mensuel', () => {
    const annual = calculateBreakeven({ rate: 0.3, ref: 0.5, cost: 60, period: PERIOD.ANNUAL }, 0.18);
    const monthly = calculateBreakeven({ rate: 0.3, ref: 0.5, cost: 6, period: PERIOD.MONTHLY }, 0.18);
    const none = calculateBreakeven({ rate: 0.5, ref: 0.5, cost: 0, period: PERIOD.NONE }, 0.18);
    assert.equal(annual.monthlyCost, 5);
    assert.equal(none.monthlyCost, 0);
    assert.deepEqual(
        sortComparisonFormulas([{ name: 'Mensuel', ...monthly }, { name: 'Annuel', ...annual }, { name: 'Sans', ...none }], 'monthlyCost', 'asc').map(item => item.name),
        ['Sans', 'Annuel', 'Mensuel']
    );
});

test('un second clic sur le même tri inverse l’ordre', () => {
    const current = { column: 'monthlyCost', direction: 'asc' };
    assert.equal(nextSortDirection({ column: 'costPer100km', direction: 'asc' }, 'monthlyCost'), 'asc');
    assert.equal(nextSortDirection(current, 'monthlyCost'), 'desc');
    const formulas = [{ name: 'A', monthlyCost: 0 }, { name: 'B', monthlyCost: 8 }];
    assert.deepEqual(sortComparisonFormulas(formulas, 'monthlyCost', nextSortDirection(current, 'monthlyCost')).map(item => item.name), ['B', 'A']);
});

test('les quatre libellés de tri sont présents et traduits en anglais', async () => {
    const [html, i18nSource, viewSource, styles] = await Promise.all([
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../src/i18n/i18n.js', import.meta.url), 'utf8'),
        readFile(new URL('../src/ui/views/comparison-view.js', import.meta.url), 'utf8'),
        readFile(new URL('../styles.css', import.meta.url), 'utf8')
    ]);
    assert.match(html, /data-sort="costPer100km"[^>]*>Coût aux 100 km</);
    assert.match(html, /data-sort="monthlyCost"[^>]*>Abonnement</);
    assert.match(html, /data-sort="operator"[^>]*>Opérateur</);
    assert.match(html, /data-sort="km"[^>]*>Seuil</);
    assert.doesNotMatch(html, /data-sort="rate"/);
    assert.match(i18nSource, /'Coût aux 100 km': 'Cost per 100 km'/);
    assert.match(i18nSource, /'Abonnement': 'Subscription'/);
    assert.match(i18nSource, /'Opérateur': 'Network'/);
    assert.match(i18nSource, /'Seuil': 'Break-even point'/);
    assert.match(viewSource, /button\.setAttribute\('aria-label'/);
    assert.match(styles, /\.compare-sort-btn\.active::after\s*\{\s*content:\s*"  ↑"/);
    assert.match(styles, /\.compare-sort-btn\.active\[data-direction="desc"\]::after\s*\{\s*content:\s*"  ↓"/);
});
