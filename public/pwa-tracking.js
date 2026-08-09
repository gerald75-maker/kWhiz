/**
 * pwa-tracking.js
 * À inclure dans chaque PWA (kWhiz, Wattlog, etc.)
 * APRÈS le snippet Umami.
 *
 * Remplacer WEBSITE_ID par l'ID donné par Umami lors de l'ajout du site.
 *
 * Métriques couvertes :
 *  - Utilisateurs actifs    → natif Umami (realtime)
 *  - Sessions               → natif Umami (30 min inactivité = nouvelle session)
 *  - Vues de pages          → natif Umami (auto sur navigation)
 *  - Temps d'engagement     → natif Umami (session duration)
 *  - Installations PWA      → event custom "pwa-install" ci-dessous
 */

(function () {
  'use strict';

  // Le cycle d'installation est géré par pwa-manager.js. Ce script ne fait que
  // convertir ses notifications en événements Umami.
  window.addEventListener('kwhiz:pwa-tracking', function (event) {
    if (!event.detail || !event.detail.name) return;
    trackEvent(event.detail.name, event.detail.data);
  });

  // ── Détection du mode standalone ─────────────────────────────────────────────
  // Si l'utilisateur ouvre l'app depuis l'écran d'accueil, on le note
  if (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  ) {
    trackEvent('pwa-launched-standalone');
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function trackEvent(name, data) {
    // window.umami est injecté par le snippet Umami
    if (typeof window.umami !== 'undefined' && typeof window.umami.track === 'function') {
      window.umami.track(name, data || {});
    }
  }

})();
