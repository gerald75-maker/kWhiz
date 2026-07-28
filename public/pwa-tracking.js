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

  let deferredPrompt = null;

  // ── 1. Capture de la bannière d'installation ─────────────────────────────────
  // Déclenché quand le navigateur estime que la PWA est installable
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); // empêche la bannière automatique du navigateur
    deferredPrompt = e;

    // Rendre visible un éventuel bouton "Installer l'application"
    var installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
      installBtn.style.display = 'block';
      installBtn.addEventListener('click', triggerInstall);
    }

    // Event Umami : l'utilisateur a VU la proposition d'installation
    trackEvent('pwa-install-available');
  });

  // ── 2. Déclenchement manuel de l'installation ────────────────────────────────
  function triggerInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function (result) {
      if (result.outcome === 'accepted') {
        trackEvent('pwa-install', { source: 'button' });
      } else {
        trackEvent('pwa-install-dismissed');
      }
      deferredPrompt = null;
    });
  }

  // Exposer triggerInstall pour pouvoir l'appeler depuis n'importe quel bouton
  window.triggerPWAInstall = triggerInstall;

  // ── 3. Fallback : appinstalled ───────────────────────────────────────────────
  // Déclenché après une installation réussie (y compris via les menus navigateur)
  window.addEventListener('appinstalled', function () {
    trackEvent('pwa-install', { source: 'browser' });
  });

  // ── 4. Détection du mode standalone ─────────────────────────────────────────
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
