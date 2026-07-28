const VALID_PERIODS = new Set(['monthly', 'annual', 'none']);
const VALID_PRICING_TYPES = new Set(['fixed', 'range', 'discount', 'station']);
const VALID_CALCULATION_BASES = new Set(['official', 'midpoint', 'estimate']);
const HTTPS_URL = /^https:\/\//i;

function isFiniteNonNegative(value) {
    return Number.isFinite(value) && value >= 0;
}

export function validateTariffs(rawData, { validColors = null } = {}) {
    if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
        return { valid: false, data: {}, errors: ['Racine tarifs.json invalide'] };
    }

    const errors = [];
    const data = {};

    for (const [operatorKey, operator] of Object.entries(rawData)) {
        if (!operator || typeof operator !== 'object' || Array.isArray(operator)) {
            errors.push(`${operatorKey}: opérateur invalide`);
            continue;
        }

        const sanitized = { ...operator };

        if (validColors && !validColors.has(operator.color)) {
            errors.push(`${operatorKey}: couleur invalide « ${operator.color ?? ''} »`);
            sanitized.color = '';
        }

        if (operator.mapUrl && !HTTPS_URL.test(String(operator.mapUrl))) {
            errors.push(`${operatorKey}: mapUrl non HTTPS`);
            sanitized.mapUrl = '';
        }

        const formulas = [];
        for (const [index, formula] of (operator.formulas ?? []).entries()) {
            const label = `${operatorKey}/${formula?.name ?? `formule ${index + 1}`}`;
            const formulaErrors = [];

            if (!formula || typeof formula !== 'object' || Array.isArray(formula)) {
                formulaErrors.push('objet invalide');
            } else {
                if (!VALID_PERIODS.has(formula.period)) formulaErrors.push(`période invalide « ${formula.period} »`);
                if (!isFiniteNonNegative(formula.rate)) formulaErrors.push(`rate invalide « ${formula.rate} »`);
                if (!isFiniteNonNegative(formula.cost)) formulaErrors.push(`cost invalide « ${formula.cost} »`);
                if (!isFiniteNonNegative(formula.ref)) formulaErrors.push(`ref invalide « ${formula.ref} »`);
                const pricingType = formula.pricingType ?? 'fixed';
                const calculationBasis = formula.calculationBasis ?? 'official';
                if (!VALID_PRICING_TYPES.has(pricingType)) formulaErrors.push(`pricingType invalide « ${formula.pricingType} »`);
                if (!VALID_CALCULATION_BASES.has(calculationBasis)) formulaErrors.push(`calculationBasis invalide « ${formula.calculationBasis} »`);
                if (formula.verifiedAt && Number.isNaN(new Date(`${formula.verifiedAt}T12:00:00`).getTime())) formulaErrors.push('verifiedAt invalide');
                if (formula.sourceUrl && !HTTPS_URL.test(String(formula.sourceUrl))) formulaErrors.push('sourceUrl non HTTPS');
                if (pricingType === 'range' || pricingType === 'discount') {
                    if (!isFiniteNonNegative(formula.rateMin) || !isFiniteNonNegative(formula.rateMax) || formula.rateMin > formula.rateMax) formulaErrors.push('plage tarifaire invalide');
                }
            }

            if (formulaErrors.length) {
                errors.push(`${label}: ${formulaErrors.join(', ')}`);
                continue;
            }

            formulas.push({
                ...formula,
                pricingType: formula.pricingType ?? 'fixed',
                calculationBasis: formula.calculationBasis ?? 'official',
                verifiedAt: formula.verifiedAt ?? operator.verifiedAt ?? null,
                sourceUrl: formula.sourceUrl ?? operator.sourceUrl ?? null
            });
        }

        if (formulas.length === 0) {
            errors.push(`${operatorKey}: aucune formule valide`);
            continue;
        }

        sanitized.formulas = formulas;
        data[operatorKey] = sanitized;
    }

    return {
        valid: errors.length === 0,
        data,
        errors
    };
}
