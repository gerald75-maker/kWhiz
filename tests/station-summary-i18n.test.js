import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setLanguage } from '../src/i18n/i18n.js';
import { formatStationSummary } from '../src/ui/station-summary.js';

test('formate un ou plusieurs points et la puissance en français et en anglais', () => {
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(formatStationSummary({ power: 180, connectors: 1 }, 'Lidl'), 'Lidl · jusqu’à 180 kW · 1 point');
    assert.equal(formatStationSummary({ power: 180, connectors: 2 }, 'Lidl'), 'Lidl · jusqu’à 180 kW · 2 points');
    assert.equal(formatStationSummary({ power: 180, connectors: 0 }, 'Lidl'), 'Lidl · jusqu’à 180 kW · 0 points');

    setLanguage('en', { persist: false, translate: false });
    assert.equal(formatStationSummary({ power: 180, connectors: 1 }, 'Lidl'), 'Lidl · up to 180 kW · 1 charging point');
    const multiple = formatStationSummary({ power: 180, connectors: 2 }, 'Lidl');
    assert.equal(multiple, 'Lidl · up to 180 kW · 2 charging points');
    assert.doesNotMatch(multiple, /jusqu’à|·\s*2 points(?:\s|$)/);
});

test('omet proprement une puissance absente et localise les grands nombres', () => {
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(formatStationSummary({ power: null, connectors: 1234 }, 'Lidl'), 'Lidl · 1 234 points');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(formatStationSummary({ connectors: 1234 }, 'Lidl'), 'Lidl · 1,234 charging points');
});

test('le changement de langue rerend les fiches sans recharger les données ni altérer leurs identifiants', async () => {
    const [mapSource, cardSource, appSource] = await Promise.all([
        readFile(new URL('../src/ui/stations-map.js', import.meta.url), 'utf8'),
        readFile(new URL('../src/ui/station-card.js', import.meta.url), 'utf8'),
        readFile(new URL('../app.js', import.meta.url), 'utf8')
    ]);
    assert.match(cardSource, /data-station-id="\$\{escapeHtml\(station\.id\)\}"/);
    assert.match(mapSource, /refreshLanguage\(\)[\s\S]*if \(stations\.length\) renderStations\(\)/);
    const refresh = mapSource.slice(mapSource.indexOf('refreshLanguage()'), mapSource.indexOf('activate()', mapSource.indexOf('refreshLanguage()')));
    assert.doesNotMatch(refresh, /fetch|load\(/);
    const callback = appSource.slice(appSource.indexOf('onLanguageChange(() => {'), appSource.indexOf('\n    });', appSource.indexOf('onLanguageChange(() => {')));
    assert.match(callback, /stationsMap\?\.refreshLanguage\(\)/);
});
