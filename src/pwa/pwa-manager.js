import { onLanguageChange, t } from '../i18n/i18n.js';

let installPrompt = null;
let installPromptInitialized = false;
let updateInProgress = false;
let serviceWorkerRegistrationPromise = null;

const PWA_TRACKING_EVENT = 'kwhiz:pwa-tracking';
const UPDATE_APPLIED_KEY = 'kwhiz_update_applied';

export function markUpdateApplied() {
    try { sessionStorage.setItem(UPDATE_APPLIED_KEY, '1'); } catch (_) { /* mode privé */ }
}

export function showUpdateStatus(messageKey, params = {}) {
    document.getElementById('update-status-banner')?.remove();
    const banner = document.createElement('div');
    banner.id = 'update-status-banner';
    banner.className = 'update-status-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');

    const render = () => { banner.textContent = t(messageKey, params); };
    render();
    const stopUpdatingTranslations = onLanguageChange(render);
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('is-visible'));
    window.setTimeout(() => {
        banner.classList.remove('is-visible');
        window.setTimeout(() => {
            stopUpdatingTranslations();
            banner.remove();
        }, 250);
    }, 3000);
}

function showAppliedUpdateConfirmation() {
    let applied = false;
    try {
        applied = sessionStorage.getItem(UPDATE_APPLIED_KEY) === '1';
        sessionStorage.removeItem(UPDATE_APPLIED_KEY);
    } catch (_) { /* stockage indisponible */ }
    if (!applied) return;
    const version = document.querySelector('[data-app-version]')?.dataset.appVersion
        || document.getElementById('about-app-version')?.textContent
        || '';
    showUpdateStatus('pwa.status.installed', { version });
}

export function getInstallEnvironment({ userAgent = '', displayModeStandalone = false, navigatorStandalone = false } = {}) {
    return {
        isIos: /iPhone|iPad|iPod/i.test(userAgent),
        isAndroid: /Android/i.test(userAgent),
        isStandalone: displayModeStandalone || navigatorStandalone === true
    };
}

function setInstallButtonVisibility(visible) {
    const button = document.getElementById('install-native-btn');
    if (button) button.hidden = !visible;
}

function isStandaloneMode() {
    return getInstallEnvironment({
        displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
        navigatorStandalone: window.navigator.standalone
    }).isStandalone;
}

function trackPwaEvent(name, data) {
    window.dispatchEvent(new CustomEvent(PWA_TRACKING_EVENT, {
        detail: { name, data }
    }));
}

export function initInstallPrompt() {
    if (installPromptInitialized) return;
    installPromptInitialized = true;

    if (isStandaloneMode()) setInstallButtonVisibility(false);

    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        if (isStandaloneMode()) {
            installPrompt = null;
            setInstallButtonVisibility(false);
            return;
        }
        installPrompt = event;
        setInstallButtonVisibility(true);
        trackPwaEvent('pwa-install-available');
    });

    window.addEventListener('appinstalled', () => {
        installPrompt = null;
        setInstallButtonVisibility(false);
        trackPwaEvent('pwa-install', { source: 'browser' });
    });
}

export async function triggerNativeInstall() {
    if (!installPrompt) return false;
    const prompt = installPrompt;
    installPrompt = null;
    setInstallButtonVisibility(false);
    prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') {
        trackPwaEvent('pwa-install', { source: 'button' });
    } else {
        trackPwaEvent('pwa-install-dismissed');
    }
    return choice.outcome === 'accepted';
}

// Bandeau « Mise à jour disponible » : posé au-dessus de la barre de navigation, il ne
// bloque pas l'écran. « Actualiser » applique la nouvelle version, « Plus tard » le referme
// (il reviendra au prochain lancement tant que la mise à jour attend).
export function showUpdateBanner({ onUpdate = updateApplication } = {}) {
    if (document.getElementById('kwhiz-update-popup')) return;

    const element = (tagName, className, attributes = {}) => {
        const node = document.createElement(tagName);
        node.className = className;
        Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
        return node;
    };
    const bar = element('div', 'update-bar', { role: 'region', 'aria-labelledby': 'kwhiz-update-title' });
    bar.id = 'kwhiz-update-popup';
    const text = element('div', 'update-bar__text', { role: 'status', 'aria-live': 'polite' });
    const title = element('p', 'update-popup__title');
    title.id = 'kwhiz-update-title';
    const description = element('p', 'update-popup__body');
    description.id = 'kwhiz-update-description';
    const refreshButton = element('button', 'update-popup__btn', { type: 'button' });
    const laterButton = element('button', 'update-bar__later', { type: 'button' });
    text.appendChild(title);
    text.appendChild(description);
    bar.appendChild(text);
    bar.appendChild(refreshButton);
    bar.appendChild(laterButton);

    const updateTranslations = () => {
        title.textContent = t('pwa.update.title');
        description.textContent = t('pwa.update.description');
        refreshButton.textContent = t('pwa.update.refresh');
        laterButton.textContent = t('pwa.update.later');
    };
    updateTranslations();
    const stopUpdatingTranslations = onLanguageChange(updateTranslations);
    const dismiss = () => {
        stopUpdatingTranslations();
        bar.classList.remove('is-visible');
        bar.remove();
    };
    refreshButton.addEventListener('click', () => {
        dismiss();
        onUpdate();
    });
    laterButton.addEventListener('click', dismiss);

    document.body.appendChild(bar);
    requestAnimationFrame(() => bar.classList.add('is-visible'));
}

function waitForWorkerState(worker, expectedState, timeout = 8000) {
    if (!worker) return Promise.resolve(false);
    if (worker.state === expectedState) return Promise.resolve(true);

    return new Promise(resolve => {
        let timer = null;
        const finish = result => {
            worker.removeEventListener('statechange', onStateChange);
            if (timer) window.clearTimeout(timer);
            resolve(result);
        };
        const onStateChange = () => {
            if (worker.state === expectedState) finish(true);
            if (worker.state === 'redundant') finish(false);
        };
        worker.addEventListener('statechange', onStateChange);
        timer = window.setTimeout(() => finish(false), timeout);
    });
}

function waitForControllerChange(timeout = 8000) {
    return new Promise(resolve => {
        let timer = null;
        const finish = result => {
            navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
            if (timer) window.clearTimeout(timer);
            resolve(result);
        };
        const onControllerChange = () => finish(true);
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange, { once: true });
        timer = window.setTimeout(() => finish(false), timeout);
    });
}

async function activateWaitingWorker(registration, onStatus) {
    const worker = registration?.waiting;
    if (!worker) return false;

    onStatus?.('updating');
    const controllerChange = waitForControllerChange();
    worker.postMessage({ type: 'SKIP_WAITING' });
    return controllerChange;
}

function getServiceWorkerRegistration() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    if (!serviceWorkerRegistrationPromise) {
        serviceWorkerRegistrationPromise = navigator.serviceWorker
            .register('./sw.js', { updateViaCache: 'none' })
            .catch(error => {
                serviceWorkerRegistrationPromise = null;
                throw error;
            });
    }
    return serviceWorkerRegistrationPromise;
}

/**
 * Vérifie si une nouvelle version de la PWA est disponible et l'active.
 * Retourne updated=true uniquement lorsqu'un nouveau Service Worker a été installé.
 */
export async function checkForApplicationUpdate({ onStatus } = {}) {
    if (!('serviceWorker' in navigator) || !navigator.onLine) {
        return { supported: false, updated: false };
    }
    if (updateInProgress) return { supported: true, updated: false, busy: true };

    updateInProgress = true;
    onStatus?.('checking');

    try {
        const registration = await getServiceWorkerRegistration();
        if (!registration) return { supported: false, updated: false };

        if (registration.waiting) {
            const activated = await activateWaitingWorker(registration, onStatus);
            return { supported: true, updated: activated };
        }

        let discoveredWorker = null;
        const onUpdateFound = () => {
            discoveredWorker = registration.installing;
        };
        registration.addEventListener('updatefound', onUpdateFound, { once: true });

        await registration.update();
        discoveredWorker ||= registration.installing;

        if (!discoveredWorker) {
            return { supported: true, updated: false };
        }

        const installed = await waitForWorkerState(discoveredWorker, 'installed');
        if (!installed || !navigator.serviceWorker.controller) {
            return { supported: true, updated: false };
        }

        if (!registration.waiting) {
            await new Promise(resolve => window.setTimeout(resolve, 50));
        }
        const activated = await activateWaitingWorker(registration, onStatus);
        return { supported: true, updated: activated };
    } finally {
        updateInProgress = false;
    }
}

export function reloadApplication() {
    window.location.reload();
}

export async function updateApplication() {
    const result = await checkForApplicationUpdate();
    if (result.updated) {
        markUpdateApplied();
        window.setTimeout(reloadApplication, 300);
    }
    return result;
}

export function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    getServiceWorkerRegistration().then(registration => {
        if (registration.waiting) showUpdateBanner();

        registration.addEventListener('updatefound', () => {
            const worker = registration.installing;
            worker?.addEventListener('statechange', () => {
                if (worker.state === 'installed' && navigator.serviceWorker.controller && !updateInProgress) {
                    showUpdateBanner();
                }
            });
        });
    }).catch(error => {
        if (import.meta.env?.DEV) console.warn('[kWhiz] Service Worker non enregistré', error);
    });
}

export function initPwa() {
    showAppliedUpdateConfirmation();
    initInstallPrompt();
    initServiceWorker();
}
