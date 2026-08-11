import { getLocale } from '../i18n/i18n.js';

export function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function safeUrl(url) {
    if (!url || !String(url).startsWith('https://')) return '';
    return escapeHtml(url);
}

export function formatNumber(number, decimals = 0) {
    return number.toLocaleString(getLocale(), {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

export function on(id, event, handler, options) {
    const element = document.getElementById(id);
    if (!element) {
        if (import.meta.env?.DEV) console.warn(`[kWhiz] Élément introuvable : #${id}`);
        return false;
    }
    element.addEventListener(event, handler, options);
    return true;
}

export function debounce(fn, delay) {
    let timer;
    return function debounced(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}
