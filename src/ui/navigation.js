import { on } from '../shared/dom.js';

const VIEW_TAB = { compare: 'ranking', operators: 'operators', map: 'map', profile: 'profile' };

export function initNavigation({ initialView = 'profile', onViewChange, onToggleTheme }) {
    let currentView = initialView;
    let drawerScrollY = 0;
    let drawerTrigger = null;
    let touchStartY = null;
    let pageTrigger = null;

    function closeAllPages({ restoreFocus = false } = {}) {
        const openPages = [...document.querySelectorAll('.page-overlay.open')];
        if (!openPages.length) return;
        openPages.forEach(page => {
            page.classList.remove('open');
            page.setAttribute('aria-hidden', 'true');
        });
        unlockBackgroundScroll();
        setActiveNav(`bnav-${currentView}`);
        if (restoreFocus && pageTrigger instanceof HTMLElement) pageTrigger.focus();
        pageTrigger = null;
    }

    function setActiveNav(id) {
        document.querySelectorAll('.bnav-item').forEach(item => {
            const active = item.id === id;
            item.classList.toggle('active', active);
            item.setAttribute('aria-current', active ? 'page' : 'false');
        });
    }

    function lockBackgroundScroll() {
        drawerScrollY = window.scrollY;
        document.documentElement.classList.add('menu-open');
        document.body.classList.add('menu-open');
        document.body.style.top = `-${drawerScrollY}px`;
    }

    function unlockBackgroundScroll() {
        document.documentElement.classList.remove('menu-open');
        document.body.classList.remove('menu-open');
        document.body.style.top = '';
        window.scrollTo(0, drawerScrollY);
    }

    function openDrawer() {
        const drawer = document.getElementById('menu-drawer');
        if (!drawer || drawer.classList.contains('open')) return;
        drawerTrigger = document.activeElement;
        lockBackgroundScroll();
        drawer.classList.add('open');
        drawer.removeAttribute('aria-hidden');
        setActiveNav('bnav-menu');
        document.getElementById('bnav-menu')?.setAttribute('aria-expanded', 'true');
        document.getElementById('menu-close')?.focus();
    }

    function closeDrawer() {
        const drawer = document.getElementById('menu-drawer');
        if (!drawer || !drawer.classList.contains('open')) return;
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
        unlockBackgroundScroll();
        setActiveNav(`bnav-${currentView}`);
        document.getElementById('bnav-menu')?.setAttribute('aria-expanded', 'false');
        const focusTarget = drawerTrigger instanceof HTMLElement ? drawerTrigger : document.getElementById('bnav-menu');
        focusTarget?.focus();
        drawerTrigger = null;
    }

    function switchView(view) {
        const tabId = VIEW_TAB[view] || 'ranking';
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`tab-${tabId}`)?.classList.add('active');
        currentView = view;
        document.body.dataset.view = view;
        setActiveNav(`bnav-${view}`);
        closeAllPages();
        closeDrawer();
        onViewChange?.(view);
    }

    function openPage(id) {
        pageTrigger = document.activeElement;
        closeDrawer();
        closeAllPages();
        const page = document.getElementById(id);
        if (!page) return;
        lockBackgroundScroll();
        page.classList.add('open');
        page.removeAttribute('aria-hidden');
        setActiveNav('bnav-menu');
        page.querySelector('.page-close')?.focus();
    }

    on('bnav-compare', 'click', () => switchView('compare'));
    on('bnav-operators', 'click', () => switchView('operators'));
    on('bnav-profile', 'click', () => switchView('profile'));
    on('bnav-map', 'click', () => switchView('map'));
    on('bnav-menu', 'click', event => {
        // La barre inférieure reste au-dessus du backdrop. Empêcher toute propagation
        // évite qu'un même geste ferme le panneau puis déclenche une autre navigation
        // sur iOS/PWA. Un second appui sur Menu ferme uniquement le menu.
        event.preventDefault();
        event.stopPropagation();
        const drawer = document.getElementById('menu-drawer');
        if (drawer?.classList.contains('open')) {
            closeDrawer();
            return;
        }
        openDrawer();
    });

    on('menu-drawer-backdrop', 'click', closeDrawer);
    on('menu-close', 'click', closeDrawer);
    on('menu-help', 'click', () => openPage('page-aide'));
    on('menu-about', 'click', () => openPage('page-about'));
    on('menu-infos', 'click', () => openPage('page-infos'));
    on('menu-settings', 'click', () => openPage('page-settings'));
    on('menu-theme', 'click', () => { onToggleTheme?.(); closeDrawer(); });

    document.addEventListener('keydown', event => {
        const drawer = document.getElementById('menu-drawer');
        const activeLayer = drawer?.classList.contains('open')
            ? drawer
            : document.querySelector('.page-overlay.open');
        if (!activeLayer) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            activeLayer === drawer ? closeDrawer() : closeAllPages({ restoreFocus: true });
            return;
        }

        if (event.key === 'Tab') {
            const focusable = [...activeLayer.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
                .filter(element => element.offsetParent !== null);
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });

    const drawerSheet = document.querySelector('.menu-drawer-sheet');
    drawerSheet?.addEventListener('touchstart', event => {
        touchStartY = event.touches[0]?.clientY ?? null;
    }, { passive: true });
    drawerSheet?.addEventListener('touchend', event => {
        if (touchStartY === null) return;
        const endY = event.changedTouches[0]?.clientY ?? touchStartY;
        const distance = endY - touchStartY;
        touchStartY = null;
        if (distance > 70 && drawerSheet.scrollTop <= 0) closeDrawer();
    }, { passive: true });

    ['close-about', 'close-infos', 'close-aide', 'close-settings'].forEach(id => {
        on(id, 'click', () => closeAllPages({ restoreFocus: true }));
    });

    document.querySelectorAll('.page-overlay-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', () => closeAllPages({ restoreFocus: true }));
    });

    document.querySelectorAll('.page-overlay-sheet').forEach(sheet => {
        let pageTouchStartY = null;
        sheet.addEventListener('touchstart', event => {
            pageTouchStartY = event.touches[0]?.clientY ?? null;
        }, { passive: true });
        sheet.addEventListener('touchend', event => {
            if (pageTouchStartY === null) return;
            const endY = event.changedTouches[0]?.clientY ?? pageTouchStartY;
            const distance = endY - pageTouchStartY;
            pageTouchStartY = null;
            if (distance > 70 && sheet.scrollTop <= 0) closeAllPages({ restoreFocus: true });
        }, { passive: true });
    });

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(item => {
                item.classList.remove('active');
                item.setAttribute('aria-selected', 'false');
            });
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            const view = Object.entries(VIEW_TAB).find(([, tabId]) => tabId === tab.dataset.tab)?.[0] || 'compare';
            switchView(view);
        });
    });

    document.body.dataset.view = currentView;

    return {
        getCurrentView: () => currentView,
        switchView,
        openPage,
        closeAllPages,
        setActiveNav
    };
}
