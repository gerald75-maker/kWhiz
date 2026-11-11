// Panneaux bas (bottom sheets) : Mon profil, Pourquoi ce choix.
// Un seul panneau ouvert à la fois ; Échap, le fond ou un bouton
// [data-sheet-close] le ferment, et le focus revient au déclencheur.

let openedSheet = null;
let sheetTrigger = null;
let savedScrollY = 0;

function lockScroll() {
    savedScrollY = window.scrollY;
    document.body.classList.add('sheet-open');
    document.body.style.top = `-${savedScrollY}px`;
}

function unlockScroll() {
    document.body.classList.remove('sheet-open');
    document.body.style.top = '';
    window.scrollTo(0, savedScrollY);
}

export function isSheetOpen() {
    return Boolean(openedSheet);
}

export function openSheet(id, trigger = document.activeElement) {
    const sheet = document.getElementById(id);
    if (!sheet) return;
    if (openedSheet && openedSheet !== sheet) closeSheet({ restoreFocus: false });
    sheetTrigger = trigger instanceof HTMLElement ? trigger : null;
    openedSheet = sheet;
    sheet.hidden = false;
    sheet.removeAttribute('aria-hidden');
    lockScroll();
    requestAnimationFrame(() => {
        sheet.classList.add('open');
        sheet.querySelector('[data-sheet-focus]')?.focus({ preventScroll: true });
    });
}

export function closeSheet({ restoreFocus = true } = {}) {
    const sheet = openedSheet;
    if (!sheet) return;
    openedSheet = null;
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    unlockScroll();
    window.setTimeout(() => {
        if (openedSheet !== sheet) sheet.hidden = true;
    }, 220);
    if (restoreFocus && sheetTrigger?.isConnected) sheetTrigger.focus({ preventScroll: true });
    sheetTrigger = null;
}

export function initSheets() {
    document.addEventListener('click', event => {
        if (event.target.closest?.('[data-sheet-close]')) closeSheet();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && openedSheet) closeSheet();
    });
}
