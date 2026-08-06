let installPrompt = null;
let updateInProgress = false;
let serviceWorkerRegistrationPromise = null;

function setInstallButtonVisibility(visible) {
    const button = document.getElementById('install-native-btn');
    if (button) button.hidden = !visible;
}

export function initInstallPrompt() {
    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        installPrompt = event;
        setInstallButtonVisibility(true);
    });

    window.addEventListener('appinstalled', () => {
        installPrompt = null;
        setInstallButtonVisibility(false);
    });
}

export async function triggerNativeInstall() {
    if (!installPrompt) return false;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    installPrompt = null;
    if (choice.outcome === 'accepted') setInstallButtonVisibility(false);
    return choice.outcome === 'accepted';
}

export function showUpdateBanner() {
    if (document.getElementById('kwhiz-update-popup')) return;

    const overlay = document.createElement('div');
    overlay.id = 'kwhiz-update-popup';
    overlay.className = 'update-popup-overlay update-popup-overlay--glass';
    overlay.innerHTML = `
        <div class="update-popup update-popup--glass" role="dialog" aria-modal="true" aria-labelledby="kwhiz-update-title">
            <p class="update-popup__title" id="kwhiz-update-title">Mise à jour disponible</p>
            <p class="update-popup__body">Une nouvelle version est disponible. Voulez-vous mettre à jour maintenant&nbsp;?</p>
            <div class="update-popup__actions">
                <button class="update-popup__btn" type="button">Actualiser</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-visible'));

    overlay.querySelector('.update-popup__btn')?.addEventListener('click', () => {
        overlay.classList.remove('is-visible');
        updateApplication();
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
