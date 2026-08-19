import { PERIOD, atlanteSteadyStateRate, calculateBreakeven, chargebackBreakeven, getAtlanteGemsRate } from '../../domain/pricing.js';
import { escapeHtml, safeUrl } from '../../shared/dom.js';
import { formulaFavoriteId } from '../favorites.js';
import { formatCurrency, formatNumber, formatTariffsVerifiedOn, getLocale, localizeCommercialLabel, localizeNetworkDescription, t } from '../../i18n/i18n.js';
import { offerDetailPricingLabel, offerDetailSubscriptionLabel } from './offer-detail-view.js';

function currency(value) {
    return formatCurrency(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatOperatorSubscription(formula) {
    if (!(formula.cost > 0)) return '';
    return t(formula.period === PERIOD.ANNUAL ? 'operators.subscriptionAnnual' : 'operators.subscriptionMonthly', { amount: currency(formula.cost) });
}

export function formatOperatorThreshold(km) {
    if (km === 0) return t('offerDetail.noSubscription');
    if (!Number.isFinite(km)) return t('offerDetail.notProfitable');
    return t('operators.breakEvenFrom', { distance: t('offerDetail.breakEvenValue', { distance: formatNumber(km) }) });
}

export function formatOperatorPlanCost(formula) {
    return formula.period === PERIOD.NONE ? t('offerDetail.noSubscription') : formatOperatorSubscription(formula);
}

// Conservé pour les consommateurs historiques ; la liste compacte ne publie plus ces métadonnées.
export function buildFormulaMeta(formula, detailed = false) {
    const labels = { fixed: 'offerDetail.fixedPrice', station: 'operators.pricing.station', range: 'operators.pricing.range', discount: 'operators.pricing.discount' };
    const type = t(labels[formula.pricingType] || (formula.calculationBasis === 'estimate' ? 'operators.pricing.estimated' : 'operators.pricing.published'));
    const verified = formatTariffsVerifiedOn(formula.verifiedAt);
    const source = safeUrl(formula.sourceUrl);
    return `<span class="formula-meta${detailed ? ' formula-meta--detailed' : ''}"><span>${escapeHtml(type)}</span>${verified ? ` <span class="formula-meta-part">· ${escapeHtml(verified)}</span>` : ''}${source ? ` <span class="formula-meta-part">· <a class="formula-source" href="${source}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('operators.officialSource'))}</a></span>` : ''}</span>`;
}

function favoriteButton(opKey, formula, favorites) {
    const id = formulaFavoriteId(opKey, formula.name);
    const selected = favorites.has(id);
    return `<button type="button" class="favorite-btn${selected ? ' is-favorite' : ''}" data-favorite-id="${escapeHtml(id)}" aria-label="${t(selected ? 'favorites.remove' : 'favorites.add')}" aria-pressed="${selected}">★</button>`;
}

function mapLink(operator) {
    const url = safeUrl(operator.mapUrl);
    if (!url) return '';
    const name = localizeCommercialLabel(operator.name);
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="operator-directory-map" aria-label="${escapeHtml(t('operators.openMapFor', { operator: name }))}"><span>${escapeHtml(t('operators.map'))}</span><span aria-hidden="true">›</span></a>`;
}

function operatorFormulaResult(operator, formula, consumption) {
    const result = calculateBreakeven(formula, consumption);
    const config = operator.loyalty?.chargebackConfig;
    const gemsRate = operator.loyalty?.chargebackInfo && config ? getAtlanteGemsRate(config) : 0;
    if (!formula.chargebackEligible || !(gemsRate > 0)) return { ...result, chargebackRate: null };
    const effectiveRate = atlanteSteadyStateRate(formula.rate, gemsRate);
    return {
        ...result,
        km: chargebackBreakeven(formula, consumption, gemsRate),
        costPer100km: effectiveRate * consumption * 100,
        chargebackRate: effectiveRate
    };
}

function detailFormula(opKey, operator, formula, result) {
    return {
        ...formula,
        operator: operator.name,
        opKey,
        badge: operator.badge,
        mapUrl: operator.mapUrl,
        km: result.km,
        costPer100km: result.costPer100km,
        monthlyCost: result.monthlyCost || 0,
        chargebackRate: result.chargebackRate,
        sourceUrl: formula.sourceUrl || operator.sourceUrl || null,
        verifiedAt: formula.verifiedAt || operator.verifiedAt || null
    };
}

function renderDirectory({ operators, consumption, logos, favorites, onToggleFavorite, onDetail }) {
    const container = document.getElementById('operators-compact');
    if (!container) return;
    const open = new Set(Array.from(container.querySelectorAll?.('details[open][data-operator]') || [], node => node.dataset.operator));
    container.innerHTML = '';
    const sorted = Object.entries(operators).sort((a, b) =>
        a[1].name.localeCompare(b[1].name, getLocale(), { sensitivity: 'base' })
    );

    for (const [opKey, operator] of sorted) {
        const card = document.createElement('details');
        card.className = 'operator-directory-card';
        card.dataset ||= {};
        card.dataset.operator = opKey;
        card.open = open.has(opKey);
        const count = operator.formulas.length;
        const plans = operator.formulas.map((formula, index) => {
            const result = operatorFormulaResult(operator, formula, consumption);
            const threshold = Number.isFinite(result.km) && result.km > 0
                ? `<span class="operator-plan-threshold">${escapeHtml(formatOperatorThreshold(result.km))}</span>` : '';
            return `<article class="operator-plan-row">${favoriteButton(opKey, formula, favorites)}<div class="operator-plan-copy"><strong>${escapeHtml(localizeCommercialLabel(formula.name))}</strong><span>${escapeHtml(offerDetailPricingLabel(formula))} · ${escapeHtml(offerDetailSubscriptionLabel({ ...formula, monthlyCost: result.monthlyCost }))}</span>${threshold}</div><button type="button" class="operator-plan-detail" data-formula-index="${index}" aria-label="${escapeHtml(t('operators.detailsFor', { formula: localizeCommercialLabel(formula.name) }))}">${escapeHtml(t('operators.details'))}<span aria-hidden="true">›</span></button></article>`;
        }).join('');
        const logo = logos[opKey] ? `<img src="${logos[opKey]}" class="operator-logo" alt="${escapeHtml(localizeCommercialLabel(operator.name))}" loading="lazy">` : '';
        const description = operator.badge ? `${escapeHtml(localizeNetworkDescription(operator.badge))} · ` : '';
        card.innerHTML = `<summary class="operator-directory-summary"><span class="operator-directory-name ${escapeHtml(operator.color)}">${logo}<span><strong>${escapeHtml(localizeCommercialLabel(operator.name))}</strong><small>${description}${escapeHtml(t(count === 1 ? 'count.plan' : 'count.plans', { count: formatNumber(count) }))}</small></span></span><span class="operator-directory-actions">${mapLink(operator)}<span class="operator-directory-chevron" aria-hidden="true">›</span></span></summary><div class="operator-plan-list">${plans}</div>`;
        card.addEventListener('click', event => {
            const favorite = event.target.closest('[data-favorite-id]');
            if (favorite) {
                event.preventDefault();
                onToggleFavorite?.(favorite.dataset.favoriteId);
                return;
            }
            const detail = event.target.closest('[data-formula-index]');
            if (!detail) return;
            const formula = operator.formulas[Number(detail.dataset.formulaIndex)];
            onDetail?.(detailFormula(opKey, operator, formula, operatorFormulaResult(operator, formula, consumption)), detail);
        });
        container.appendChild(card);
    }
}

export function renderOperatorsViews({ operators, consumption, logos, favorites = new Set(), onToggleFavorite, onDetail }) {
    const count = document.getElementById('operators-page-count');
    if (count) {
        const operatorCount = Object.keys(operators).length;
        const formulaCount = Object.values(operators).reduce((total, operator) => total + operator.formulas.length, 0);
        const networks = t(operatorCount === 1 ? 'count.network' : 'count.networks', { count: '' }).trim();
        const plans = t(formulaCount === 1 ? 'count.plan' : 'count.plans', { count: '' }).trim();
        count.innerHTML = `<strong>${formatNumber(operatorCount)}</strong><span>${networks}</span><strong>${formatNumber(formulaCount)}</strong><span>${plans}</span>`;
    }
    renderDirectory({ operators, consumption, logos, favorites, onToggleFavorite, onDetail });
}
