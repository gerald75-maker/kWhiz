const MAX_SNAPSHOTS = 12;

function numeric(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

export function buildTariffSnapshot(operators, updatedAt = null, capturedAt = new Date().toISOString()) {
    const formulas = {};
    for (const [opKey, operator] of Object.entries(operators || {})) {
        for (const formula of operator.formulas || []) {
            const key = `${opKey}::${formula.name}`;
            formulas[key] = {
                rate: numeric(formula.rate),
                cost: numeric(formula.cost) ?? 0,
                period: formula.period || 'monthly'
            };
        }
    }
    return { updatedAt, capturedAt, formulas };
}

export function snapshotsDiffer(previous, next) {
    if (!previous || !next) return true;
    const previousKeys = Object.keys(previous.formulas || {}).sort();
    const nextKeys = Object.keys(next.formulas || {}).sort();
    if (previousKeys.join('|') !== nextKeys.join('|')) return true;
    return nextKeys.some(key => {
        const a = previous.formulas[key];
        const b = next.formulas[key];
        return a?.rate !== b?.rate || a?.cost !== b?.cost || a?.period !== b?.period;
    });
}

export function appendTariffSnapshot(history, snapshot, limit = MAX_SNAPSHOTS) {
    const clean = Array.isArray(history) ? history.filter(Boolean) : [];
    if (!snapshot || !Object.keys(snapshot.formulas || {}).length) return clean;
    const latest = clean.at(-1);
    if (!snapshotsDiffer(latest, snapshot)) return clean;
    return [...clean, snapshot].slice(-Math.max(2, limit));
}

export function getFormulaHistory(history, formulaKey) {
    return (Array.isArray(history) ? history : [])
        .map(snapshot => ({
            updatedAt: snapshot.updatedAt || null,
            capturedAt: snapshot.capturedAt || null,
            ...(snapshot.formulas?.[formulaKey] || {})
        }))
        .filter(item => item.rate !== undefined);
}

export function describeTariffChange(entries) {
    if (!Array.isArray(entries) || entries.length < 2) return { state: 'unknown', label: 'Pas encore d’historique', deltaRate: 0, deltaCost: 0 };
    const previous = entries.at(-2);
    const current = entries.at(-1);
    const deltaRate = (current.rate ?? 0) - (previous.rate ?? 0);
    const deltaCost = (current.cost ?? 0) - (previous.cost ?? 0);
    const epsilon = 0.0005;
    const state = Math.abs(deltaRate) < epsilon && Math.abs(deltaCost) < epsilon
        ? 'stable'
        : deltaRate > epsilon || deltaCost > epsilon ? 'up' : 'down';
    const label = state === 'stable' ? 'Tarif stable depuis le relevé précédent'
        : state === 'up' ? 'Tarif en hausse depuis le relevé précédent'
        : 'Tarif en baisse depuis le relevé précédent';
    return { state, label, deltaRate, deltaCost, previous, current };
}
