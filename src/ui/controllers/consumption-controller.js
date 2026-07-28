export function initConsumptionController({ initialValue = 18, onChange }) {
    const vehicleNodes = [...document.querySelectorAll('.vehicle')];
    const sliderInput = document.getElementById('conso-slider');
    const fillEl = document.getElementById('conso-slider-fill');
    const thumbEl = document.getElementById('conso-slider-thumb');
    const valueEl = document.getElementById('consumption-value');

    let value = initialValue;
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

    if (sliderInput) {
        sliderInput.value = String(value);
        sliderInput.addEventListener('input', () => {
            value = Number.parseInt(sliderInput.value, 10);
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
        getValue: () => value
    };
}
