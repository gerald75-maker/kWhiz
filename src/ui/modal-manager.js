let activeModal = null;
let previousFocus = null;

const FOCUSABLE = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'select:not([disabled])', 'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

function getFocusable(modal) {
    return [...modal.querySelectorAll(FOCUSABLE)].filter(element => !element.hidden);
}

export function openModal(id, trigger = document.activeElement) {
    const modal = document.getElementById(id);
    if (!modal) return false;

    if (activeModal && activeModal !== modal) closeModal(activeModal.id, false);
    previousFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;
    activeModal = modal;
    modal.classList.add('open');
    modal.removeAttribute('aria-hidden');
    document.body.classList.add('modal-open');

    const [first] = getFocusable(modal);
    window.requestAnimationFrame(() => (first || modal).focus());
    return true;
}

export function closeModal(id, restoreFocus = true) {
    const modal = typeof id === 'string' ? document.getElementById(id) : id;
    if (!modal) return false;

    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    if (activeModal === modal) activeModal = null;
    if (!activeModal) document.body.classList.remove('modal-open');

    if (restoreFocus && previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
    }
    return true;
}

export function initModalManager(definitions) {
    definitions.forEach(({ overlayId, closeId }) => {
        const overlay = document.getElementById(overlayId);
        const closeButton = document.getElementById(closeId);
        if (!overlay) return;

        overlay.setAttribute('aria-hidden', 'true');
        closeButton?.addEventListener('click', () => closeModal(overlayId));
        overlay.addEventListener('click', event => {
            if (event.target === overlay) closeModal(overlayId);
        });
    });

    document.addEventListener('keydown', event => {
        if (!activeModal) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            closeModal(activeModal.id);
            return;
        }
        if (event.key !== 'Tab') return;

        const focusable = getFocusable(activeModal);
        if (!focusable.length) {
            event.preventDefault();
            activeModal.focus();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });
}
