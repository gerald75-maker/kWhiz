import { PERIOD, computeProfileMonthlyCost } from '../../domain/pricing.js';
import { escapeHtml, formatNumber } from '../../shared/dom.js';
import { formatDate, formatTariffsFreshness, formatTariffsVerifiedOn, getLanguage, getLocale, t } from '../../i18n/i18n.js';

const COPY = {
    fr: {
        count: count => `${count} formule${count > 1 ? 's' : ''}`,
        estimatedCost: 'Coût estimé',
        fastCharging: 'Recharge rapide',
        subscription: 'Abonnement',
        profitability: 'Rentabilité',
        noSubscription: 'Sans abonnement',
        notProfitable: 'Abonnement non rentable',
        noFastCharging: 'Abonnement non pertinent sans recharge rapide',
        enterMileage: 'Indiquez votre kilométrage mensuel pour comparer les formules.',
        summary: (km, fast, consumption) => `Calcul pour ${km} km/mois, dont ${fast} % sur des bornes rapides, avec une consommation de ${consumption} kWh/100 km. Le coût de recharge à domicile, identique pour toutes les formules, n’influence pas ce classement. Le seuil de rentabilité est calculé face au tarif de référence de l’opérateur.`,
        saves: amount => `Vous économisez ${amount} €/mois`,
        smallSaving: 'Économie inférieure à 0,50 €/mois',
        costsMore: amount => `L’abonnement vous coûte encore ${amount} €/mois de plus`,
        referenceUnavailable: 'Comparaison au tarif de référence indisponible',
        noSubscriptionComparison: 'Tarif sans abonnement',
        atlanteEstimate: rate => `Tarif nominal et ChargeBack estimé selon 4 sessions : environ ${rate} €/kWh payé. Le résultat dépend du rythme des sessions et n’est pas garanti.`,
        perMonth: 'mois',
        perYear: 'an',
        monthlyEquivalent: 'soit',
        details: 'Détails tarifaires',
        viewDetails: 'Voir le détail de',
        empty: 'Aucune formule ne correspond à cette recherche.'
    },
    en: {
        count: count => `${count} plan${count === 1 ? '' : 's'}`,
        estimatedCost: 'Estimated cost',
        fastCharging: 'Fast charging',
        subscription: 'Subscription',
        profitability: 'Break-even',
        noSubscription: 'No subscription',
        notProfitable: 'Subscription does not break even',
        noFastCharging: 'Subscription is not relevant without fast charging',
        enterMileage: 'Enter your monthly mileage to compare plans.',
        summary: (km, fast, consumption) => `Calculation for ${km} km/month, including ${fast}% at fast chargers, with an efficiency of ${consumption} kWh/100 km. Home charging costs the same for every plan and does not affect this ranking. Break-even is calculated against the network’s reference price.`,
        saves: amount => `You save ${amount} €/month`,
        smallSaving: 'Saving is less than €0.50/month',
        costsMore: amount => `The subscription still costs you ${amount} €/month more`,
        referenceUnavailable: 'Reference-price comparison unavailable',
        noSubscriptionComparison: 'Pay-as-you-go plan',
        atlanteEstimate: rate => `Nominal price with estimated ChargeBack over 4 sessions: approximately ${rate} €/kWh paid. The result depends on session timing and is not guaranteed.`,
        perMonth: 'month',
        perYear: 'year',
        monthlyEquivalent: 'equivalent to',
        details: 'Pricing details',
        viewDetails: 'View details for',
        empty: 'No plan matches this search.'
    }
};

export function renderTarifsDateBanner(updatedAt, isError, freshness = null, source = 'online') {
    const banner = document.getElementById('tarifs-update-banner');
    const text = document.getElementById('tarifs-update-text');
    if (!banner || !text) return;
    banner.classList.toggle('tariffs-update-banner--error', isError);
    banner.classList.toggle('tariffs-update-banner--stale', freshness?.state === 'stale' || freshness?.state === 'critical');
    banner.classList.add('tariffs-update-banner--visible');
    const freshnessLabel = formatTariffsFreshness(freshness);
    const sourceLabel = t(`tariffs.source.${source}`);
    const verifiedLabel = t('tariffs.status.verifiedOn', { date: updatedAt ? formatDate(updatedAt) : '' });
    text.textContent = isError
        ? `⚠️ ${t('tariffs.status.unavailableCheckConnection')}`
        : freshness?.state === 'critical'
            ? `⚠️ ${freshnessLabel} — ${t('tariffs.status.verifyBeforeChoosing')}`
            : freshness?.state === 'stale'
                ? `⚠️ ${freshnessLabel}`
                : `${verifiedLabel} · ${sourceLabel}`;

    const infosDate = document.getElementById('infos-tarifs-date');
    if (infosDate) infosDate.textContent = isError
        ? t('tariffs.status.offlineEmbedded')
        : freshness?.state === 'critical'
            ? `⚠️ ${freshnessLabel} — ${t('tariffs.status.verifyBeforeChoosing')}`
            : freshness?.state === 'stale'
                ? `⚠️ ${freshnessLabel}`
                : `${verifiedLabel} · ${sourceLabel}`;
}

export function rankTierClass(rate, lowest) {
    if (!isFinite(rate) || !isFinite(lowest) || lowest <= 0) return '';
    if (rate <= lowest + 1e-9) return 'rank-best';
    const gapPct = (rate - lowest) / lowest * 100;
    return gapPct <= 15 ? 'rank-mid' : 'rank-high';
}

export function filterComparisonFormulas(formulas, query) {
    const normalizedQuery = query.trim().toLocaleLowerCase(getLocale());
    return formulas.filter(formula => !normalizedQuery
        || `${formula.operator} ${formula.name}`.toLocaleLowerCase(getLocale()).includes(normalizedQuery));
}

export function openComparisonRecommendation(navigation) {
    navigation?.switchView('profile');
}

export function adjustedThreshold(formulaKm, fastPercentage) {
    if (formulaKm === 0) return 0;
    if (!Number.isFinite(formulaKm) || fastPercentage <= 0) return Infinity;
    return Math.ceil(formulaKm / (fastPercentage / 100));
}

export function buildComparisonRanking(formulas, { monthlyKm, consumption, fastPercentage, homeRate, date = new Date() }) {
    if (!(monthlyKm > 0)) return [];
    const fastRatio = Math.min(100, Math.max(0, fastPercentage)) / 100;
    const fastKm = monthlyKm * fastRatio;
    const fastKwh = fastKm * consumption;
    const homeCost = (monthlyKm - fastKm) * consumption * homeRate;

    return formulas.map((formula, catalogIndex) => {
        const profileCost = computeProfileMonthlyCost(formula, monthlyKm, consumption, { fastPercentage, homeRate, date });
        const estimatedMonthlyCost = Number.isFinite(profileCost) ? Math.max(0, profileCost - homeCost) : Infinity;
        const subscriptionCost = Number.isFinite(formula.monthlyCost) ? formula.monthlyCost : 0;
        const fastChargingCost = Number.isFinite(estimatedMonthlyCost)
            ? Math.max(0, estimatedMonthlyCost - subscriptionCost)
            : Infinity;
        const referenceCost = Number.isFinite(formula.ref) ? fastKwh * formula.ref : Infinity;
        const subscriptionBenefit = subscriptionCost > 0 && Number.isFinite(referenceCost) && Number.isFinite(estimatedMonthlyCost)
            ? referenceCost - estimatedMonthlyCost
            : null;
        return {
            ...formula,
            catalogIndex,
            fastKm,
            fastKwh,
            estimatedMonthlyCost,
            fastChargingCost,
            subscriptionBenefit,
            adjustedThresholdKm: adjustedThreshold(formula.km, fastPercentage)
        };
    }).sort((a, b) => {
        if (!Number.isFinite(a.estimatedMonthlyCost) && !Number.isFinite(b.estimatedMonthlyCost)) return a.catalogIndex - b.catalogIndex;
        if (!Number.isFinite(a.estimatedMonthlyCost)) return 1;
        if (!Number.isFinite(b.estimatedMonthlyCost)) return -1;
        return a.estimatedMonthlyCost - b.estimatedMonthlyCost || a.catalogIndex - b.catalogIndex;
    });
}


function pricingBadge(formula) {
    if (formula.pricingType === 'station') return '<span class="compare-pricing-badge is-variable">Tarif variable</span>';
    if (formula.pricingType === 'range') return '<span class="compare-pricing-badge is-variable">Plage tarifaire</span>';
    if (formula.pricingType === 'discount') return '<span class="compare-pricing-badge is-discount">Remise</span>';
    return '<span class="compare-pricing-badge is-fixed">Tarif fixe</span>';
}

function rateLabel(formula) {
    if ((formula.pricingType === 'range' || formula.pricingType === 'discount') && Number.isFinite(formula.rateMin) && Number.isFinite(formula.rateMax)) {
        return `${formatNumber(formula.rateMin, 2)}–${formatNumber(formula.rateMax, 2)} €/kWh`;
    }
    if (formula.pricingType === 'station') return `≈ ${formatNumber(formula.rate, 2)} €/kWh`;
    return `${formatNumber(formula.rate, formula.chargebackRate !== null ? 3 : 2)} €/kWh`;
}

function formatComparisonNumber(value, language, fractionDigits) {
    return new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'fr-FR', fractionDigits === undefined ? {} : {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits
    }).format(value);
}

export function profileThresholdLabel(formula, fastPercentage, language = getLanguage()) {
    const copy = COPY[language];
    if (!(formula.monthlyCost > 0)) return copy.noSubscription;
    if (fastPercentage <= 0) return copy.noFastCharging;
    if (!Number.isFinite(formula.adjustedThresholdKm)) return copy.notProfitable;
    const total = formatComparisonNumber(formula.adjustedThresholdKm, language);
    const fast = formatComparisonNumber(Math.ceil(formula.km), language);
    if (fastPercentage >= 100) return `${language === 'en' ? 'Break-even from' : 'Rentable dès'} ${total} km/${copy.perMonth}`;
    return language === 'en'
        ? `Break-even from ${total} km/month total, including ${fast} km at fast chargers`
        : `Rentable dès ${total} km/mois au total, soit ${fast} km rechargés sur bornes rapides`;
}

export function subscriptionLabel(formula, language = getLanguage()) {
    const copy = COPY[language];
    if (!(formula.cost > 0)) return copy.noSubscription;
    if (formula.period === PERIOD.ANNUAL) {
        return `${formatComparisonNumber(formula.cost, language, 2)} €/${copy.perYear}, ${copy.monthlyEquivalent} ${formatComparisonNumber(formula.monthlyCost, language, 2)} €/${copy.perMonth}`;
    }
    return `${formatComparisonNumber(formula.cost, language, 2)} €/${copy.perMonth}`;
}

export function subscriptionBenefitLabel(formula, language = getLanguage()) {
    const copy = COPY[language];
    if (!(formula.monthlyCost > 0)) return copy.noSubscriptionComparison;
    if (formula.fastKwh <= 0) return copy.noFastCharging;
    if (!Number.isFinite(formula.subscriptionBenefit)) return copy.referenceUnavailable;
    if (formula.subscriptionBenefit >= 0.5) return copy.saves(formatComparisonNumber(formula.subscriptionBenefit, language, 2));
    if (formula.subscriptionBenefit >= 0) return copy.smallSaving;
    return copy.costsMore(formatComparisonNumber(Math.abs(formula.subscriptionBenefit), language, 2));
}

function chargebackExplanation(formula, language) {
    if (!formula.chargebackConfig?.enabled || !Number.isFinite(formula.rateRaw) || formula.fastKwh <= 0) return '';
    const effectivePaidRate = formula.fastChargingCost / formula.fastKwh;
    return `<p class="compare-chargeback-note">${COPY[language].atlanteEstimate(formatComparisonNumber(effectivePaidRate, language, 3))}</p>`;
}

export function renderComparisonTable(formulasData, {
    monthlyKm = 0,
    consumption = 0.18,
    fastPercentage = 100,
    homeRate = 0.20,
    date = new Date(),
    logos = {},
    onModal,
    onDetail,
    query = ''
} = {}) {
    const language = getLanguage();
    const copy = COPY[language];
    const filteredData = filterComparisonFormulas(formulasData, query);
    const data = monthlyKm > 0
        ? buildComparisonRanking(filteredData, { monthlyKm, consumption, fastPercentage, homeRate, date })
        : [];

    const list = document.getElementById('ranking-list');
    const count = document.getElementById('compare-count');
    const summary = document.getElementById('compare-summary');
    if (!list) return { query };

    if (summary) summary.textContent = monthlyKm > 0
        ? copy.summary(formatComparisonNumber(monthlyKm, language), formatComparisonNumber(fastPercentage, language), formatComparisonNumber(consumption * 100, language))
        : copy.enterMileage;
    if (count) count.textContent = monthlyKm > 0 ? copy.count(data.length) : '';
    if (monthlyKm <= 0) {
        list.innerHTML = `<p class="compare-empty">${copy.enterMileage}</p>`;
        return { query };
    }

    list.innerHTML = data.length ? data.map((formula, index) => {
        const formulaKey = `${formula.opKey}::${formula.name}`;
        const logo = logos[formula.opKey]
            ? `<img src="${escapeHtml(logos[formula.opKey])}" class="compare-logo" alt="" loading="lazy">`
            : '<span class="compare-logo compare-logo--fallback" aria-hidden="true"></span>';
        const note = formula.note ? `<p class="compare-note">${escapeHtml(formula.note)}</p>` : '';
        const rank = index + 1;
        const verifiedLabel = formatTariffsVerifiedOn(formula.verifiedAt);

        return `<article class="compare-item${index === 0 ? ' compare-item--best' : ''}" data-detail="${escapeHtml(formulaKey)}" tabindex="0" role="button" aria-label="${copy.viewDetails} ${escapeHtml(formula.operator)} ${escapeHtml(formula.name)}">
            <div class="compare-rank" aria-hidden="true">${rank}</div>
            <div class="compare-identity">
                ${logo}
                <div class="compare-copy">
                    <p class="compare-operator ${escapeHtml(formula.color)}">${escapeHtml(formula.operator)}</p>
                    <h3>${escapeHtml(formula.name)}</h3>
                    <div class="compare-badges">${pricingBadge(formula)}${verifiedLabel ? `<span class="compare-verified">${verifiedLabel}</span>` : ''}</div>
                    ${note}
                </div>
            </div>
            <div class="compare-prices">
                <span>${copy.estimatedCost}</span>
                <strong>${formatNumber(formula.estimatedMonthlyCost, 2)} €</strong>
                <small>/${copy.perMonth}</small>
            </div>
            <div class="compare-meta" aria-label="${copy.details}">
                <span><small>${copy.fastCharging}</small>${formatNumber(formula.fastChargingCost, 2)} €</span>
                <span><small>${copy.subscription}</small>${subscriptionLabel(formula, language)}</span>
                <span><small>Tarif</small>${formula.chargebackConfig?.enabled ? `${formatNumber(formula.rateRaw, 2)} €/kWh nominal` : rateLabel(formula)}</span>
                <span><small>${copy.profitability}</small>${profileThresholdLabel(formula, fastPercentage, language)}</span>
            </div>
            <p class="compare-benefit">${subscriptionBenefitLabel(formula, language)}</p>
            ${chargebackExplanation(formula, language)}
            <svg class="compare-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </article>`;
    }).join('') : `<p class="compare-empty">${copy.empty}</p>`;

    const openDetail = target => {
        const card = target.closest('[data-detail]');
        if (!card) return;
        const [opKey, ...nameParts] = card.dataset.detail.split('::');
        const formula = formulasData.find(item => item.opKey === opKey && item.name === nameParts.join('::'));
        onDetail?.(formula, card);
    };

    list.onclick = event => {
        const modalButton = event.target.closest('[data-modal]');
        if (modalButton) { onModal?.(modalButton.dataset.modal); return; }
        openDetail(event.target);
    };
    list.onkeydown = event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const card = event.target.closest('[data-detail]');
        if (!card) return;
        event.preventDefault();
        openDetail(card);
    };
    return { query };
}
