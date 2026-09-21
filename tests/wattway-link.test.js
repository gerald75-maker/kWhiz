import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWattwayLink } from '../src/domain/wattway-link.js';

test('construit un lien Wattway vers une destination', () => {
  const url = new URL(buildWattwayLink({ lat: 45.12, lon: 1.34, name: 'Aire de test' }, 'destination'));
  assert.equal(url.hostname, 'wattway.aubard.net');
  assert.equal(url.searchParams.get('source'), 'kwhiz');
  assert.equal(url.searchParams.get('mode'), 'destination');
  assert.equal(url.searchParams.get('lat'), '45.12');
  assert.equal(url.searchParams.get('lng'), '1.34');
  assert.equal(url.searchParams.get('name'), 'Aire de test');
});

test('construit un lien Wattway vers un passage via et rejette un mode inconnu', () => {
  const url = new URL(buildWattwayLink({ lat: 46, lon: 0.5, name: 'Châtellerault' }, 'via'));
  assert.equal(url.searchParams.get('mode'), 'via');
  assert.throws(() => buildWattwayLink({ lat: 46, lon: 0.5 }, 'charge'), /Mode Wattway invalide/);
  assert.throws(() => buildWattwayLink({ lat: 91, lon: 0.5 }, 'via'), /Coordonnées Wattway invalides/);
});
