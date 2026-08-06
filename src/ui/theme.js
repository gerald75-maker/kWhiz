import { STORAGE_KEYS } from '../config/app-config.js';

const SVG_SUN = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/></svg>`;
const SVG_MOON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

export function applyTheme(theme) {
    const isLight = theme === 'light';
    document.body.classList.toggle('light', isLight);

    const icon = document.getElementById('menu-theme-icon');
    const label = document.getElementById('menu-theme-label');
    if (icon) icon.innerHTML = isLight ? SVG_MOON : SVG_SUN;
    if (label) label.textContent = isLight ? 'Mode sombre' : 'Mode clair';
}

export function setTheme(theme) {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEYS.theme, theme);
}

export function toggleTheme() {
    const nextTheme = document.body.classList.contains('light') ? 'dark' : 'light';
    setTheme(nextTheme);
    return nextTheme;
}

export function initTheme() {
    const legacy = localStorage.getItem(STORAGE_KEYS.legacyTheme);
    if (legacy) {
        localStorage.setItem(STORAGE_KEYS.theme, legacy);
        localStorage.removeItem(STORAGE_KEYS.legacyTheme);
    }

    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    if (saved) applyTheme(saved);
    else if (window.matchMedia('(prefers-color-scheme: light)').matches) applyTheme('light');

    const colorScheme = window.matchMedia('(prefers-color-scheme: light)');
    const handleColorSchemeChange = event => {
        if (!localStorage.getItem(STORAGE_KEYS.theme)) {
            applyTheme(event.matches ? 'light' : 'dark');
        }
    };

    if (typeof colorScheme.addEventListener === 'function') {
        colorScheme.addEventListener('change', handleColorSchemeChange);
    } else if (typeof colorScheme.addListener === 'function') {
        colorScheme.addListener(handleColorSchemeChange);
    }
}
