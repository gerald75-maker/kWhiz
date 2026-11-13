import { atlanteSteadyStateRate, chargebackChangeWithinYear, computeProfileAnnualCost, computeProfileMonthlyCost } from '../../domain/pricing.js';
import { escapeHtml, safeUrl } from '../../shared/dom.js';
import { shareResult } from '../share-result.js';
import { formatCurrency, formatDate, formatNumber, formatPercentage, formatTariffsVerifiedOn, localizeCommercialLabel, t } from '../../i18n/i18n.js';
import { offerDetailCalculationNote, offerDetailSubscriptionLabel } from './offer-detail-view.js';

// Écran Mon offre : les trois réseaux les moins chers, à égalité, car on recharge chez
// celui qui se trouve sur sa route. Chaque carte donne le prix au kWh, le coût d'une
// recharge, le coût aux 100 km et l'abonnement ; le bloc « Votre mois » donne le budget
// selon le réseau utilisé, recharge à domicile comprise.

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

// Contenu du panneau « Pourquoi cet ordre ? » : tout le calcul, rien d'imposé sur l'écran.
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

// Une seule formule par réseau : la moins chère pour le profil.
export function topNetworks(ranked, count = 3) {
    const seen = new Set();
    const result = [];
    for (const formula of ranked) {
        if (seen.has(formula.opKey)) continue;
        seen.add(formula.opKey);
        result.push(formula);
        if (result.length === count) break;
    }
    return result;
}

// Énergie d'une recharge type : 10 → 80 % de la batterie utile du modèle choisi,
// sinon une recharge de référence de 50 kWh.
export const REFERENCE_CHARGE_KWH = 50;
export function chargeSize(vehicle) {
    const usable = Number(vehicle?.usableKwh);
    if (Number.isFinite(usable) && usable > 0) return { kwh: Math.round(usable * 0.7 * 10) / 10, fromVehicle: true };
    return { kwh: REFERENCE_CHARGE_KWH, fromVehicle: false };
}

function isEstimate(formula) {
    return Number.isFinite(formula.chargebackRate)
        || (formula.pricingType && formula.pricingType !== 'fixed')
        || formula.isMinimum === true;
}

function approx(formula, text) {
    return isEstimate(formula) ? `≈ ${text}` : text;
}

// Ce qu'il faut savoir du prix, en une phrase : ChargeBack, fourchette horaire ou estimation.
export function offerNetworkNote(formula, date = new Date()) {
    if (Number.isFinite(formula.chargebackRate)) {
        const paid = Number.isFinite(formula.rateRaw) ? formula.rateRaw : formula.rate;
        const parts = [t('offer.net.chargeback', { paid: kwhRate(paid) })];
        const change = chargebackChangeWithinYear(formula, date);
        if (change) {
            parts.push(t('offer.net.chargebackChange', {
                date: formatDate(change.endDate),
                after: formatPercentage(change.rateAfter * 100),
                rate: kwhRate(atlanteSteadyStateRate(paid, change.rateAfter))
            }));
        }
        return parts.join(' ');
    }
    if ((formula.pricingType === 'range' || formula.pricingType === 'discount') && Number.isFinite(formula.rateMin) && Number.isFinite(formula.rateMax)) {
        const range = t('offer.net.range', { min: kwhRate(formula.rateMin), max: kwhRate(formula.rateMax) });
        const calculation = offerDetailCalculationNote(formula);
        return calculation ? `${range} ${calculation}.` : range;
    }
    if (formula.pricingType === 'station' || formula.isMinimum === true) return t('offer.net.estimate');
    return '';
}

function subscriptionStat(formula) {
    if (!(formula.monthlyCost > 0)) return { value: t('offer.stat.none'), sub: '' };
    if (formula.period === 'annual') {
        return { value: currency(formula.monthlyCost), sub: t('offer.stat.perMonthAnnual', { amount: currency(formula.cost) }) };
    }
    return { value: currency(formula.monthlyCost), sub: t('offer.stat.perMonth') };
}

function stat(label, value, sub) {
    return `<div class="offer-stat"><dt>${label}</dt><dd class="offer-stat-value">${value}</dd>${sub ? `<dd class="offer-stat-sub">${sub}</dd>` : ''}</div>`;
}

export function offerNetworkCardHtml(formula, { index = 0, consumption, charge, coverage = null, logos = {}, mapOperators = [] }) {
    const operator = localizeCommercialLabel(formula.operator);
    const name = localizeCommercialLabel(formula.name);
    const rate = formula.rate;
    const logo = renderOperatorLogo(logos, formula.opKey, 'phm-logo', 'phm-logo-frame');
    const subscription = subscriptionStat(formula);
    const chargeLabel = charge.fromVehicle ? t('offer.stat.charge') : t('offer.stat.chargeReference', { kwh: number(charge.kwh) });
    const note = offerNetworkNote(formula);
    const count = stationCount(coverage, formula.opKey);
    const stations = count === null ? '' : `<span class="offer-net-stations${count <= 1 ? ' offer-net-stations--warn' : ''}">${escapeHtml(t(count === 0 ? 'offer.stations.noneNear' : count === 1 ? 'offer.stations.oneNear' : 'offer.stations.manyNear', { count: number(count), radius: coverage.radiusKm }))}</span>`;
    const mapAction = mapOperators.includes(formula.opKey)
        ? `<button type="button" class="offer-net-action" data-map-operator="${escapeHtml(formula.opKey)}" aria-label="${escapeHtml(t('profile.action.stations', { operator }))}">${t('offer.net.stations')}</button>`
        : safeUrl(formula.mapUrl)
            ? `<a class="offer-net-action" href="${safeUrl(formula.mapUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(t('profile.action.operatorMap', { operator }))}">${t('offer.net.stations')} <span aria-hidden="true">↗</span></a>`
            : '';
    return `<article class="offer-net${index === 0 ? ' offer-net--first' : ''}" aria-labelledby="offer-net-${index}">
        <header class="offer-net-head">
            ${logo}
            <div class="offer-net-name"><strong id="offer-net-${index}" class="phm-operator ${escapeHtml(formula.color || '')}">${escapeHtml(operator)}</strong><span>${escapeHtml(name)}</span></div>
            <div class="offer-net-rate"><strong>${approx(formula, formatCurrency(rate, { minimumFractionDigits: 2, maximumFractionDigits: 3 }))}</strong><span>${t('offer.net.perKwh')}</span></div>
        </header>
        <dl class="offer-net-stats">
            ${stat(chargeLabel, approx(formula, currency(rate * charge.kwh)), charge.fromVehicle ? t('offer.stat.kwh', { kwh: number(charge.kwh) }) : '')}
            ${stat(t('offer.stat.per100'), approx(formula, currency(rate * consumption * 100)), '')}
            ${stat(t('offer.stat.subscription'), subscription.value, subscription.sub)}
        </dl>
        ${note ? `<p class="offer-net-note">${escapeHtml(note)}</p>` : ''}
        <footer class="offer-net-foot">
            ${stations}
            <span class="offer-net-actions">${mapAction}<button type="button" class="offer-net-action" data-detail="${escapeHtml(detailKey(formula))}" aria-label="${escapeHtml(t('profile.ranking.viewDetails', { operator, formula: name }))}">${t('offer.net.detail')}</button></span>
        </footer>
    </article>`;
}

// Quantité d'énergie à charger chez le réseau abonné pour que l'abonnement soit
// remboursé, comparé au réseau sans abonnement le moins cher du trio.
export function subscriptionPayback(subscribed, trio) {
    if (!(subscribed?.monthlyCost > 0)) return null;
    const alternative = trio
        .filter(formula => formula.opKey !== subscribed.opKey && !(formula.monthlyCost > 0) && formula.rate > subscribed.rate)
        .sort((a, b) => a.rate - b.rate)[0];
    if (!alternative) return null;
    const kwh = Math.ceil(subscribed.monthlyCost / (alternative.rate - subscribed.rate));
    return { kwh, alternative };
}

export function offerMonthHtml(trio, { km, consumption, fastPercentage, homeRate, charge }) {
    const totalKwh = km * consumption;
    const homeKwh = totalKwh * (1 - fastPercentage / 100);
    const sorted = [...trio].sort((a, b) => a.profileMonthlyCost - b.profileMonthlyCost);
    const low = sorted[0];
    const high = sorted[sorted.length - 1];
    const home = homeKwh >= 0.5
        ? t('offer.month.home', { kwh: number(homeKwh), amount: currency(homeKwh * homeRate) })
        : t('offer.month.allFast');
    const range = sorted.length > 1 && high.profileMonthlyCost - low.profileMonthlyCost >= 0.005
        ? `<div class="offer-month-range" aria-hidden="true"></div>
           <div class="offer-month-ends"><span><strong>${currency(low.profileMonthlyCost)}</strong><span>${escapeHtml(t('offer.month.allAt', { operator: localizeCommercialLabel(low.operator) }))}</span></span><span><strong>${currency(high.profileMonthlyCost)}</strong><span>${escapeHtml(t('offer.month.allAt', { operator: localizeCommercialLabel(high.operator) }))}</span></span></div>
           <p class="offer-month-text">${t('offer.month.explain')}</p>`
        : `<div class="offer-month-ends"><span><strong>${currency(low.profileMonthlyCost)}</strong><span>${escapeHtml(t('offer.month.allAt', { operator: localizeCommercialLabel(low.operator) }))}</span></span></div>`;
    const subscriptions = trio.filter(formula => formula.monthlyCost > 0).map(formula => {
        const payback = subscriptionPayback(formula, trio);
        if (!payback) return '';
        const charges = Math.max(1, Math.ceil(payback.kwh / charge.kwh));
        return `<p class="offer-month-text">${escapeHtml(t(charges === 1 ? 'offer.month.paybackOne' : 'offer.month.paybackMany', {
            formula: localizeCommercialLabel(formula.name),
            kwh: number(payback.kwh),
            operator: localizeCommercialLabel(formula.operator),
            count: number(charges),
            alternative: localizeCommercialLabel(payback.alternative.operator)
        }))}</p>`;
    }).filter(Boolean);
    const noSubscription = trio.every(formula => !(formula.monthlyCost > 0))
        ? `<p class="offer-month-text">${t('offer.month.noSubscription')}</p>` : '';
    return `<div class="offer-month-head"><h3 id="offer-month-title">${t('offer.month.title', { kwh: number(totalKwh) })}</h3><span>${escapeHtml(home)}</span></div>
        ${range}
        ${subscriptions.join('')}${noSubscription}
        <button type="button" class="offer-why" data-open-why aria-haspopup="dialog" aria-controls="why-sheet">${t('offer.why')}</button>`;
}

function detailKey(formula) {
    return `${formula.opKey}::${formula.name}`;
}

function bindWhy(why, { best, second, fastPercentage, favorites, ranked, km }) {
    if (!why) return;
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

export function renderProfileView({ formulasData, consumption, fastPercentage, homeRate, logos, favorites = new Set(), onDetail, mapOperators = [], onShowOperatorMap, coverage = null, vehicle = null, km: kmOverride }) {
    const title = document.getElementById('offer-context');
    const intro = document.getElementById('offer-intro');
    const list = document.getElementById('offer-trio');
    const month = document.getElementById('offer-month');
    const allOffers = document.getElementById('profile-all-offers-label');
    if (allOffers) allOffers.textContent = t('offer.allCount', { count: number(formulasData.length) });
    if (!list) return [];
    const km = kmOverride ?? Math.max(0, parseInt(document.getElementById('profile-km')?.value, 10) || 0);
    const setEmpty = message => {
        list.innerHTML = `<p class="profile-hero-hint">${message}</p>`;
        if (month) { month.innerHTML = ''; month.hidden = true; }
        if (title) title.textContent = '';
        if (intro) intro.innerHTML = '';
        return [];
    };
    if (formulasData.length === 0) return setEmpty(t('profile.loadingPrices'));
    if (km === 0) return setEmpty(t('profile.enterMileage'));

    const ranked = withProfileCosts(nearbyFormulas(formulasData, coverage), { km, consumption, fastPercentage, homeRate });
    if (!ranked.length) return setEmpty(t('profile.noPlans'));
    const trio = topNetworks(ranked, 3);
    const charge = chargeSize(vehicle);

    if (title) {
        const key = trio.length === 1 ? 'offer.trio.titleOne' : 'offer.trio.title';
        title.textContent = coverage
            ? t(`${key}Near`, { count: number(trio.length), place: coverage.label })
            : t(key, { count: number(trio.length) });
    }
    if (intro) {
        intro.innerHTML = coverage
            ? escapeHtml(t('offer.trio.intro'))
            : `${escapeHtml(t('offer.trio.intro'))} <button type="button" class="offer-intro-zone" data-open-profile>${t('offer.coverage.setZone')}</button>`;
    }
    list.innerHTML = trio.map((formula, index) => offerNetworkCardHtml(formula, { index, consumption, charge, coverage, logos, mapOperators })).join('');
    list.onclick = event => {
        const map = event.target.closest?.('[data-map-operator]');
        if (map) {
            onShowOperatorMap?.(map.dataset.mapOperator);
            return;
        }
        const trigger = event.target.closest?.('[data-detail]');
        if (!trigger) return;
        const formula = trio.find(item => detailKey(item) === trigger.dataset.detail);
        if (formula) onDetail?.(formula, trigger);
    };
    if (month) {
        month.hidden = false;
        month.innerHTML = offerMonthHtml(trio, { km, consumption, fastPercentage, homeRate, charge });
    }
    bindWhy(document.getElementById('why-sheet-body'), { best: trio[0], second: trio[1] || null, fastPercentage, favorites, ranked, km });
    return ranked;
}
