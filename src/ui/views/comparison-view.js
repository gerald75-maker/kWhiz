import { PERIOD, computeProfileMonthlyCost } from '../../domain/pricing.js';
import { escapeHtml, formatNumber } from '../../shared/dom.js';
import { formatDate, formatTariffsFreshness, formatTariffsVerifiedOn, getLanguage, getLocale, localizeCommercialLabel, localizeTariffText, t } from '../../i18n/i18n.js';

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
    return formulas.filter(formula => {
        if (!normalizedQuery) return true;
        return [formula.operator, formula.name, localizeCommercialLabel(formula.operator), localizeCommercialLabel(formula.name)]
            .some(label => String(label).toLocaleLowerCase(getLocale()).includes(normalizedQuery));
    });
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
    if (formula.pricingType === 'station') return `<span class="compare-pricing-badge is-variable">${t('comparison.badge.variable')}</span>`;
    if (formula.pricingType === 'range') return `<span class="compare-pricing-badge is-variable">${t('comparison.badge.range')}</span>`;
    if (formula.pricingType === 'discount') return `<span class="compare-pricing-badge is-discount">${t('comparison.badge.discount')}</span>`;
    return `<span class="compare-pricing-badge is-fixed">${t('comparison.badge.fixed')}</span>`;
}

function currency(value, language = getLanguage(), fractionDigits = 2) {
    return new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'fr-FR', {
        style: 'currency', currency: 'EUR', minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits
    }).format(value).replace(/\u00a0/g, ' ');
}

function rateLabel(formula) {
    if ((formula.pricingType === 'range' || formula.pricingType === 'discount') && Number.isFinite(formula.rateMin) && Number.isFinite(formula.rateMax)) {
        return `${currency(formula.rateMin, getLanguage(), 2)}–${currency(formula.rateMax, getLanguage(), 2)}/kWh`;
    }
    if (formula.isMinimum) return t('comparison.fromRate', { rate: `${currency(formula.rate, getLanguage(), 2)}/kWh` });
    if (formula.pricingType === 'station') return `≈ ${currency(formula.rate, getLanguage(), 2)}/kWh`;
    return `${currency(formula.rate, getLanguage(), formula.chargebackRate !== null ? 3 : 2)}/kWh`;
}

function formatComparisonNumber(value, language, fractionDigits) {
    return new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'fr-FR', fractionDigits === undefined ? {} : {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits
    }).format(value);
}

export function profileThresholdLabel(formula, fastPercentage, language = getLanguage()) {
    if (!(formula.monthlyCost > 0)) return t('comparison.noSubscription');
    if (fastPercentage <= 0) return t('comparison.noFastCharging');
    if (!Number.isFinite(formula.adjustedThresholdKm)) return t('comparison.notProfitable');
    const total = formatComparisonNumber(formula.adjustedThresholdKm, language);
    const fast = formatComparisonNumber(Math.ceil(formula.km), language);
    if (fastPercentage >= 100) return t('comparison.breakEvenFrom', { distance: total });
    return t('comparison.breakEvenWithFastShare', { total, fast });
}

export function subscriptionLabel(formula, language = getLanguage()) {
    if (!(formula.cost > 0)) return t('comparison.noSubscription');
    if (formula.period === PERIOD.ANNUAL) {
        return t('comparison.annualSubscription', { annual: currency(formula.cost, language), monthly: currency(formula.monthlyCost, language) });
    }
    return t('comparison.monthlySubscription', { amount: currency(formula.cost, language) });
}

export function subscriptionBenefitLabel(formula, language = getLanguage()) {
    if (!(formula.monthlyCost > 0)) return t('comparison.noSubscriptionComparison');
    if (formula.fastKwh <= 0) return t('comparison.noFastCharging');
    if (!Number.isFinite(formula.subscriptionBenefit)) return t('comparison.referenceUnavailable');
    if (formula.subscriptionBenefit >= 0.5) return t('comparison.saves', { amount: currency(formula.subscriptionBenefit, language) });
    if (formula.subscriptionBenefit >= 0) return t('comparison.smallSaving');
    return t('comparison.costsMore', { amount: currency(Math.abs(formula.subscriptionBenefit), language) });
}

function chargebackExplanation(formula, language) {
    if (!formula.chargebackConfig?.enabled || !Number.isFinite(formula.rateRaw) || formula.fastKwh <= 0) return '';
    const effectivePaidRate = formula.fastChargingCost / formula.fastKwh;
    return `<p class="compare-chargeback-note">${t('comparison.atlanteEstimate', { rate: currency(effectivePaidRate, language, 3) })}</p>`;
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
    const filteredData = filterComparisonFormulas(formulasData, query);
    const data = monthlyKm > 0
        ? buildComparisonRanking(filteredData, { monthlyKm, consumption, fastPercentage, homeRate, date })
        : [];

    const list = document.getElementById('ranking-list');
    const count = document.getElementById('compare-count');
    const summary = document.getElementById('compare-summary');
    if (!list) return { query };

    if (summary) summary.textContent = monthlyKm > 0
        ? t('comparison.summary', { km: formatComparisonNumber(monthlyKm, language), fast: formatComparisonNumber(fastPercentage, language), consumption: formatComparisonNumber(consumption * 100, language) })
        : t('comparison.enterMileage');
    if (count) count.textContent = monthlyKm > 0 ? t(data.length === 1 ? 'comparison.countOne' : 'comparison.countMany', { count: formatComparisonNumber(data.length, language) }) : '';
    if (monthlyKm <= 0) {
        list.innerHTML = `<p class="compare-empty">${t('comparison.enterMileage')}</p>`;
        return { query };
    }

    list.innerHTML = data.length ? data.map((formula, index) => {
        const formulaKey = `${formula.opKey}::${formula.name}`;
        const logo = logos[formula.opKey]
            ? `<img src="${escapeHtml(logos[formula.opKey])}" class="compare-logo" alt="" loading="lazy">`
            : '<span class="compare-logo compare-logo--fallback" aria-hidden="true"></span>';
        const note = formula.note ? `<p class="compare-note">${escapeHtml(localizeTariffText(formula.note))}</p>` : '';
        const rank = index + 1;
        const verifiedLabel = formatTariffsVerifiedOn(formula.verifiedAt);
        const operatorLabel = localizeCommercialLabel(formula.operator);
        const formulaLabel = localizeCommercialLabel(formula.name);

        return `<article class="compare-item${index === 0 ? ' compare-item--best' : ''}" data-detail="${escapeHtml(formulaKey)}" tabindex="0" role="button" aria-label="${escapeHtml(t('comparison.viewDetails', { operator: operatorLabel, formula: formulaLabel }))}">
            <div class="compare-rank" aria-hidden="true">${rank}</div>
            <div class="compare-identity">
                ${logo}
                <div class="compare-copy">
                    <p class="compare-operator ${escapeHtml(formula.color)}">${escapeHtml(operatorLabel)}</p>
                    <h3>${escapeHtml(formulaLabel)}</h3>
                    <div class="compare-badges">${pricingBadge(formula)}${verifiedLabel ? `<span class="compare-verified">${verifiedLabel}</span>` : ''}</div>
                    ${note}
                </div>
            </div>
            <div class="compare-prices">
                <span>${t('comparison.estimatedCost')}</span>
                <strong>${currency(formula.estimatedMonthlyCost, language)}</strong>
                <small>${t('comparison.perMonthSuffix')}</small>
            </div>
            <div class="compare-meta" aria-label="${t('comparison.details')}">
                <span><small>${t('comparison.fastCharging')}</small>${currency(formula.fastChargingCost, language)}</span>
                <span><small>${t('comparison.subscription')}</small>${subscriptionLabel(formula, language)}</span>
                <span><small>${t('comparison.tariff')}</small>${formula.chargebackConfig?.enabled ? `${currency(formula.rateRaw, language)}/kWh ${t('comparison.nominal')}` : rateLabel(formula)}</span>
                <span><small>${t('comparison.profitability')}</small>${profileThresholdLabel(formula, fastPercentage, language)}</span>
            </div>
            <p class="compare-benefit">${subscriptionBenefitLabel(formula, language)}</p>
            ${chargebackExplanation(formula, language)}
            <svg class="compare-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </article>`;
    }).join('') : `<p class="compare-empty">${t('comparison.empty')}</p>`;

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
