const DEFAULT_HIDE_DELAY = 2600;

export function initNetworkStatus({ onReconnect, hideDelay = DEFAULT_HIDE_DELAY } = {}) {
    const status = document.getElementById('network-status');
    const label = status?.querySelector('.network-status__label');
    if (!status || !label) return { update: () => {} };

    let hideTimer = null;
    let reconnecting = false;

    const clearHideTimer = () => {
        if (hideTimer) window.clearTimeout(hideTimer);
        hideTimer = null;
    };

    const show = (state, text, { persistent = false } = {}) => {
        clearHideTimer();
        status.dataset.state = state;
        status.classList.add('is-visible');
        label.textContent = text;

        if (!persistent) {
            hideTimer = window.setTimeout(() => {
                status.classList.remove('is-visible');
            }, hideDelay);
        }
    };

    const update = async () => {
        if (!navigator.onLine) {
            show('offline', 'Mode hors ligne — derniers tarifs enregistrés', { persistent: true });
            return;
        }

        if (reconnecting) return;
        reconnecting = true;
        show('syncing', 'Connexion rétablie — actualisation…', { persistent: true });

        try {
            const result = await onReconnect?.();
            if (result?.ok === false) {
                show('error', 'Connexion rétablie, mais les tarifs restent indisponibles');
            } else {
                show('online', 'Connexion rétablie — tarifs actualisés');
            }
        } catch {
            show('error', 'Connexion rétablie, mais l’actualisation a échoué');
        } finally {
            reconnecting = false;
        }
    };

    window.addEventListener('offline', update);
    window.addEventListener('online', update);

    if (!navigator.onLine) update();

    return { update };
}
