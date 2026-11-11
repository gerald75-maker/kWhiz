import { VEHICLES, VEHICLE_SOURCE, findVehicle, vehicleLabel, vehicleSliderValue } from '../../config/vehicles.js';
import { formatDate, formatNumber, t } from '../../i18n/i18n.js';

export function initConsumptionController({ initialValue = 18, onChange, storageKey, vehicleStorageKey }) {
    const vehicleNodes = [...document.querySelectorAll('.vehicle')];
    const sliderInput = document.getElementById('conso-slider');
    const fillEl = document.getElementById('conso-slider-fill');
    const thumbEl = document.getElementById('conso-slider-thumb');
    const valueEl = document.getElementById('consumption-value');
    const modelSelect = document.getElementById('vehicle-model');
    const asOfEl = document.getElementById('vehicle-model-asof');

    // Modèle choisi : il reste actif tant que le curseur garde sa valeur.
    let vehicle = vehicleStorageKey ? findVehicle(readStorage(vehicleStorageKey)) : null;

    let value = Math.min(30, Math.max(10, Number.parseInt(initialValue, 10) || 18));
    let rafPending = false;

    function render({ animate = false } = {}) {
        const pct = ((value - 10) / 20) * 100;
        document.documentElement.style.setProperty('--consumption-slider-pct', `${pct}%`);
        if (valueEl) valueEl.textContent = String(value);

        if (vehicle && vehicleSliderValue(vehicle) !== value) setVehicle(null);
        if (modelSelect) modelSelect.value = vehicle?.id || '';

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
        if (!vehicle && minDiff <= 1 && closest) {
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

    function readStorage(key) {
        try { return localStorage.getItem(key); } catch { return null; }
    }

    function setVehicle(next) {
        vehicle = next;
        if (!vehicleStorageKey) return;
        try {
            if (next) localStorage.setItem(vehicleStorageKey, next.id);
            else localStorage.removeItem(vehicleStorageKey);
        } catch { /* stockage indisponible : le choix vaut pour la session */ }
    }

    function fillModelSelect() {
        if (!modelSelect) return;
        const placeholder = modelSelect.querySelector('option[value=""]');
        modelSelect.replaceChildren(...(placeholder ? [placeholder] : []));
        const brands = new Map();
        VEHICLES.forEach(item => {
            if (!brands.has(item.brand)) brands.set(item.brand, []);
            brands.get(item.brand).push(item);
        });
        brands.forEach((items, brand) => {
            const group = document.createElement('optgroup');
            group.label = brand;
            items.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = `${item.model} · ${formatNumber(item.whKm / 10, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh/100 km`;
                group.append(option);
            });
            modelSelect.append(group);
        });
    }

    function renderAsOf() {
        if (asOfEl) asOfEl.textContent = `(${t('consumption.model.asOf', { date: formatDate(VEHICLE_SOURCE.asOf) })})`;
    }

    function notify() {
        onChange?.(value / 100, value);
    }

    function selectVehicle(node) {
        setVehicle(null);
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

    fillModelSelect();
    renderAsOf();
    modelSelect?.addEventListener('change', () => {
        const next = findVehicle(modelSelect.value);
        setVehicle(next);
        if (next) setValue(vehicleSliderValue(next));
        else render();
    });

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
        refresh: () => { renderAsOf(); render(); },
        getVehicle: () => vehicle,
        getVehicleLabel: () => (vehicle ? vehicleLabel(vehicle) : ''),
        // Premier lancement : choix du modèle depuis la liste de l'accueil.
        chooseVehicle(id) {
            const next = findVehicle(id);
            if (!next) return null;
            setVehicle(next);
            setValue(vehicleSliderValue(next));
            return next;
        },
        getConsumption: () => value / 100,
        getValue: () => value,
        setValue
    };
}
