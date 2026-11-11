export const PERIOD = Object.freeze({
    MONTHLY: 'monthly',
    ANNUAL: 'annual',
    NONE: 'none'
});

export function getAtlanteGemsRate(config, date = new Date()) {
    if (!config?.enabled) return 0;

    const changeDate = new Date(`${config.beforeDate}T00:00:00+02:00`);
    if (date < changeDate) return config.rateBefore;

    if (config.promoEndDate) {
        const promoEnd = new Date(`${config.promoEndDate}T23:59:59+02:00`);
        if (date <= promoEnd) return config.rateAfter;
        return config.rateAfterPromo ?? config.rateAfter;
    }

    return config.rateAfter;
}

export function atlanteSteadyStateRate(nominalRate, gemsRate) {
    if (!Number.isFinite(nominalRate) || nominalRate < 0) return NaN;
    if (!Number.isFinite(gemsRate) || gemsRate <= 0) return nominalRate;
    return nominalRate / (1 + gemsRate);
}

export function simulateAtlanteChargeBack({ sessions, pricePerKwh, gemsRate, initialCredit = 0 }) {
    if (!Array.isArray(sessions)) throw new TypeError('sessions doit être un tableau');
    if (!Number.isFinite(pricePerKwh) || pricePerKwh < 0) throw new RangeError('pricePerKwh invalide');
    if (!Number.isFinite(gemsRate) || gemsRate < 0) throw new RangeError('gemsRate invalide');
    if (!Number.isFinite(initialCredit) || initialCredit < 0) throw new RangeError('initialCredit invalide');

    let credit = initialCredit;
    let totalGross = 0;
    let totalPaid = 0;
    let totalKwh = 0;

    for (const kwh of sessions) {
        if (!Number.isFinite(kwh) || kwh < 0) throw new RangeError('session kWh invalide');
        const gross = kwh * pricePerKwh;
        const creditUsed = Math.min(credit, gross);
        const paid = gross - creditUsed;
        const newCredit = paid * gemsRate;
        credit = (credit - creditUsed) + newCredit;

        totalGross += gross;
        totalPaid += paid;
        totalKwh += kwh;
    }

    return {
        totalGross,
        totalPaid,
        totalKwh,
        finalCredit: credit,
        effectivePricePerKwh: totalKwh > 0 ? totalPaid / totalKwh : pricePerKwh,
        discountRate: totalGross > 0 ? 1 - (totalPaid / totalGross) : 0
    };
}

export function buildAtlanteSessions(monthlyKm, consumption, count = 4) {
    if (!Number.isFinite(monthlyKm) || monthlyKm < 0) throw new RangeError('monthlyKm invalide');
    if (!Number.isFinite(consumption) || consumption < 0) throw new RangeError('consumption invalide');
    if (!Number.isInteger(count) || count <= 0) throw new RangeError('count invalide');

    const monthlyKwh = monthlyKm * consumption;
    return Array(count).fill(monthlyKwh / count);
}

export function calculateBreakeven(formula, consumption) {
    if (!formula || !Number.isFinite(consumption) || consumption <= 0) {
        return { kwh: Infinity, km: Infinity, costPer100km: Infinity, monthlyCost: Infinity };
    }

    const rate = formula.rate;
    const cost = formula.cost;
    const ref = formula.ref;

    if (![rate, cost, ref].every(Number.isFinite) || rate < 0 || cost < 0 || ref < 0) {
        return { kwh: Infinity, km: Infinity, costPer100km: Infinity, monthlyCost: Infinity };
    }

    const monthlyCost = formula.period === PERIOD.ANNUAL ? cost / 12 : cost;
    const costPer100km = rate * consumption * 100;

    if (formula.period === PERIOD.NONE || cost === 0) {
        return { kwh: 0, km: 0, costPer100km, monthlyCost: 0 };
    }

    if (formula.referenceUnavailable === true) {
        return { kwh: Infinity, km: Infinity, costPer100km, monthlyCost };
    }

    const saving = ref - rate;
    if (saving <= 0) return { kwh: Infinity, km: Infinity, costPer100km, monthlyCost };

    const kwhPerMonth = monthlyCost / saving;
    return {
        kwh: kwhPerMonth,
        km: kwhPerMonth / consumption,
        costPer100km,
        monthlyCost
    };
}

export function chargebackBreakeven(formula, consumption, gemsRate) {
    if (!formula || !Number.isFinite(consumption) || consumption <= 0) return Infinity;
    if (formula.period === PERIOD.NONE || formula.cost === 0) return 0;
    if (formula.referenceUnavailable === true) return Infinity;

    const effectiveRate = atlanteSteadyStateRate(formula.rate, gemsRate);
    const saving = formula.ref - effectiveRate;
    if (!Number.isFinite(saving) || saving <= 0) return Infinity;

    const monthlyCost = formula.period === PERIOD.ANNUAL ? formula.cost / 12 : formula.cost;
    return (monthlyCost / saving) / consumption;
}

export function computeProfileMonthlyCost(formula, monthlyKm, consumption, options = {}) {
    if (!formula || !Number.isFinite(monthlyKm) || monthlyKm < 0 || !Number.isFinite(consumption) || consumption < 0) {
        return Infinity;
    }

    const fastPercentage = Math.min(100, Math.max(0, Number(options.fastPercentage ?? 100)));
    const homeRate = Number(options.homeRate ?? 0.20);
    if (!Number.isFinite(homeRate) || homeRate < 0) return Infinity;

    const fastKm = monthlyKm * fastPercentage / 100;
    const homeKm = monthlyKm - fastKm;
    const homeCost = homeKm * consumption * homeRate;
    const subscriptionCost = Number.isFinite(formula.monthlyCost) ? formula.monthlyCost : 0;

    let fastCost;
    if (formula.chargebackConfig?.enabled && Number.isFinite(formula.rateRaw)) {
        const gemsRate = getAtlanteGemsRate(formula.chargebackConfig, options.date ?? new Date());
        const sessions = buildAtlanteSessions(
            fastKm,
            consumption,
            formula.chargebackConfig.sessionsPerMonth ?? 4
        );
        fastCost = simulateAtlanteChargeBack({
            sessions,
            pricePerKwh: formula.rateRaw,
            gemsRate,
            initialCredit: Number(options.initialCredit ?? 0)
        }).totalPaid;
    } else {
        fastCost = fastKm * consumption * formula.rate;
    }

    return homeCost + fastCost + subscriptionCost;
}

// Date du mois n à partir de start (jour plafonné au 28 pour ne pas sauter de mois).
function monthDate(start, offset) {
    return new Date(start.getFullYear(), start.getMonth() + offset, Math.min(start.getDate(), 28), 12);
}

// Coût sur les 12 prochains mois. Avec ChargeBack, chaque mois est calculé au taux
// en vigueur à sa date : la fin d'une promotion est donc prise en compte.
export function computeProfileAnnualCost(formula, monthlyKm, consumption, options = {}) {
    const start = options.date ?? new Date();
    if (!formula?.chargebackConfig?.enabled) {
        return computeProfileMonthlyCost(formula, monthlyKm, consumption, options) * 12;
    }
    let total = 0;
    for (let month = 0; month < 12; month += 1) {
        total += computeProfileMonthlyCost(formula, monthlyKm, consumption, { ...options, date: monthDate(start, month) });
    }
    return total;
}

// Changement de taux ChargeBack dans les 12 prochains mois : { endDate, rateNow, rateAfter } ou null.
export function chargebackChangeWithinYear(formula, date = new Date()) {
    const config = formula?.chargebackConfig;
    if (!config?.enabled || !config.promoEndDate) return null;
    const rateNow = getAtlanteGemsRate(config, date);
    const rateLater = getAtlanteGemsRate(config, monthDate(date, 11));
    if (rateNow === rateLater) return null;
    return { endDate: config.promoEndDate, rateNow, rateAfter: rateLater };
}

// Écart mensuel entre la formule la moins chère et la plus chère, tout en recharge rapide.
// Sert à chiffrer l'intérêt de comparer, dès l'accueil.
export function monthlyCostSpread(formulas, monthlyKm, consumption, options = {}) {
    const costs = formulas
        .map(formula => computeProfileMonthlyCost(formula, monthlyKm, consumption, { ...options, fastPercentage: 100 }))
        .filter(Number.isFinite);
    if (costs.length < 2) return null;
    const lowest = Math.min(...costs);
    const highest = Math.max(...costs);
    return { lowest, highest, spread: highest - lowest };
}
