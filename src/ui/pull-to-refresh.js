import { onLanguageChange, t } from '../i18n/i18n.js';

const DEFAULTS = {
    threshold: 72,
    maxPull: 118,
    resistance: 0.48
};

export function refreshStatusLabel(state) { return t(`refresh.${state}`); }

/**
 * Active le geste « tirer pour rafraîchir » sur les écrans tactiles.
 * Le rafraîchissement ne démarre que lorsque la page est déjà tout en haut.
 */
export function initPullToRefresh({ onRefresh, trigger = document.getElementById('app-refresh-button'), ...options } = {}) {
    const indicator = document.getElementById('pull-to-refresh');
    const label = indicator?.querySelector('.pull-to-refresh__label');
    const icon = indicator?.querySelector('.pull-to-refresh__icon');
    const supportsTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    if (!indicator || typeof onRefresh !== 'function') {
        return { destroy() {} };
    }

    const config = { ...DEFAULTS, ...options };
    let startY = 0;
    let startX = 0;
    let pullDistance = 0;
    let tracking = false;
    let refreshing = false;
    let readyFeedbackSent = false;
    let resetTimer = null;

    let currentState = 'idle';

    const renderLabel = () => {
        if (label) label.textContent = refreshStatusLabel(currentState);
    };

    const setState = (state, distance = 0) => {
        currentState = state;
        indicator.dataset.state = state;
        indicator.style.setProperty('--pull-distance', `${Math.round(distance)}px`);
        renderLabel();
        if (icon) icon.setAttribute('aria-hidden', 'true');
    };

    const reset = () => {
        if (resetTimer) {
            window.clearTimeout(resetTimer);
            resetTimer = null;
        }
        tracking = false;
        pullDistance = 0;
        readyFeedbackSent = false;
        indicator.classList.remove('is-visible', 'is-refreshing');
        setState('idle', 0);
    };

    const scheduleReset = delay => {
        if (resetTimer) window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(reset, delay);
    };

    const runRefresh = async () => {
        if (refreshing) return { ok: false, busy: true };
        refreshing = true;
        trigger?.setAttribute('aria-busy', 'true');
        trigger?.setAttribute('aria-disabled', 'true');
        indicator.classList.add('is-visible', 'is-refreshing');
        setState('refreshing', config.threshold);

        try {
            const setRefreshState = state => setState(state, config.threshold);
            const result = await onRefresh({ setStatus: setRefreshState });
            const succeeded = result?.ok !== false;
            const finalState = result?.state || (succeeded ? 'success' : 'error');
            setState(finalState, config.threshold);
            navigator.vibrate?.(succeeded ? 18 : [30, 45, 30]);
            if (!result?.reloadPending) scheduleReset(succeeded ? 850 : 1500);
            return result;
        } catch (error) {
            console.warn('[PullToRefresh] Actualisation impossible', error);
            setState('error', config.threshold);
            navigator.vibrate?.([30, 45, 30]);
            scheduleReset(1500);
            return { ok: false, state: 'error', error };
        } finally {
            refreshing = false;
            indicator.classList.remove('is-refreshing');
            trigger?.removeAttribute('aria-busy');
            trigger?.removeAttribute('aria-disabled');
        }
    };

    const handleStart = event => {
        if (refreshing || window.scrollY > 0 || event.touches.length !== 1) return;
        if (event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
        startY = event.touches[0].clientY;
        startX = event.touches[0].clientX;
        tracking = true;
        pullDistance = 0;
    };

    const handleMove = event => {
        if (!tracking || refreshing || event.touches.length !== 1) return;

        const deltaY = event.touches[0].clientY - startY;
        const deltaX = Math.abs(event.touches[0].clientX - startX);
        if (deltaY <= 0 || deltaX > deltaY) {
            reset();
            return;
        }

        // Empêche le rebond natif uniquement après reconnaissance du geste vertical.
        event.preventDefault();
        pullDistance = Math.min(config.maxPull, deltaY * config.resistance);
        indicator.classList.add('is-visible');
        const isReady = pullDistance >= config.threshold;
        setState(isReady ? 'ready' : 'pulling', pullDistance);

        if (isReady && !readyFeedbackSent) {
            readyFeedbackSent = true;
            navigator.vibrate?.(12);
        } else if (!isReady) {
            readyFeedbackSent = false;
        }
    };

    const handleEnd = async () => {
        if (!tracking || refreshing) return;
        tracking = false;

        if (pullDistance < config.threshold) {
            reset();
            return;
        }

        await runRefresh();
    };

    const handleTrigger = () => { void runRefresh(); };
    if (supportsTouch) {
        document.addEventListener('touchstart', handleStart, { passive: true });
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('touchend', handleEnd, { passive: true });
        document.addEventListener('touchcancel', reset, { passive: true });
    }
    trigger?.addEventListener('click', handleTrigger);
    const stopLanguageListener = onLanguageChange(renderLabel);

    return {
        refresh: runRefresh,
        destroy() {
            if (resetTimer) window.clearTimeout(resetTimer);
            document.removeEventListener('touchstart', handleStart);
            document.removeEventListener('touchmove', handleMove);
            document.removeEventListener('touchend', handleEnd);
            document.removeEventListener('touchcancel', reset);
            trigger?.removeEventListener('click', handleTrigger);
            stopLanguageListener();
        }
    };
}
