import { computeProfileMonthlyCost } from '../domain/pricing.js';
import { escapeHtml, formatNumber } from '../shared/dom.js';

const HISTORY_LIMIT = 5;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function calculateScenarioComparison({ formulasData, consumption, homeRate, baselineKm, baselineFastPercentage, scenarioKm, scenarioFastPercentage }) {
    if (!Array.isArray(formulasData) || formulasData.length === 0) return null;

    const rank = (km, fastPercentage) => formulasData
        .map(formula => ({
            ...formula,
            scenarioMonthlyCost: computeProfileMonthlyCost(formula, km, consumption, { fastPercentage, homeRate })
        }))
        .sort((a, b) => a.scenarioMonthlyCost - b.scenarioMonthlyCost);

    const baseline = rank(baselineKm, baselineFastPercentage);
    const scenario = rank(scenarioKm, scenarioFastPercentage);

    return {
        baselineBest: baseline[0],
        scenarioBest: scenario[0],
        monthlyDifference: scenario[0].scenarioMonthlyCost - baseline[0].scenarioMonthlyCost,
        annualDifference: (scenario[0].scenarioMonthlyCost - baseline[0].scenarioMonthlyCost) * 12,
        changedFormula: baseline[0].opKey !== scenario[0].opKey || baseline[0].name !== scenario[0].name
    };
}

export function normalizeScenarioHistory(value, limit = HISTORY_LIMIT) {
    if (!Array.isArray(value)) return [];
    return value
        .filter(item => item && Number.isFinite(item.km) && Number.isFinite(item.fastPercentage)
            && typeof item.operator === 'string' && typeof item.formula === 'string'
            && Number.isFinite(item.monthlyCost))
        .map(item => ({
            id: String(item.id || `${item.km}-${item.fastPercentage}-${item.operator}-${item.formula}`),
            km: clamp(Math.round(item.km), 0, 9999),
            fastPercentage: clamp(Math.round(item.fastPercentage), 0, 100),
            operator: item.operator,
            formula: item.formula,
            monthlyCost: Math.max(0, item.monthlyCost),
            savedAt: item.savedAt || new Date().toISOString()
        }))
        .slice(0, limit);
}

export function addScenarioToHistory(history, scenario, limit = HISTORY_LIMIT) {
    const normalized = normalizeScenarioHistory([scenario], 1);
    if (!normalized.length) return normalizeScenarioHistory(history, limit);
    const next = normalized[0];
    const existing = normalizeScenarioHistory(history, limit)
        .filter(item => !(item.km === next.km && item.fastPercentage === next.fastPercentage));
    return [next, ...existing].slice(0, limit);
}

export function initScenarioSimulator({ getContext, storageKey = 'kwhiz_scenario_history' }) {
    const root = document.getElementById('scenario-simulator');
    const kmInput = document.getElementById('scenario-km');
    const fastInput = document.getElementById('scenario-fast');
    const fastValue = document.getElementById('scenario-fast-value');
    const result = document.getElementById('scenario-result');
    const resetButton = document.getElementById('scenario-reset');
    const historyRoot = document.getElementById('scenario-history');
    const historyList = document.getElementById('scenario-history-list');
    const clearHistoryButton = document.getElementById('scenario-history-clear');
    if (!root || !kmInput || !fastInput || !fastValue || !result) return null;

    let dirty = false;
    let currentComparison = null;
    let history = [];

    try {
        history = normalizeScenarioHistory(JSON.parse(localStorage.getItem(storageKey) || '[]'));
    } catch {
        history = [];
    }

    function persistHistory() {
        localStorage.setItem(storageKey, JSON.stringify(history));
    }

    function context() {
        return getContext?.() || {};
    }

    function syncFromProfile(force = false) {
        if (dirty && !force) return;
        const current = context();
        kmInput.value = String(Math.max(0, Math.round(current.baselineKm || 0)));
        fastInput.value = String(clamp(Math.round(current.baselineFastPercentage ?? 100), 0, 100));
        fastValue.textContent = `${fastInput.value} %`;
    }

    function renderHistory() {
        if (!historyRoot || !historyList) return;
        historyRoot.hidden = history.length === 0;
        historyList.innerHTML = history.map(item => `
            <article class="scenario-history-item" data-scenario-id="${escapeHtml(item.id)}">
                <button type="button" class="scenario-history-restore" data-scenario-restore="${escapeHtml(item.id)}">
                    <span><strong>${formatNumber(item.km, 0)} km/mois</strong> · ${formatNumber(item.fastPercentage, 0)} % rapide</span>
                    <small>${escapeHtml(item.operator)} · ${escapeHtml(item.formula)}</small>
                    <b>${formatNumber(item.monthlyCost, 2)} €/mois</b>
                </button>
                <button type="button" class="scenario-history-delete" data-scenario-delete="${escapeHtml(item.id)}" aria-label="Supprimer ce scénario">×</button>
            </article>`).join('');
    }

    function render() {
        const current = context();
        const scenarioKm = clamp(parseInt(kmInput.value, 10) || 0, 0, 9999);
        const scenarioFastPercentage = clamp(parseInt(fastInput.value, 10) || 0, 0, 100);
        fastValue.textContent = `${scenarioFastPercentage} %`;

        currentComparison = calculateScenarioComparison({
            ...current,
            scenarioKm,
            scenarioFastPercentage
        });

        if (!currentComparison) {
            result.innerHTML = '<p class="scenario-empty">Chargement des tarifs…</p>';
            return;
        }

        const difference = currentComparison.monthlyDifference;
        const direction = difference > 0.005 ? 'plus' : difference < -0.005 ? 'moins' : 'stable';
        const amount = Math.abs(difference);
        const differenceText = direction === 'stable'
            ? 'Coût mensuel quasi inchangé'
            : `${formatNumber(amount, 2)} € de ${direction === 'plus' ? 'plus' : 'moins'} par mois`;
        const differenceClass = direction === 'plus' ? 'is-higher' : direction === 'moins' ? 'is-lower' : 'is-stable';

        result.innerHTML = `
            <div class="scenario-summary">
                <div class="scenario-result-diff ${differenceClass}">${differenceText}</div>
                <p>${currentComparison.changedFormula
                    ? `Avec cet usage, ${escapeHtml(currentComparison.scenarioBest.operator)} · ${escapeHtml(currentComparison.scenarioBest.name)} devient la formule la moins chère à ${formatNumber(currentComparison.scenarioBest.scenarioMonthlyCost, 2)} €/mois.`
                    : `La formule de votre profil reste la moins chère, à ${formatNumber(currentComparison.scenarioBest.scenarioMonthlyCost, 2)} €/mois.`}</p>
            </div>
            <button type="button" class="scenario-save" id="scenario-save">Enregistrer ce scénario</button>`;

        document.getElementById('scenario-save')?.addEventListener('click', saveCurrentScenario);
    }

    function saveCurrentScenario() {
        if (!currentComparison) return;
        const scenario = {
            id: `${Date.now()}`,
            km: clamp(parseInt(kmInput.value, 10) || 0, 0, 9999),
            fastPercentage: clamp(parseInt(fastInput.value, 10) || 0, 0, 100),
            operator: currentComparison.scenarioBest.operator,
            formula: currentComparison.scenarioBest.name,
            monthlyCost: currentComparison.scenarioBest.scenarioMonthlyCost,
            savedAt: new Date().toISOString()
        };
        history = addScenarioToHistory(history, scenario);
        persistHistory();
        renderHistory();
        const button = document.getElementById('scenario-save');
        if (button) {
            button.textContent = 'Scénario enregistré';
            button.disabled = true;
        }
    }

    function applyPreset(preset) {
        const current = context();
        const baseKm = Math.max(0, Math.round(current.baselineKm || 0));
        const baseFast = clamp(Math.round(current.baselineFastPercentage ?? 100), 0, 100);

        if (preset === 'plus-5000') {
            kmInput.value = String(Math.min(9999, baseKm + Math.round(5000 / 12)));
            fastInput.value = String(baseFast);
        } else if (preset === 'plus-10000') {
            kmInput.value = String(Math.min(9999, baseKm + Math.round(10000 / 12)));
            fastInput.value = String(baseFast);
        } else if (preset === 'home-only') {
            kmInput.value = String(baseKm);
            fastInput.value = '0';
        } else if (preset === 'fast-only') {
            kmInput.value = String(baseKm);
            fastInput.value = '100';
        } else if (preset === 'holidays') {
            kmInput.value = String(Math.min(9999, Math.round(baseKm * 1.25)));
            fastInput.value = String(Math.min(100, baseFast + 20));
        }
        dirty = true;
        render();
    }

    root.querySelectorAll('[data-scenario-preset]').forEach(button => {
        button.addEventListener('click', () => applyPreset(button.dataset.scenarioPreset));
    });

    historyList?.addEventListener('click', event => {
        const restoreButton = event.target.closest('[data-scenario-restore]');
        if (restoreButton) {
            const item = history.find(entry => entry.id === restoreButton.dataset.scenarioRestore);
            if (!item) return;
            kmInput.value = String(item.km);
            fastInput.value = String(item.fastPercentage);
            dirty = true;
            render();
            return;
        }
        const deleteButton = event.target.closest('[data-scenario-delete]');
        if (deleteButton) {
            history = history.filter(item => item.id !== deleteButton.dataset.scenarioDelete);
            persistHistory();
            renderHistory();
        }
    });

    clearHistoryButton?.addEventListener('click', () => {
        history = [];
        persistHistory();
        renderHistory();
    });

    kmInput.addEventListener('input', () => {
        dirty = true;
        render();
    });
    fastInput.addEventListener('input', () => {
        dirty = true;
        render();
    });
    resetButton?.addEventListener('click', () => {
        dirty = false;
        syncFromProfile(true);
        render();
    });

    syncFromProfile(true);
    render();
    renderHistory();

    return {
        refresh() {
            syncFromProfile(false);
            render();
        },
        reset() {
            dirty = false;
            syncFromProfile(true);
            render();
        }
    };
}
