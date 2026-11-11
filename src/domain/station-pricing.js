// Prix affichés sur les stations de la carte, par réseau.
//
// - payg : meilleur prix sans abonnement du réseau. « from » signale qu'il existe
//   plusieurs prix ou un prix minimal (affiché « dès »), « approx » un prix qui
//   varie selon la station (affiché « ≈ »).
// - plan : prix avec un abonnement que l'utilisateur a mis en favori ou que kWhiz
//   lui recommande, chez ce même réseau. Le ChargeBack et les remises variables
//   rendent ce prix approximatif.
// - sortRate : prix le plus bas des deux, utilisé pour le tri « Les moins chères ».

function lowestRate(formula) {
    if ((formula.pricingType === 'range' || formula.pricingType === 'discount') && Number.isFinite(formula.rateMin)) {
        return formula.rateMin;
    }
    return formula.rate;
}

function isApproximate(formula) {
    return formula.pricingType === 'station'
        || formula.pricingType === 'range'
        || formula.pricingType === 'discount'
        || Number.isFinite(formula.chargebackRate);
}

export function formulaPlanId(formula) {
    return `${formula.opKey}::${formula.name}`;
}

export function buildStationPrices(formulas = [], { planIds = new Set() } = {}) {
    const byOperator = new Map();
    for (const formula of formulas) {
        if (!formula?.opKey || !Number.isFinite(lowestRate(formula))) continue;
        const entry = byOperator.get(formula.opKey) || { payg: [], plans: [] };
        if (formula.monthlyCost > 0) {
            if (planIds.has(formulaPlanId(formula))) entry.plans.push(formula);
        } else {
            entry.payg.push(formula);
        }
        byOperator.set(formula.opKey, entry);
    }

    const prices = new Map();
    for (const [opKey, { payg, plans }] of byOperator) {
        const bestPayg = [...payg].sort((a, b) => lowestRate(a) - lowestRate(b))[0] || null;
        const bestPlan = [...plans].sort((a, b) => lowestRate(a) - lowestRate(b))[0] || null;
        if (!bestPayg && !bestPlan) continue;
        const price = {
            payg: bestPayg ? {
                rate: lowestRate(bestPayg),
                from: payg.length > 1 || bestPayg.isMinimum === true || bestPayg.pricingType === 'range',
                approx: bestPayg.pricingType === 'station' && bestPayg.isMinimum !== true && payg.length === 1
            } : null,
            plan: bestPlan ? {
                rate: lowestRate(bestPlan),
                name: bestPlan.name,
                approx: isApproximate(bestPlan)
            } : null
        };
        price.sortRate = Math.min(price.payg?.rate ?? Infinity, price.plan?.rate ?? Infinity);
        prices.set(opKey, price);
    }
    return prices;
}

// Ordre « Les moins chères » : prix croissant, puis distance. Les stations sans prix connu passent après.
export function compareByPrice(prices, distanceOf) {
    const rateOf = station => (station.motorway === true ? Infinity : prices.get(station.operator)?.sortRate ?? Infinity);
    return (a, b) => {
        const rateA = rateOf(a);
        const rateB = rateOf(b);
        if (rateA !== rateB) return rateA - rateB;
        return distanceOf(a) - distanceOf(b);
    };
}
