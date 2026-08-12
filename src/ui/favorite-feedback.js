const hideTimers = new WeakMap();

export function showFavoriteFeedback(element, message, {
    duration = 2000,
    schedule = globalThis.setTimeout,
    cancel = globalThis.clearTimeout
} = {}) {
    if (!element || !message) return false;
    const previousTimer = hideTimers.get(element);
    if (previousTimer !== undefined) cancel(previousTimer);

    element.textContent = message;
    element.hidden = false;
    element.dataset.visible = 'true';
    const timer = schedule(() => {
        element.hidden = true;
        delete element.dataset.visible;
        hideTimers.delete(element);
    }, duration);
    hideTimers.set(element, timer);
    return true;
}
