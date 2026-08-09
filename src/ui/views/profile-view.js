import { computeProfileMonthlyCost } from '../../domain/pricing.js';
import { escapeHtml } from '../../shared/dom.js';
import { rankTierClass } from './comparison-view.js';
import { formulaFavoriteId } from '../favorites.js';
import { shareResult } from '../share-result.js';
import { formatCurrency, formatNumber, formatPercentage, localizeCommercialLabel, localizeTariffText, t } from '../../i18n/i18n.js';

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

export function profileMonthlyAmount(value) {
    return t('profile.monthlyAmount', { amount: currency(value) });
}

export function profileAnnualAmount(value) {
    return t('profile.annualAmount', { amount: currency(value) });
}

function favoriteLabel(isFavorite) {
    return t(isFavorite ? 'favorites.remove' : 'favorites.add');
}

export function profileShareStatusLabel(result) {
    if (result === 'copied') return t('share.copied');
    if (result === 'shared') return t('share.shared');
    if (result === 'unavailable') return t('share.unavailable');
    if (result === 'copyFailed') return t('share.copyFailed');
    return '';
}

export function profileThresholdLabel({ hasSubscription, thresholdKm }) {
    if (!hasSubscription) return t('recommendation.noSubscription');
    if (!Number.isFinite(thresholdKm)) return t('recommendation.breakEvenUnreachable');
    if (thresholdKm <= 0) return t('recommendation.breakEvenImmediate');
    return t('profile.monthlyMileage', { distance: number(thresholdKm) });
}

function renderOperatorLogo(logos, opKey, imageClass, frameClass) {
    const src = logos?.[opKey];
    if (!src) return '';

    const safeKey = escapeHtml(opKey);
    return `<span class="${frameClass} ${frameClass}--${safeKey}" aria-hidden="true">
        <img src="${escapeHtml(src)}" class="${imageClass}" alt="" loading="lazy">
    </span>`;
}

export function renderProfileHero({ formulasData, consumption, fastPercentage, homeRate, favorites, logos }) {
    const card = document.getElementById('profile-best-card');
    if (!card) return;

    const km = Math.max(0, parseInt(document.getElementById('profile-km')?.value, 10) || 0);

    if (formulasData.length === 0) {
        card.innerHTML = `<p class="profile-hero-hint">${t('profile.loadingPrices')}</p>`;
        return;
    }
    if (km === 0) {
        card.innerHTML = `<p class="profile-hero-hint">${t('profile.enterMileage')}</p>`;
        return;
    }

    const withCosts = formulasData.map(formula => ({
        ...formula,
        profileMonthlyCost: computeProfileMonthlyCost(formula, km, consumption, { fastPercentage, homeRate })
    })).sort((a, b) => a.profileMonthlyCost - b.profileMonthlyCost);

    const best = withCosts[0];
    const second = withCosts[1];
    const bestHasSubscription = (best.monthlyCost || 0) > 0;
    const noSubscriptionReference = withCosts.find(formula => (formula.monthlyCost || 0) === 0 && formula !== best);
    const reference = noSubscriptionReference || second;
    const monthlySavings = reference
        ? Math.max(0, reference.profileMonthlyCost - best.profileMonthlyCost)
        : 0;
    const secondAnnualGap = second
        ? Math.max(0, (second.profileMonthlyCost - best.profileMonthlyCost) * 12)
        : 0;
	const fastRatio = fastPercentage / 100;

	const adjustedThresholdKm =
    best.km === Infinity
        ? Infinity
        : fastRatio > 0
            ? Math.ceil(best.km / fastRatio)
            : Infinity;

	const isProfitable =
    !bestHasSubscription || km >= adjustedThresholdKm;

    const threshold = profileThresholdLabel({ hasSubscription: bestHasSubscription, thresholdKm: adjustedThresholdKm });
    const countKey = withCosts.length === 1 ? 'recommendation.lowestCostOne' : 'recommendation.lowestCostMany';

    const reasons = [
        `<li><strong>${t(countKey, { count: number(withCosts.length) })}</strong></li>`,
        monthlySavings > 0.01 && reference
            ? `<li><strong>${t('recommendation.savingsComparedWith', { amount: currency(monthlySavings), operator: escapeHtml(localizeCommercialLabel(reference.operator)), formula: escapeHtml(localizeCommercialLabel(reference.name)) })}</strong></li>`
            : `<li><strong>${t('recommendation.smallGap')}</strong></li>`,
        bestHasSubscription
            ? `<li>${t(isProfitable ? 'recommendation.subscriptionProfitable' : 'recommendation.subscriptionNotYetProfitable', { threshold: `<strong>${threshold}</strong>` })}</li>`
            : `<li><strong>${t('recommendation.noSubscriptionReason')}</strong></li>`
    ];

    if (fastPercentage < 100) {
        reasons.push(`<li>${t('recommendation.homeCharging', {
            percentage: `<strong>${formatPercentage(100 - fastPercentage)}</strong>`,
            rate: t('profile.perKwh', { amount: currency(homeRate) })
        })}</li>`);
    }

    const annualCost = best.profileMonthlyCost * 12;

    const favoriteChoices = withCosts.filter(formula => favorites.has(formulaFavoriteId(formula.opKey, formula.name)));
    const favoriteReference = favoriteChoices[0] || null;
    const favoriteComparison = favoriteReference
        ? `<div class="phm-favorite-comparison">
            <span>${t('recommendation.favoriteComparison')}</span>
            <strong>${escapeHtml(localizeCommercialLabel(favoriteReference.operator))} · ${escapeHtml(localizeCommercialLabel(favoriteReference.name))}</strong>
            <span>${profileMonthlyAmount(favoriteReference.profileMonthlyCost)}${favoriteReference === best ? ` · ${t('recommendation.referencePlan')}` : ` · ${t('recommendation.favoriteGap', { amount: currency(favoriteReference.profileMonthlyCost - best.profileMonthlyCost) })}`}</span>
        </div>`
        : '';
    const details = `
        <details class="phm-details">
            <summary>${t('profile.why')}</summary>
            <div class="phm-details-content">
                <ul class="phm-reasons">${reasons.join('')}</ul>
                <div class="phm-metrics">
                    <div class="phm-row">
                        <span class="phm-label">${t('profile.mileageAnalysed')}</span>
                        <span class="phm-value">${t('profile.monthlyMileage', { distance: number(km) })}</span>
                    </div>
                    <div class="phm-row">
                        <span class="phm-label">${t('profile.fastCharging')}</span>
                        <span class="phm-value">${formatPercentage(fastPercentage)}</span>
                    </div>
                    <div class="phm-row">
                        <span class="phm-label">${t('profile.breakEven')}</span>
                        <span class="phm-value">${threshold}</span>
                    </div>
                </div>
            </div>
        </details>`;

    const logoHtml = renderOperatorLogo(logos, best.opKey, 'phm-logo', 'phm-logo-frame');
    const secondGapHtml = second
        ? `<div class="phm-gap">
            <strong>${t('recommendation.annualGap', { amount: currency(secondAnnualGap) })}</strong>
            <span>${t('recommendation.comparedWith', { operator: escapeHtml(localizeCommercialLabel(second.operator)), formula: escapeHtml(localizeCommercialLabel(second.name)) })}</span>
        </div>`
        : '';

    card.innerHTML = `
        <div class="phm-header phm-header--plain">
            <div class="phm-brand">
                ${logoHtml}
                <div>
                    <div class="phm-operator ${escapeHtml(best.color)}">${escapeHtml(localizeCommercialLabel(best.operator))}</div>
                    <div class="phm-formula">${escapeHtml(localizeCommercialLabel(best.name))}</div>
                </div>
            </div>
            <button type="button" class="phm-share-btn" id="profile-share-result" aria-describedby="profile-share-status">
                <span aria-hidden="true">↗</span> ${t('profile.share')}
            </button>
        </div>
        <div class="phm-price-hero phm-price-hero--compact">
            <span class="phm-price-label">${t('profile.estimatedMonthlyCost')}</span>
            <div class="phm-price-main">${profileMonthlyAmount(best.profileMonthlyCost)}</div>
            <div class="phm-annual-cost">${profileAnnualAmount(annualCost)}</div>
        </div>
        ${secondGapHtml}
        ${favoriteComparison}
        ${details}
        <p id="profile-share-status" class="phm-share-status" role="status" aria-live="polite"></p>
    `;

    const shareButton = document.getElementById('profile-share-result');
    const shareStatus = document.getElementById('profile-share-status');
    shareButton?.addEventListener('click', async () => {
        shareButton.disabled = true;
        if (shareStatus) shareStatus.textContent = '';
        try {
            const result = await shareResult({
                operator: best.operator,
                formula: best.name,
                monthlyCost: best.profileMonthlyCost,
                annualCost,
                km,
                fastPercentage
            });
            if (shareStatus) {
                shareStatus.textContent = profileShareStatusLabel(result);
            }
        } catch {
            if (shareStatus) shareStatus.textContent = profileShareStatusLabel('unavailable');
        } finally {
            shareButton.disabled = false;
        }
    });
}


export function recommendationSubscriptionLabel(formula) {
    if (!(formula.monthlyCost > 0)) return t('recommendation.noSubscription');
    return t('recommendation.subscriptionMonthly', {
        amount: currency(formula.monthlyCost)
    });
}

export function renderProfileShortlist(profileData, logos, favorites, onToggleFavorite) {
    const list = document.getElementById('profile-shortlist-list');
    if (!list) return;

    const top = profileData.slice(0, 3);
    if (top.length === 0) {
        list.innerHTML = `<p class="profile-shortlist-empty">${t('profile.noPlans')}</p>`;
        return;
    }

    const best = top[0].profileMonthlyCost;
    list.innerHTML = top.map((formula, index) => {
        const gap = formula.profileMonthlyCost - best;
        const logo = renderOperatorLogo(
            logos,
            formula.opKey,
            'profile-shortlist-logo',
            'profile-shortlist-logo-frame'
        );
        const meta = recommendationSubscriptionLabel(formula);
        const isFavorite = favorites.has(formulaFavoriteId(formula.opKey, formula.name));

        return `
            <article class="profile-shortlist-item${index === 0 ? ' profile-shortlist-item--best' : ''}">
                <button type="button" class="favorite-btn favorite-btn--shortlist${isFavorite ? ' is-favorite' : ''}" data-favorite-id="${escapeHtml(formulaFavoriteId(formula.opKey, formula.name))}" aria-label="${favoriteLabel(isFavorite)}" aria-pressed="${isFavorite}">★</button>
                <div class="profile-shortlist-rank">${index + 1}</div>
                <div class="profile-shortlist-name">
                    <div>${logo}<strong class="${escapeHtml(formula.color)}">${escapeHtml(localizeCommercialLabel(formula.operator))}</strong></div>
                    <span>${escapeHtml(localizeCommercialLabel(formula.name))} · ${meta}</span>
                </div>
                <div class="profile-shortlist-cost">
                    <strong>${currency(formula.profileMonthlyCost)}</strong>
                    <span>${index === 0 ? t('recommendation.lowestCost') : t('recommendation.favoriteGap', { amount: currency(gap) })}</span>
                </div>
            </article>`;
    }).join('');
    list.querySelectorAll('[data-favorite-id]').forEach(button => {
        button.addEventListener('click', () => onToggleFavorite?.(button.dataset.favoriteId));
    });
}

export function renderProfileView({ formulasData, consumption, fastPercentage, homeRate, logos, favorites = new Set(), onToggleFavorite }) {
    renderProfileHero({ formulasData, consumption, fastPercentage, homeRate, favorites, logos });
    const km = Math.max(0, parseInt(document.getElementById('profile-km')?.value, 10) || 0);

    // Construire les données — simulation ChargeBack pour Atlante, calcul standard sinon
    const profileData = formulasData.map(f => ({
        ...f,
        profileMonthlyCost: computeProfileMonthlyCost(f, km, consumption, { fastPercentage, homeRate })
    }));

    // Tri par coût mensuel croissant
    profileData.sort((a, b) => a.profileMonthlyCost - b.profileMonthlyCost);
    renderProfileShortlist(profileData, logos, favorites, onToggleFavorite);

    const tbody = document.getElementById('profile-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const best = profileData[0]?.profileMonthlyCost ?? Infinity;

    profileData.forEach((f, idx) => {
        const row = document.createElement('tr');
        const isBest = idx === 0;

        // Badges rang
        const rankBadge = isBest
            ? '<span class="profile-rank profile-rank--best">🥇</span>'
            : idx === 1 ? '<span class="profile-rank">🥈</span>'
            : idx === 2 ? '<span class="profile-rank">🥉</span>'
            : '';

        // Écart vs meilleure formule — coloré selon l'ampleur de l'écart
        const diff = f.profileMonthlyCost - best;
        const diffTier = isBest ? '' : rankTierClass(f.profileMonthlyCost, best);
        const diffHtml = isBest
            ? `<span class="profile-diff profile-diff--best">${t('recommendation.lowestCost')}</span>`
            : `<span class="profile-diff ${diffTier}">${t('recommendation.favoriteGap', { amount: currency(diff) })}</span>`;

        // Affichage tarif (barré si ChargeBack)
        const rateDisplay = f.chargebackRate !== null
            ? `<span class="cb-struck">${currency(f.rateRaw)}</span><br><span class="cb-effective-rate">${currency(f.rate, 3)}</span>`
            : currency(f.rate);

        // Abonnement mensuel
        const subDisplay = f.monthlyCost > 0
            ? `<br><span class="formula-sub">${profileMonthlyAmount(f.monthlyCost)}${f.previousCost ? ` <span class="formula-prev-cost">(${currency(f.previousCost)})</span>` : ''}</span>`
            : '';
        const noteDisplay = f.note ? `<br><span class="formula-note">${escapeHtml(localizeTariffText(f.note))}</span>` : '';
        const isFavorite = favorites.has(formulaFavoriteId(f.opKey, f.name));

        const logoHtml = logos[f.opKey] ? `<img src="${logos[f.opKey]}" class="operator-logo operator-logo--sm" alt="" loading="lazy">` : '';
        row.className = isBest ? 'profile-row--best' : '';
        row.innerHTML = `
            <td class="row-operator ${escapeHtml(f.color)}">${rankBadge}${logoHtml}${escapeHtml(localizeCommercialLabel(f.operator))}</td>
            <td><button type="button" class="favorite-btn${isFavorite ? ' is-favorite' : ''}" data-favorite-id="${escapeHtml(formulaFavoriteId(f.opKey, f.name))}" aria-label="${favoriteLabel(isFavorite)}" aria-pressed="${isFavorite}">★</button>${escapeHtml(localizeCommercialLabel(f.name))}${subDisplay}${noteDisplay}</td>
            <td>${rateDisplay}</td>
            <td class="profile-col-monthly">
                <strong>${currency(f.profileMonthlyCost)}</strong>
                ${diffHtml}
            </td>
        `;
        row.querySelector('[data-favorite-id]')?.addEventListener('click', event => {
            onToggleFavorite?.(event.currentTarget.dataset.favoriteId);
        });
        tbody.appendChild(row);
    });
}
