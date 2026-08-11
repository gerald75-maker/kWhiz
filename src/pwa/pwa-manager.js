import { closeModal, openModal } from '../ui/modal-manager.js';
import { onLanguageChange, t } from '../i18n/i18n.js';

let installPrompt = null;
let installPromptInitialized = false;
let updateInProgress = false;
let serviceWorkerRegistrationPromise = null;

const PWA_TRACKING_EVENT = 'kwhiz:pwa-tracking';

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

export function showUpdateBanner({ onUpdate = updateApplication } = {}) {
    if (document.getElementById('kwhiz-update-popup')) return;

    const overlay = document.createElement('div');
    overlay.id = 'kwhiz-update-popup';
    overlay.className = 'update-popup-overlay update-popup-overlay--glass';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.tabIndex = -1;
    overlay.innerHTML = `
        <div class="update-popup update-popup--glass" role="dialog" aria-modal="true" aria-labelledby="kwhiz-update-title" aria-describedby="kwhiz-update-description">
            <p class="update-popup__title" id="kwhiz-update-title">${t('pwa.update.title')}</p>
            <p class="update-popup__body" id="kwhiz-update-description">${t('pwa.update.description')}</p>
            <div class="update-popup__actions">
                <button class="update-popup__btn" type="button">${t('pwa.update.refresh')}</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    const updateTranslations = () => {
        const title = overlay.querySelector('.update-popup__title');
        const description = overlay.querySelector('.update-popup__body');
        const refreshButton = overlay.querySelector('.update-popup__btn');
        if (title) title.textContent = t('pwa.update.title');
        if (description) description.textContent = t('pwa.update.description');
        if (refreshButton) refreshButton.textContent = t('pwa.update.refresh');
    };
    const stopUpdatingTranslations = onLanguageChange(updateTranslations);
    overlay.addEventListener('kwhiz:modalclose', () => {
        stopUpdatingTranslations();
        overlay.classList.remove('is-visible');
        overlay.remove();
    }, { once: true });
    openModal(overlay.id);
    requestAnimationFrame(() => overlay.classList.add('is-visible'));

    overlay.querySelector('.update-popup__btn')?.addEventListener('click', () => {
        closeModal(overlay.id);
        onUpdate();
    });
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
    initInstallPrompt();
    initServiceWorker();
}
