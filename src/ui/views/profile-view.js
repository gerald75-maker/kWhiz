import { computeProfileMonthlyCost } from '../../domain/pricing.js';
import { escapeHtml, formatNumber } from '../../shared/dom.js';
import { rankTierClass } from './comparison-view.js';
import { formulaFavoriteId } from '../favorites.js';
import { shareResult } from '../share-result.js';

function renderOperatorLogo(logos, opKey, imageClass, frameClass) {
    const src = logos?.[opKey];
    if (!src) return '';

    const safeKey = escapeHtml(opKey);
    return `<span class="${frameClass} ${frameClass}--${safeKey}" aria-hidden="true">
        <img src="${escapeHtml(src)}" class="${imageClass}" alt="" loading="lazy">
    </span>`;
}

function renderProfileHero({ formulasData, consumption, fastPercentage, homeRate, favorites, logos }) {
    const card = document.getElementById('profile-best-card');
    if (!card) return;

    const km = Math.max(0, parseInt(document.getElementById('profile-km')?.value, 10) || 0);

    if (formulasData.length === 0) {
        card.innerHTML = '<p class="profile-hero-hint">Chargement des tarifs…</p>';
        return;
    }
    if (km === 0) {
        card.innerHTML = '<p class="profile-hero-hint">Indiquez votre kilométrage mensuel pour obtenir une recommandation.</p>';
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
    const annualSavings = monthlySavings * 12;
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

	let threshold = 'Aucun abonnement';
	if (bestHasSubscription) {
    	if (adjustedThresholdKm === Infinity) {
        	threshold = 'Seuil non atteignable';
    } else if (adjustedThresholdKm > 0) {
        threshold = `${formatNumber(adjustedThresholdKm, 0)} km/mois`;
    }
}

    const reasons = [
        `<li><strong>Coût total le plus bas</strong> parmi ${withCosts.length} formules comparées.</li>`,
        monthlySavings > 0.01 && reference
            ? `<li><strong>${formatNumber(monthlySavings, 2)} € économisés par mois</strong> face à ${escapeHtml(reference.operator)} ${escapeHtml(reference.name)}.</li>`
            : '<li><strong>Écart très faible</strong> avec l’alternative suivante&nbsp;: le choix peut dépendre de la couverture du réseau.</li>',
        bestHasSubscription
            ? `<li>Abonnement ${isProfitable ? 'rentabilisé' : 'non encore rentabilisé'} pour votre kilométrage, seuil&nbsp;: <strong>${threshold}</strong>.</li>`
            : '<li><strong>Sans abonnement</strong>&nbsp;: aucun coût fixe lorsque vous rechargez peu.</li>'
    ];

    if (fastPercentage < 100) {
        reasons.push(`<li>Le calcul inclut <strong>${100 - fastPercentage} % de recharge à domicile</strong> à ${formatNumber(homeRate, 2)} €/kWh.</li>`);
    }

    const annualCost = best.profileMonthlyCost * 12;

    const favoriteChoices = withCosts.filter(formula => favorites.has(formulaFavoriteId(formula.opKey, formula.name)));
    const favoriteReference = favoriteChoices[0] || null;
    const favoriteComparison = favoriteReference
        ? `<div class="phm-favorite-comparison">
            <span>Comparaison avec votre favori</span>
            <strong>${escapeHtml(favoriteReference.operator)} · ${escapeHtml(favoriteReference.name)}</strong>
            <span>${formatNumber(favoriteReference.profileMonthlyCost, 2)} €/mois${favoriteReference === best ? ' · offre de référence' : ` · +${formatNumber(favoriteReference.profileMonthlyCost - best.profileMonthlyCost, 2)} €`}</span>
        </div>`
        : '';
    const details = `
        <details class="phm-details">
            <summary>Pourquoi ce choix&nbsp;?</summary>
            <div class="phm-details-content">
                <ul class="phm-reasons">${reasons.join('')}</ul>
                <div class="phm-metrics">
                    <div class="phm-row">
                        <span class="phm-label">Kilométrage analysé</span>
                        <span class="phm-value">${formatNumber(km, 0)} km/mois</span>
                    </div>
                    <div class="phm-row">
                        <span class="phm-label">Recharge rapide</span>
                        <span class="phm-value">${fastPercentage} %</span>
                    </div>
                    <div class="phm-row">
                        <span class="phm-label">Seuil de rentabilité</span>
                        <span class="phm-value">${threshold}</span>
                    </div>
                </div>
            </div>
        </details>`;

    const logoHtml = renderOperatorLogo(logos, best.opKey, 'phm-logo', 'phm-logo-frame');
    const secondGapHtml = second
        ? `<div class="phm-gap">
            <strong>${formatNumber(secondAnnualGap, 0)} € par an de moins</strong>
            <span>que ${escapeHtml(second.operator)} · ${escapeHtml(second.name)}</span>
        </div>`
        : '';

    card.innerHTML = `
        <div class="phm-header phm-header--plain">
            <div class="phm-brand">
                ${logoHtml}
                <div>
                    <div class="phm-operator ${escapeHtml(best.color)}">${escapeHtml(best.operator)}</div>
                    <div class="phm-formula">${escapeHtml(best.name)}</div>
                </div>
            </div>
            <button type="button" class="phm-share-btn" id="profile-share-result" aria-describedby="profile-share-status">
                <span aria-hidden="true">↗</span> Partager
            </button>
        </div>
        <div class="phm-price-hero phm-price-hero--compact">
            <span class="phm-price-label">Coût mensuel estimé</span>
            <div class="phm-price-main">${formatNumber(best.profileMonthlyCost, 2)}<span> €/mois</span></div>
            <div class="phm-annual-cost">${formatNumber(annualCost, 0)} € par an</div>
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
                shareStatus.textContent = result === 'copied'
                    ? 'Résultat copié dans le presse-papiers.'
                    : result === 'shared'
                        ? 'Résultat partagé.'
                        : '';
            }
        } catch {
            if (shareStatus) shareStatus.textContent = 'Partage impossible sur cet appareil.';
        } finally {
            shareButton.disabled = false;
        }
    });
}


function renderProfileShortlist(profileData, logos, favorites, onToggleFavorite) {
    const list = document.getElementById('profile-shortlist-list');
    if (!list) return;

    const top = profileData.slice(0, 3);
    if (top.length === 0) {
        list.innerHTML = '<p class="profile-shortlist-empty">Aucune formule disponible.</p>';
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
        const meta = formula.monthlyCost > 0
            ? `${formatNumber(formula.monthlyCost, 2)} €/mois d’abonnement`
            : 'Sans abonnement';

        return `
            <article class="profile-shortlist-item${index === 0 ? ' profile-shortlist-item--best' : ''}">
                <button type="button" class="favorite-btn favorite-btn--shortlist${favorites.has(formulaFavoriteId(formula.opKey, formula.name)) ? ' is-favorite' : ''}" data-favorite-id="${escapeHtml(formulaFavoriteId(formula.opKey, formula.name))}" aria-label="${favorites.has(formulaFavoriteId(formula.opKey, formula.name)) ? 'Retirer des favoris' : 'Ajouter aux favoris'}" aria-pressed="${favorites.has(formulaFavoriteId(formula.opKey, formula.name))}">★</button>
                <div class="profile-shortlist-rank">${index + 1}</div>
                <div class="profile-shortlist-name">
                    <div>${logo}<strong class="${escapeHtml(formula.color)}">${escapeHtml(formula.operator)}</strong></div>
                    <span>${escapeHtml(formula.name)} · ${meta}</span>
                </div>
                <div class="profile-shortlist-cost">
                    <strong>${formatNumber(formula.profileMonthlyCost, 2)} €</strong>
                    <span>${index === 0 ? 'coût le plus bas' : `+${formatNumber(gap, 2)} €`}</span>
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
            ? '<span class="profile-diff profile-diff--best">coût le plus bas</span>'
            : `<span class="profile-diff ${diffTier}">+${formatNumber(diff, 2)}€</span>`;

        // Affichage tarif (barré si ChargeBack)
        const rateDisplay = f.chargebackRate !== null
            ? `<span class="cb-struck">${formatNumber(f.rateRaw, 2)}€</span><br><span class="cb-effective-rate">${formatNumber(f.rate, 3)}€</span>`
            : `${formatNumber(f.rate, 2)}€`;

        // Abonnement mensuel
        const subDisplay = f.monthlyCost > 0
            ? `<br><span class="formula-sub">${formatNumber(f.monthlyCost, 2)}€/mois${f.previousCost ? ` <span class="formula-prev-cost">(${formatNumber(f.previousCost, 2)}€)</span>` : ''}</span>`
            : '';
        const noteDisplay = f.note ? `<br><span class="formula-note">${escapeHtml(f.note)}</span>` : '';

        const logoHtml = logos[f.opKey] ? `<img src="${logos[f.opKey]}" class="operator-logo operator-logo--sm" alt="" loading="lazy">` : '';
        row.className = isBest ? 'profile-row--best' : '';
        row.innerHTML = `
            <td class="row-operator ${escapeHtml(f.color)}">${rankBadge}${logoHtml}${escapeHtml(f.operator)}</td>
            <td><button type="button" class="favorite-btn${favorites.has(formulaFavoriteId(f.opKey, f.name)) ? ' is-favorite' : ''}" data-favorite-id="${escapeHtml(formulaFavoriteId(f.opKey, f.name))}" aria-label="${favorites.has(formulaFavoriteId(f.opKey, f.name)) ? 'Retirer des favoris' : 'Ajouter aux favoris'}" aria-pressed="${favorites.has(formulaFavoriteId(f.opKey, f.name))}">★</button>${escapeHtml(f.name)}${subDisplay}${noteDisplay}</td>
            <td>${rateDisplay}</td>
            <td class="profile-col-monthly">
                <strong>${formatNumber(f.profileMonthlyCost, 2)}€</strong>
                ${diffHtml}
            </td>
        `;
        row.querySelector('[data-favorite-id]')?.addEventListener('click', event => {
            onToggleFavorite?.(event.currentTarget.dataset.favoriteId);
        });
        tbody.appendChild(row);
    });
}
