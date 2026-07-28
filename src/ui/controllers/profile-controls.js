import { debounce, on } from '../../shared/dom.js';

export function initProfileControls({ initialFastPercentage = 100, storageKey, onChange }) {
    let fastPercentage = initialFastPercentage;
    const profileKmInput = document.getElementById('profile-km');
    const kmChipsEl = document.getElementById('profile-km-chips');
    const kmOtherWrap = document.getElementById('profile-km-other-wrap');
    const kmChipOther = document.getElementById('km-chip-other');

    function renderFastPercentage() {
        const element = document.getElementById('fast-pct-value');
        if (element) element.textContent = `${fastPercentage} %`;
    }

    function notify() {
        onChange?.(fastPercentage);
    }

    function setKmChip(value) {
        kmChipsEl?.querySelectorAll('.km-chip').forEach(chip => chip.classList.remove('active'));
        const target = value === 'custom'
            ? kmChipOther
            : kmChipsEl?.querySelector(`.km-chip[data-val="${value}"]`);
        target?.classList.add('active');

        if (value === 'custom') {
            kmOtherWrap?.classList.add('visible');
            profileKmInput?.focus();
            return;
        }

        kmOtherWrap?.classList.remove('visible');
        if (profileKmInput) profileKmInput.value = value;
        notify();
    }

    kmChipsEl?.addEventListener('click', event => {
        const chip = event.target.closest('.km-chip');
        if (chip) setKmChip(chip.dataset.val);
    });

    profileKmInput?.addEventListener('input', debounce(() => {
        if (profileKmInput.value.length > 4) {
            profileKmInput.value = profileKmInput.value.slice(0, 4);
        }
        notify();
    }, 150));

    on('fast-pct-minus', 'click', () => {
        if (fastPercentage <= 0) return;
        fastPercentage = Math.max(0, fastPercentage - 10);
        localStorage.setItem(storageKey, String(fastPercentage));
        renderFastPercentage();
        notify();
    });

    on('fast-pct-plus', 'click', () => {
        if (fastPercentage >= 100) return;
        fastPercentage = Math.min(100, fastPercentage + 10);
        localStorage.setItem(storageKey, String(fastPercentage));
        renderFastPercentage();
        notify();
    });

    renderFastPercentage();

    return {
        getFastPercentage: () => fastPercentage
    };
}
