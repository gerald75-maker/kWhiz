import { onLanguageChange, t } from '../i18n/i18n.js';

const DEFAULT_HIDE_DELAY = 2600;

export function networkStatusLabel(key) { return t(key); }

export function initNetworkStatus({ onReconnect, hideDelay = DEFAULT_HIDE_DELAY } = {}) {
    const status = document.getElementById('network-status');
    const label = status?.querySelector('.network-status__label');
    if (!status || !label) return { update: () => {}, destroy: () => {} };

    let hideTimer = null;
    let reconnecting = false;
    let currentMessageKey = null;

    const clearHideTimer = () => {
        if (hideTimer) window.clearTimeout(hideTimer);
        hideTimer = null;
    };

    const render = () => {
        if (currentMessageKey) label.textContent = networkStatusLabel(currentMessageKey);
    };

    const show = (state, messageKey, { persistent = false } = {}) => {
        clearHideTimer();
        status.dataset.state = state;
        status.classList.add('is-visible');
        currentMessageKey = messageKey;
        render();

        if (!persistent) {
            hideTimer = window.setTimeout(() => {
                status.classList.remove('is-visible');
            }, hideDelay);
        }
    };

    const update = async () => {
        if (!navigator.onLine) {
            show('offline', 'network.offlineLocal', { persistent: true });
            return;
        }

        if (reconnecting) return;
        reconnecting = true;
        show('syncing', 'network.reconnecting', { persistent: true });

        try {
            const result = await onReconnect?.();
            if (result?.ok === false) {
                show('error', 'network.pricesUnavailable');
            } else {
                show('online', 'network.restored');
            }
        } catch {
            show('error', 'network.refreshFailed');
        } finally {
            reconnecting = false;
        }
    };

    window.addEventListener('offline', update);
    window.addEventListener('online', update);
    const stopLanguageListener = onLanguageChange(render);

    if (!navigator.onLine) update();

    return {
        update,
        destroy() {
            clearHideTimer();
            window.removeEventListener('offline', update);
            window.removeEventListener('online', update);
            stopLanguageListener();
        }
    };
}
