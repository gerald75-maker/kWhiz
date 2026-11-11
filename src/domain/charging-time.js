// Moment de recharge déclaré dans Mon profil.
// Seules les formules publiées sous forme de fourchette et calculées au milieu de
// celle-ci (prix dynamique Electra) en dépendent : on retient le bas de la fourchette
// en heures creuses, le haut en heures de pointe, le milieu sinon. Le tarif de
// référence sans abonnement est décalé d'autant, pour que le seuil de rentabilité
// compare deux prix pris au même moment de la journée.

export const CHARGING_TIMES = Object.freeze(['offpeak', 'any', 'peak']);
export const DEFAULT_CHARGING_TIME = 'any';

export function normalizeChargingTime(value) {
    return CHARGING_TIMES.includes(value) ? value : DEFAULT_CHARGING_TIME;
}

export function dependsOnChargingTime(formula) {
    return Boolean(formula)
        && (formula.pricingType === 'range' || formula.pricingType === 'discount')
        && formula.calculationBasis === 'midpoint'
        && Number.isFinite(formula.rate)
        && Number.isFinite(formula.rateMin)
        && Number.isFinite(formula.rateMax)
        && formula.rateMin <= formula.rateMax;
}

const round4 = value => Math.round(value * 10000) / 10000;

export function applyChargingTime(formula, chargingTime) {
    if (!dependsOnChargingTime(formula)) return formula;
    const time = normalizeChargingTime(chargingTime);
    if (time === 'any') return formula;
    const rate = time === 'offpeak' ? formula.rateMin : formula.rateMax;
    const shift = rate - formula.rate;
    return {
        ...formula,
        rate,
        ref: Number.isFinite(formula.ref) ? round4(formula.ref + shift) : formula.ref
    };
}
