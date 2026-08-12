import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setLanguage, t } from '../src/i18n/i18n.js';
import {
  formatStationStatus,
  formatStationStatusAge,
  renderStationCardHtml,
  renderStationPopupHtml
} from '../src/ui/station-card.js';

const now = Date.parse('2026-08-09T12:00:00Z');
const station = {
  id: 'FR*ABC*E123',
  name: 'Station République',
  operator: 'tesla',
  address: '1 place de la République',
  city: 'Paris',
  lat: 48.867,
  lon: 2.364,
  power: 250,
  connectors: 2
};

function stationSummaryFrom(html) {
  return html.match(/<strong>[^<]+<\/strong>(?:<br>|<span>)([^<]+)/)?.[1];
}

test('localise la fraîcheur du statut à l’instant, à une minute et à plusieurs minutes', () => {
  setLanguage('fr', { persist: false, translate: false });
  assert.equal(formatStationStatusAge('2026-08-09T11:59:40Z', now), 'Statut à l’instant');
  assert.equal(formatStationStatusAge('2026-08-09T11:59:00Z', now), 'il y a 1 min');
  assert.equal(formatStationStatusAge('2026-08-09T11:55:00Z', now), 'il y a 5 min');

  setLanguage('en', { persist: false, translate: false });
  assert.equal(formatStationStatusAge('2026-08-09T11:59:40Z', now), 'Status just updated');
  assert.equal(formatStationStatusAge('2026-08-09T11:59:00Z', now), '1 min ago');
  assert.equal(formatStationStatusAge('2026-08-09T11:55:00Z', now), '5 min ago');
});

test('localise disponibilité, occupation, indisponibilité et statut inconnu', () => {
  setLanguage('fr', { persist: false, translate: false });
  assert.equal(formatStationStatus({ status: 'available', free: 1, known: 4 }).label, '1 libre sur 4');
  assert.equal(formatStationStatus({ status: 'available', free: 2, known: 4 }).label, '2 libres sur 4');
  assert.equal(formatStationStatus({ status: 'available' }).label, 'Libre');
  assert.equal(formatStationStatus({ status: 'busy', reserved: true }).label, 'Occupée ou réservée');
  assert.equal(formatStationStatus({ status: 'out_of_service' }).label, 'Hors service');
  assert.equal(formatStationStatus({ status: 'unknown' }).label, 'Statut inconnu');

  setLanguage('en', { persist: false, translate: false });
  assert.equal(formatStationStatus({ status: 'available', free: 1, known: 4 }).label, '1 available out of 4');
  assert.equal(formatStationStatus({ status: 'available', free: 2, known: 4 }).label, '2 available out of 4');
  assert.equal(formatStationStatus({ status: 'available' }).label, 'Available');
  assert.equal(formatStationStatus({ status: 'busy', reserved: true }).label, 'Occupied or reserved');
  assert.equal(formatStationStatus({ status: 'out_of_service' }).label, 'Out of service');
  assert.equal(formatStationStatus({ status: 'unknown' }).label, 'Status unknown');
});

test('rend la fiche, ses actions et ses aria-labels entièrement en français ou en anglais', () => {
  const status = { status: 'available', free: 1, known: 2, observedAt: '2026-08-09T11:59:00Z' };
  setLanguage('fr', { persist: false, translate: false });
  const french = renderStationCardHtml(station, { operatorLabel: 'Tesla', status, now });
  assert.match(french, /Afficher Station République sur la carte/);
  assert.match(french, /Itinéraire vers Station République/);
  assert.match(french, />Itinéraire</);
  assert.match(french, /1 libre sur 2 · il y a 1 min/);

  setLanguage('en', { persist: false, translate: false });
  const english = renderStationCardHtml(station, { operatorLabel: 'Tesla', status, now });
  assert.match(english, /Show Station République on the map/);
  assert.match(english, /Directions to Station République/);
  assert.match(english, />Directions</);
  assert.match(english, /1 available out of 2 · 1 min ago/);
  assert.match(english, /Station République|FR\*ABC\*E123/);
  assert.doesNotMatch(english, /Afficher|Itinéraire vers| libre |il y a/);
});

test('rend la popup en place dans la langue courante sans altérer les données de station', () => {
  const status = { status: 'busy', reserved: true };
  setLanguage('fr', { persist: false, translate: false });
  const french = renderStationPopupHtml(station, { operatorLabel: 'Tesla', status });
  assert.match(french, /Occupée ou réservée/);
  assert.match(french, /Lancer l’itinéraire/);
  assert.match(french, /Tesla · jusqu’à 250 kW · 2 points/);

  setLanguage('en', { persist: false, translate: false });
  const english = renderStationPopupHtml(station, { operatorLabel: 'Tesla', status });
  assert.match(english, /Occupied or reserved/);
  assert.match(english, /Start directions/);
  assert.match(english, /Directions to Station République/);
  assert.match(english, /Station République.*Tesla · up to 250 kW · 2 charging points.*1 place de la République/s);
  assert.doesNotMatch(english, /Occupée|Lancer l’itinéraire|Itinéraire vers/);
  assert.equal(station.id, 'FR*ABC*E123');
});

test('la fiche et la popup partagent exactement le même résumé, au singulier comme au pluriel', () => {
  for (const [language, connectors, expected] of [
    ['fr', 1, 'Tesla · jusqu’à 250 kW · 1 point'],
    ['fr', 8, 'Tesla · jusqu’à 250 kW · 8 points'],
    ['en', 1, 'Tesla · up to 250 kW · 1 charging point'],
    ['en', 8, 'Tesla · up to 250 kW · 8 charging points']
  ]) {
    setLanguage(language, { persist: false, translate: false });
    const current = { ...station, connectors };
    assert.equal(stationSummaryFrom(renderStationCardHtml(current, { operatorLabel: 'Tesla' })), expected);
    assert.equal(stationSummaryFrom(renderStationPopupHtml(current, { operatorLabel: 'Tesla' })), expected);
  }
});

test('Ametzondo reste unique et présente le même résumé de 8 points dans la fiche et la popup', async () => {
  const payload = JSON.parse(await readFile(new URL('../public/irve-fast.json', import.meta.url), 'utf8'));
  const matches = payload.stations.filter(item => /ametzondo/i.test(`${item.name} ${item.address}`));
  assert.equal(matches.length, 1);
  assert.equal(matches[0].power, 300);
  assert.equal(matches[0].connectors, 8);
  setLanguage('fr', { persist: false, translate: false });
  const expected = 'Electra · jusqu’à 300 kW · 8 points';
  assert.equal(stationSummaryFrom(renderStationCardHtml(matches[0], { operatorLabel: 'Electra' })), expected);
  assert.equal(stationSummaryFrom(renderStationPopupHtml(matches[0], { operatorLabel: 'Electra' })), expected);
});

test('localise la liste vide, les titres et le repli de station sélectionnée', () => {
  setLanguage('fr', { persist: false, translate: false });
  assert.equal(t('map.list.nearby'), 'Stations proches du centre de la carte');
  assert.equal(t('map.list.empty'), 'Aucune station ne correspond aux réseaux sélectionnés dans cette zone.');
  assert.equal(t('map.station.selected'), 'Station sélectionnée');
  setLanguage('en', { persist: false, translate: false });
  assert.equal(t('map.list.nearby'), 'Chargers near the centre of the map');
  assert.equal(t('map.list.empty'), 'No charger matches the selected networks in this area.');
  assert.equal(t('map.station.selected'), 'Selected charger');
});

test('la bascule de langue rerend les marqueurs et rouvre la popup sélectionnée sans recréer Leaflet', async () => {
  const source = await readFile(new URL('../src/ui/stations-map.js', import.meta.url), 'utf8');
  const refresh = source.slice(source.indexOf('refreshLanguage()'), source.indexOf('activate()', source.indexOf('refreshLanguage()')));
  assert.match(refresh, /renderStations\(\)/);
  assert.match(source, /if \(selectedStationId\) markersById\.get\(selectedStationId\)\?\.openPopup\(\)/);
  assert.equal((refresh.match(/L\.map\(/g) || []).length, 0);
  assert.doesNotMatch(refresh, /setView|panTo|fitBounds/);
});
