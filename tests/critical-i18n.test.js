import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setLanguage, t } from '../src/i18n/i18n.js';
import {
  buildAtlanteChargebackState,
  renderAtlanteChargebackState
} from '../src/ui/views/atlante-view.js';

const operators = {
  atlante: {
    formulas: [{ id: 'atlante-go', rate: 0.29 }],
    loyalty: {
      chargebackConfig: {
        enabled: true,
        beforeDate: '2026-07-01',
        rateBefore: 1,
        rateAfter: 0.5
      }
    }
  }
};

function withInfoElement(run) {
  const element = { textContent: '' };
  const previousDocument = globalThis.document;
  globalThis.document = {
    getElementById: id => id === 'infos-atlante-cb-text' ? element : null,
    dispatchEvent() {}
  };
  try { return run(element); } finally { globalThis.document = previousDocument; }
}

test('rend ChargeBack en FR et EN avec Intl sans recalculer son état', () => {
  const state = buildAtlanteChargebackState(operators, new Date('2026-08-09T12:00:00Z'));
  assert.equal(state.gemsRate, 0.5);
  assert.equal(state.effectiveRate, 0.19333333333333333);

  withInfoElement(element => {
    setLanguage('fr', { persist: false, translate: false });
    renderAtlanteChargebackState(state);
    assert.match(element.textContent, /1\s€ payé génère 0,50\s€ de crédit en Green Gems/);
    assert.match(element.textContent, /taux de 50\s%/);
    assert.match(element.textContent, /0,193\s€\/kWh/);

    setLanguage('en', { persist: false, translate: false });
    renderAtlanteChargebackState(state);
    assert.match(element.textContent, /€1 paid earns €0\.50 in Green Gems credit/);
    assert.match(element.textContent, /50% rate/);
    assert.match(element.textContent, /€0\.193\/kWh/);
    assert.doesNotMatch(element.textContent, /payé|crédit|taux|prix effectif|usage régulier/);
    assert.equal(state.gemsRate, 0.5);
  });
});

test('préserve les marques et localise les erreurs visibles de Carte', () => {
  setLanguage('fr', { persist: false, translate: false });
  assert.equal(t('map.error.unavailableTitle'), 'Carte indisponible');
  assert.equal(t('map.error.loadFailed'), 'Les stations n’ont pas pu être chargées. Réessayez plus tard.');
  setLanguage('en', { persist: false, translate: false });
  assert.equal(t('map.error.unavailableTitle'), 'Map unavailable');
  assert.equal(t('map.error.loadFailed'), 'Chargers could not be loaded. Please try again later.');
  assert.match(t('tariffsInfo.atlanteChargeback.summary'), /Green Gems/);
});

test('la bascule de langue ne recharge pas la Carte et ne recalcule pas ChargeBack', async () => {
  const mapSource = await readFile(new URL('../src/ui/stations-map.js', import.meta.url), 'utf8');
  const appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const refresh = mapSource.slice(mapSource.indexOf('refreshLanguage()'), mapSource.indexOf('activate()', mapSource.indexOf('refreshLanguage()')));
  assert.match(refresh, /if \(loadFailed\) renderLoadError\(\)/);
  assert.match(mapSource, /mapUnavailable: 'map\.error\.unavailableTitle'/);
  assert.match(mapSource, /locationButtonState = 'mapUnavailable';[\s\S]*renderLocationButton\(\)/);
  assert.doesNotMatch(refresh, /fetch\(|load\(\)|L\.map\(|setView|fitBounds/);
  assert.match(appSource, /updateCalculations\(\{ recomputeAtlanteChargeback: false \}\);[\s\S]*renderAtlanteChargebackState\(\)/);
  assert.doesNotMatch(refresh, /Carte indisponible|Les stations n’ont pas pu être chargées/);
});
