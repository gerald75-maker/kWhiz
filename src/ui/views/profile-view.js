import { chargebackChangeWithinYear, computeProfileAnnualCost, computeProfileMonthlyCost } from '../../domain/pricing.js';
import { escapeHtml, safeUrl } from '../../shared/dom.js';
import { shareResult } from '../share-result.js';
import { formatCurrency, formatDate, formatNumber, formatPercentage, formatTariffsVerifiedOn, localizeCommercialLabel, t } from '../../i18n/i18n.js';
import { offerDetailSubscriptionLabel } from './offer-detail-view.js';

// Écran Mon offre : l'offre n°1 (nom, prix, stations proches, actions), deux offres
// suivantes, et le détail du calcul dans le panneau « Pourquoi ce choix ? ».

function currency(value, fractionDigits = 2) {
    return formatCurrency(value, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits
    });
}

function number(value, fractionDigits = 0) {
    return formatNumber(value, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits
    });
}

function kwhRate(value) {
    return `${formatCurrency(value, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}/kWh`;
}

export function profileMonthlyAmount(value) {
    return t('profile.monthlyAmount', { amount: currency(value) });
}

export function profileAnnualAmount(value) {
    return t('profile.annualAmount', { amount: currency(value) });
}

export function profileShareStatusLabel(result) {
    if (result === 'copied') return t('share.copied');
    if (result === 'shared') return t('share.shared');
    if (result === 'unavailable') return t('share.unavailable');
    if (result === 'copyFailed') return t('share.copyFailed');
    return '';
}

export function profileThresholdLabel({ hasSubscription, thresholdKm, referenceUnavailable = false }) {
    if (!hasSubscription) return t('recommendation.noSubscription');
    // Sans tarif sans abonnement fixe du même réseau, le seuil n'est pas « infini » : il est incalculable.
    if (referenceUnavailable) return t('recommendation.breakEvenReferenceUnavailable');
    if (!Number.isFinite(thresholdKm)) return t('recommendation.breakEvenUnreachable');
    if (thresholdKm <= 0) return t('recommendation.breakEvenImmediate');
    return t('profile.monthlyMileage', { distance: number(thresholdKm) });
}

export function recommendationSubscriptionLabel(formula) {
    return offerDetailSubscriptionLabel(formula);
}

function renderOperatorLogo(logos, opKey, imageClass, frameClass) {
    const src = logos?.[opKey];
    if (!src) return '';
    const safeKey = escapeHtml(opKey);
    return `<span class="${frameClass} ${frameClass}--${safeKey}" aria-hidden="true">
        <img src="${escapeHtml(src)}" class="${imageClass}" alt="" loading="lazy">
    </span>`;
}

// Actions de l'offre n°1 : page officielle de l'opérateur et bornes sur la carte kWhiz
// (ou carte de l'opérateur pour les réseaux absents de la base IRVE rapide).
export function profileActionsHtml(best, { mapOperators = [] } = {}) {
    const operator = escapeHtml(localizeCommercialLabel(best.operator));
    const hasSubscription = best.monthlyCost > 0;
    const offerUrl = safeUrl(best.sourceUrl);
    const actions = [];
    if (offerUrl) {
        actions.push(`<a class="phm-action phm-action--primary" href="${offerUrl}" target="_blank" rel="noopener noreferrer">${t(hasSubscription ? 'profile.action.subscribe' : 'profile.action.viewOffer', { operator })} <span aria-hidden="true">↗</span></a>`);
    }
    if (mapOperators.includes(best.opKey)) {
        actions.push(`<button type="button" class="phm-action" data-map-operator="${escapeHtml(best.opKey)}"><span aria-hidden="true">⌖</span> ${t('profile.action.stations', { operator })}</button>`);
    } else if (safeUrl(best.mapUrl)) {
        actions.push(`<a class="phm-action" href="${safeUrl(best.mapUrl)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">⌖</span> ${t('profile.action.operatorMap', { operator })} <span aria-hidden="true">↗</span></a>`);
    }
    return actions.length ? `<div class="phm-actions">${actions.join('')}</div>` : '';
}

// Avec une zone de recharge, seuls les réseaux présents à proximité sont classés.
// Un réseau absent de la base IRVE (carte d'itinérance) reste dans le classement.
export function nearbyFormulas(formulas, coverage) {
    if (!coverage) return formulas;
    return formulas.filter(formula => !coverage.operators?.has(formula.opKey)
        || (coverage.counts?.get(formula.opKey) || 0) > 0);
}

// Nombre de stations du réseau dans la zone, ou null si on ne peut pas le dire.
function stationCount(coverage, opKey) {
    if (!coverage || !coverage.operators?.has(opKey)) return null;
    return coverage.counts?.get(opKey) || 0;
}

function coverageLine(coverage, opKey) {
    if (!coverage) {
        return `<button type="button" class="offer-coverage offer-coverage--empty" data-open-profile>${t('offer.coverage.setZone')}</button>`;
    }
    const count = stationCount(coverage, opKey);
    if (count === null) return '';
    const key = count === 0 ? 'offer.coverage.none' : count === 1 ? 'offer.coverage.one' : 'offer.coverage.many';
    return `<p class="offer-coverage${count <= 1 ? ' offer-coverage--warn' : ''}"><span aria-hidden="true">⌖</span> ${t(key, { count: number(count), radius: coverage.radiusKm })}</p>`;
}

function shortCoverage(coverage, opKey) {
    const count = stationCount(coverage, opKey);
    if (count === null) return '';
    return t(count === 0 ? 'offer.stations.none' : count === 1 ? 'offer.stations.one' : 'offer.stations.many', { count: number(count) });
}

function withProfileCosts(formulasData, { km, consumption, fastPercentage, homeRate }) {
    return formulasData.map(formula => ({
        ...formula,
        profileMonthlyCost: computeProfileMonthlyCost(formula, km, consumption, { fastPercentage, homeRate }),
        profileAnnualCost: computeProfileAnnualCost(formula, km, consumption, { fastPercentage, homeRate })
    }))
        .filter(formula => Number.isFinite(formula.profileMonthlyCost))
        .sort((a, b) => a.profileMonthlyCost - b.profileMonthlyCost);
}

function whyRow(label, value, className = '') {
    return `<div class="why-row"><dt>${label}</dt><dd${className ? ` class="${className}"` : ''}>${value}</dd></div>`;
}

// Contenu du panneau « Pourquoi ce choix ? » : tout le calcul, rien d'imposé sur l'écran.
export function whyChoiceHtml({ best, second = null, fastPercentage, favorites = new Set(), ranked = [] }) {
    const change = chargebackChangeWithinYear(best);
    const promo = change
        ? `<p class="why-note">${t('profile.annualPromoNote', {
            date: formatDate(change.endDate),
            before: formatPercentage(change.rateNow * 100),
            after: formatPercentage(change.rateAfter * 100)
        })}</p>`
        : '';
    const hasSubscription = (best.monthlyCost || 0) > 0;
    const fastRatio = fastPercentage / 100;
    const thresholdKm = !Number.isFinite(best.km) ? Infinity : fastRatio > 0 ? Math.ceil(best.km / fastRatio) : Infinity;
    const rows = [
        whyRow(t('why.paidAtCharger'), kwhRate(Number.isFinite(best.rateRaw) ? best.rateRaw : best.rate))
    ];
    if (Number.isFinite(best.chargebackRate)) rows.push(whyRow(t('why.afterChargeback'), `≈ ${kwhRate(best.chargebackRate)}`));
    rows.push(whyRow(t('why.subscription'), recommendationSubscriptionLabel(best)));
    if (second && Number.isFinite(second.profileAnnualCost)) {
        const gap = second.profileAnnualCost - best.profileAnnualCost;
        const operator = escapeHtml(localizeCommercialLabel(second.operator));
        rows.push(gap >= 0.005
            ? whyRow(t('why.versus', { operator }), t('why.lessPerYear', { amount: currency(gap) }), 'why-good')
            : whyRow(t('why.versus', { operator }), t('why.morePerYear', { amount: currency(Math.abs(gap)) }), 'why-warn'));
    }
    if (hasSubscription) {
        rows.push(whyRow(t('profile.breakEven'), profileThresholdLabel({ hasSubscription, thresholdKm, referenceUnavailable: best.referenceUnavailable === true })));
    }
    const favorite = ranked.find(formula => favorites.has(`${formula.opKey}::${formula.name}`) && formula !== best);
    if (favorite) {
        rows.push(whyRow(t('why.favorite', { formula: escapeHtml(localizeCommercialLabel(favorite.name)) }),
            t('recommendation.favoriteGap', { amount: currency(favorite.profileMonthlyCost - best.profileMonthlyCost) })));
    }
    const verified = formatTariffsVerifiedOn(best.verifiedAt);
    const source = safeUrl(best.sourceUrl);
    const sourceLine = `<p class="why-source">${verified ? `${escapeHtml(verified)}. ` : ''}${source ? `<a href="${source}" target="_blank" rel="noopener noreferrer">${t('why.officialSource')}</a>. ` : ''}${t('why.checkCharger')}</p>`;
    return `
        <p class="why-subtitle">${escapeHtml(localizeCommercialLabel(best.operator))} · ${escapeHtml(localizeCommercialLabel(best.name))}</p>
        <div class="why-total"><span class="why-total-value">${currency(best.profileAnnualCost)}</span><span>${t('why.overYear')}</span></div>
        ${promo}
        <dl class="why-rows">${rows.join('')}</dl>
        ${sourceLine}
        <button type="button" class="why-share" id="profile-share-result" aria-describedby="profile-share-status"><span aria-hidden="true">↗</span> ${t('profile.share')}</button>
        <p id="profile-share-status" class="phm-share-status" role="status" aria-live="polite"></p>`;
}

export function renderProfileHero({ formulasData, consumption, fastPercentage, homeRate, favorites = new Set(), logos, mapOperators = [], onShowOperatorMap, coverage = null, km: kmOverride }) {
    const card = document.getElementById('profile-best-card');
    const context = document.getElementById('offer-context');
    const why = document.getElementById('why-sheet-body');
    if (!card) return [];
    const km = kmOverride ?? Math.max(0, parseInt(document.getElementById('profile-km')?.value, 10) || 0);

    if (formulasData.length === 0) {
        card.innerHTML = `<p class="profile-hero-hint">${t('profile.loadingPrices')}</p>`;
        if (context) context.textContent = '';
        return [];
    }
    if (km === 0) {
        card.innerHTML = `<p class="profile-hero-hint">${t('profile.enterMileage')}</p>`;
        if (context) context.textContent = '';
        return [];
    }

    const ranked = withProfileCosts(nearbyFormulas(formulasData, coverage), { km, consumption, fastPercentage, homeRate });
    if (!ranked.length) {
        card.innerHTML = `<p class="profile-hero-hint">${t('profile.noPlans')}</p>`;
        return ranked;
    }
    const [best, second] = ranked;
    if (context) context.textContent = coverage ? t('offer.bestNear', { place: coverage.label }) : t('offer.best');

    const logo = renderOperatorLogo(logos, best.opKey, 'phm-logo', 'phm-logo-frame');
    card.innerHTML = `
        <div class="offer-brand">
            ${logo}
            <div>
                <div class="phm-operator ${escapeHtml(best.color)}">${escapeHtml(localizeCommercialLabel(best.operator))}</div>
                <div class="phm-formula">${escapeHtml(localizeCommercialLabel(best.name))}</div>
            </div>
        </div>
        <div class="offer-price"><span class="offer-price-value">${currency(best.profileMonthlyCost)}</span><span class="offer-price-unit">${t('offer.perMonth')}</span></div>
        ${coverageLine(coverage, best.opKey)}
        ${profileActionsHtml(best, { mapOperators })}
        <button type="button" class="offer-why" data-open-why aria-haspopup="dialog" aria-controls="why-sheet">${t('offer.why')}</button>`;

    card.querySelector('[data-map-operator]')?.addEventListener('click', event => {
        onShowOperatorMap?.(event.currentTarget.dataset.mapOperator);
    });

    if (why) {
        why.innerHTML = whyChoiceHtml({ best, second, fastPercentage, favorites, ranked });
        const shareButton = why.querySelector('#profile-share-result');
        const shareStatus = why.querySelector('#profile-share-status');
        shareButton?.addEventListener('click', async () => {
            shareButton.disabled = true;
            if (shareStatus) shareStatus.textContent = '';
            try {
                const result = await shareResult({
                    operator: best.operator,
                    formula: best.name,
                    monthlyCost: best.profileMonthlyCost,
                    annualCost: best.profileAnnualCost,
                    km,
                    fastPercentage
                });
                if (shareStatus) shareStatus.textContent = profileShareStatusLabel(result);
            } catch {
                if (shareStatus) shareStatus.textContent = profileShareStatusLabel('unavailable');
            } finally {
                shareButton.disabled = false;
            }
        });
    }
    return ranked;
}

function detailKey(formula) {
    return `${formula.opKey}::${formula.name}`;
}

// Les deux offres suivantes, en lignes compactes : nom, prix, écart, stations proches.
export function renderProfileShortlist(ranked, logos, favorites, onToggleFavorite, onDetail, coverage = null) {
    const list = document.getElementById('profile-shortlist-list');
    if (!list) return;
    const section = list.closest?.('.offer-next');
    const next = ranked.slice(1, 3);
    if (section) section.hidden = next.length === 0;
    if (!next.length) {
        list.innerHTML = '';
        return;
    }
    const best = ranked[0].profileMonthlyCost;
    list.innerHTML = next.map(formula => {
        const operator = localizeCommercialLabel(formula.operator);
        const name = localizeCommercialLabel(formula.name);
        const stations = shortCoverage(coverage, formula.opKey);
        return `<button type="button" class="offer-next-row" data-detail="${escapeHtml(detailKey(formula))}" aria-label="${escapeHtml(t('profile.ranking.viewDetails', { operator, formula: name }))}">
            <span class="offer-next-name"><strong>${escapeHtml(operator)}</strong><span>${escapeHtml(name)}${stations ? ` · ${escapeHtml(stations)}` : ''}</span></span>
            <span class="offer-next-cost"><strong>${currency(formula.profileMonthlyCost)}</strong><span>${t('recommendation.favoriteGap', { amount: currency(formula.profileMonthlyCost - best) })}</span></span>
        </button>`;
    }).join('');
    list.onclick = event => {
        const trigger = event.target.closest?.('[data-detail]');
        if (!trigger) return;
        const formula = next.find(item => detailKey(item) === trigger.dataset.detail);
        if (formula) onDetail?.(formula, trigger);
    };
}

export function renderProfileView({ formulasData, consumption, fastPercentage, homeRate, logos, favorites = new Set(), onToggleFavorite, onDetail, mapOperators = [], onShowOperatorMap, coverage = null }) {
    const ranked = renderProfileHero({ formulasData, consumption, fastPercentage, homeRate, favorites, logos, mapOperators, onShowOperatorMap, coverage });
    renderProfileShortlist(ranked, logos, favorites, onToggleFavorite, onDetail, coverage);
    const allOffers = document.getElementById('profile-all-offers-label');
    if (allOffers) allOffers.textContent = t('offer.allCount', { count: number(formulasData.length) });
}
