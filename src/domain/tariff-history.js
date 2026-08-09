const MAX_SNAPSHOTS = 12;

function numeric(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function verifiedDate(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const trimmed = value.trim();
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
        ? new Date(`${trimmed}T00:00:00Z`)
        : new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    const normalized = parsed.toISOString().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) && normalized !== trimmed ? null : normalized;
}

export function buildTariffSnapshot(operators, updatedAt = null, capturedAt = new Date().toISOString()) {
    const formulas = {};
    for (const [opKey, operator] of Object.entries(operators || {})) {
        for (const formula of operator.formulas || []) {
            const key = `${opKey}::${formula.name}`;
            formulas[key] = {
                rate: numeric(formula.rate),
                cost: numeric(formula.cost) ?? 0,
                period: formula.period || 'monthly',
                verifiedAt: verifiedDate(formula.verifiedAt)
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
        return a?.rate !== b?.rate || a?.cost !== b?.cost || a?.period !== b?.period
            || a?.verifiedAt !== b?.verifiedAt;
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
    const observationsByDate = new Map();

    (Array.isArray(history) ? history : []).forEach((snapshot, index) => {
        const formula = snapshot?.formulas?.[formulaKey];
        const formulaVerifiedAt = verifiedDate(formula?.verifiedAt);
        // Les anciens snapshots ne possèdent que updatedAt, date globale du
        // catalogue : elle est conservée dans le stockage mais ne peut pas être
        // attribuée de façon fiable à une formule et n'est donc pas affichée.
        if (!formula || formula.rate === undefined || !formulaVerifiedAt) return;

        const observation = {
            rate: numeric(formula.rate),
            cost: numeric(formula.cost) ?? 0,
            period: formula.period || 'monthly',
            verifiedAt: formulaVerifiedAt,
            capturedAt: snapshot.capturedAt || null,
            snapshotIndex: index
        };
        // Une date de vérification représente une observation : si plusieurs
        // snapshots globaux la répètent (avec ou sans valeurs identiques), la
        // dernière version fiable prévaut et la date n'apparaît qu'une fois.
        observationsByDate.set(formulaVerifiedAt, observation);
    });

    return [...observationsByDate.values()]
        .sort((a, b) => a.verifiedAt.localeCompare(b.verifiedAt) || a.snapshotIndex - b.snapshotIndex)
        .map(({ snapshotIndex, ...observation }) => observation);
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
