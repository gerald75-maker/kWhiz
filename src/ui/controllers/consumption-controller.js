export function initConsumptionController({ initialValue = 18, onChange, storageKey }) {
    const vehicleNodes = [...document.querySelectorAll('.vehicle')];
    const sliderInput = document.getElementById('conso-slider');
    const fillEl = document.getElementById('conso-slider-fill');
    const thumbEl = document.getElementById('conso-slider-thumb');
    const valueEl = document.getElementById('consumption-value');

    let value = Math.min(30, Math.max(10, Number.parseInt(initialValue, 10) || 18));
    let rafPending = false;

    function render({ animate = false } = {}) {
        const pct = ((value - 10) / 20) * 100;
        document.documentElement.style.setProperty('--consumption-slider-pct', `${pct}%`);
        if (valueEl) valueEl.textContent = String(value);

        let closest = null;
        let minDiff = Infinity;
        vehicleNodes.forEach(node => {
            const diff = Math.abs(Number.parseFloat(node.dataset.val) - value);
            if (diff < minDiff) {
                minDiff = diff;
                closest = node;
            }
        });
        vehicleNodes.forEach(node => {
            node.classList.remove('active');
            node.removeAttribute('aria-pressed');
        });
        if (minDiff <= 1 && closest) {
            closest.classList.add('active');
            closest.setAttribute('aria-pressed', 'true');
        }

        if (animate) {
            fillEl?.classList.add('is-jumping');
            thumbEl?.classList.add('is-jumping');
            window.setTimeout(() => {
                fillEl?.classList.remove('is-jumping');
                thumbEl?.classList.remove('is-jumping');
            }, 380);
        }
    }

    function notify() {
        onChange?.(value / 100, value);
    }

    function selectVehicle(node) {
        value = Number.parseInt(node.dataset.val, 10);
        if (sliderInput) sliderInput.value = String(value);
        render({ animate: true });
        notify();
    }

    function setValue(nextValue, { notifyChange = true } = {}) {
        value = Math.min(30, Math.max(10, Number.parseInt(nextValue, 10) || 18));
        if (sliderInput) sliderInput.value = String(value);
        render();
        if (storageKey) localStorage.setItem(storageKey, String(value));
        if (notifyChange) notify();
        return value;
    }

    if (sliderInput) {
        sliderInput.value = String(value);
        sliderInput.addEventListener('input', () => {
            value = Number.parseInt(sliderInput.value, 10);
            if (storageKey) localStorage.setItem(storageKey, String(value));
            render();
            if (!rafPending) {
                rafPending = true;
                requestAnimationFrame(() => {
                    rafPending = false;
                    notify();
                });
            }
        });
    }

    vehicleNodes.forEach(node => {
        node.addEventListener('click', () => selectVehicle(node));
        node.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectVehicle(node);
            }
        });
    });

    render();

    return {
        getConsumption: () => value / 100,
        getValue: () => value,
        setValue
    };
}
