import { PERIOD, getAtlanteGemsRate, atlanteSteadyStateRate, chargebackBreakeven, calculateBreakeven } from '../../domain/pricing.js';
import { escapeHtml, safeUrl, formatNumber } from '../../shared/dom.js';
import { formulaFavoriteId } from '../favorites.js';
import { formatCurrency, formatTariffsVerifiedOn, getLocale, localizeTariffText, t } from '../../i18n/i18n.js';

function uiIcon(name, className = '') {
    const paths = {
        info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 10v6"></path><path d="M12 7h.01"></path>',
        map: '<path d="M9 18l-5 2V6l5-2 6 2 5-2v14l-5 2-6-2z"></path><path d="M9 4v14"></path><path d="M15 6v14"></path>',
        gem: '<path d="M6 4h12l3 5-9 11L3 9l3-5z"></path><path d="M3 9h18"></path><path d="M8 4l4 5 4-5"></path>',
        clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
        gift: '<path d="M4 10h16v10H4z"></path><path d="M3 7h18v3H3z"></path><path d="M12 7v13"></path><path d="M12 7H8.5A2.5 2.5 0 1 1 11 4.5L12 7z"></path><path d="M12 7h3.5A2.5 2.5 0 1 0 13 4.5L12 7z"></path>'
    };
    return `<svg class="ui-icon ${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name] || ''}</svg>`;
}

function buildMapLink(opKey, mapUrl, suffix) {
    const url = safeUrl(mapUrl);
    if (!url) return '';
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="map-link" title="Ouvrir la carte des bornes" aria-label="Ouvrir la carte des bornes ${escapeHtml(opKey)}">
        ${uiIcon('map')}
    </a>`;
}

function buildInfoBtns(operator) {
    let html = '';
    if (operator.iziviaInfo) {
        html += `<button class="cb-info-btn cb-info-btn--izivia" data-modal="izivia" aria-label="Horaires Happy Hours Izivia">${uiIcon('info')}</button>`;
    }
    if (operator.ionityRewards) {
        html += `<button class="cb-info-btn cb-info-btn--ionity" data-modal="ionity-rewards" aria-label="Bonus de kWh gratuits IONITY">${uiIcon('info')}</button>`;
    }
    return html;
}

function buildLoyaltyBadge(operator, detailed) {
    if (!operator.loyalty) return '';
    const cls = detailed ? 'loyalty-badge loyalty-badge--detailed' : 'loyalty-badge';
    return `<div class="${cls}">${uiIcon('gem', 'benefit-icon')}<strong>${escapeHtml(operator.loyalty.name)}</strong><span class="benefit-copy">${escapeHtml(localizeTariffText(operator.loyalty.description))}</span></div>`;
}

function buildIziviaBadge(operator, detailed) {
    if (!operator.iziviaInfo) return '';
    const cls = detailed ? 'izivia-badge izivia-badge--detailed' : 'izivia-badge';
    return `<div class="${cls}">${uiIcon('clock', 'benefit-icon')}<strong>Happy Hours</strong><span class="benefit-copy">0,30 €/kWh (9 h–11 h 30 et 15 h–18 h) — 0,35 €/kWh en dehors de ces plages</span><button class="cb-info-btn cb-info-btn--izivia" data-modal="izivia" aria-label="Horaires Happy Hours">${uiIcon('info')}</button></div>`;
}

function buildIonityRewardsBadge(operator, detailed) {
    if (!operator.ionityRewards) return '';
    const cls = detailed ? 'ionity-badge ionity-badge--detailed' : 'ionity-badge';
    return `<div class="${cls}">${uiIcon('gift', 'benefit-icon')}<strong>Rewards</strong><span class="benefit-copy">Jusqu’à 5 kWh offerts en débranchant avant 85 % (9 h–17 h) ou en rechargeant la nuit (22 h–6 h)</span><button class="cb-info-btn cb-info-btn--ionity" data-modal="ionity-rewards" aria-label="Bonus de kWh gratuits IONITY">${uiIcon('info')}</button></div>`;
}

function formatOperatorCurrency(value, digits = 2) {
    return formatCurrency(value, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatOperatorSubscription(formula) {
    if (!(formula.cost > 0)) return '';
    const key = formula.period === PERIOD.ANNUAL
        ? 'operators.subscriptionAnnual'
        : 'operators.subscriptionMonthly';
    return t(key, { amount: formatOperatorCurrency(formula.cost) });
}

export function buildFormulaMeta(formula, detailed = false) {
    const labels = {
        fixed: 'offerDetail.fixedPrice',
        station: 'operators.pricing.station',
        range: 'operators.pricing.range',
        discount: 'operators.pricing.discount'
    };
    const typeLabel = t(labels[formula.pricingType] || (formula.calculationBasis === 'estimate'
        ? 'operators.pricing.estimated'
        : 'operators.pricing.published'));
    const verified = formatTariffsVerifiedOn(formula.verifiedAt);
    const source = safeUrl(formula.sourceUrl);
    const parts = [`<span>${escapeHtml(typeLabel)}</span>`];
    if (verified) parts.push(`<span class="formula-meta-part">· ${escapeHtml(verified)}</span>`);
    if (source) parts.push(`<span class="formula-meta-part">· <a class="formula-source" href="${source}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('operators.officialSource'))}</a></span>`);
    return `<span class="formula-meta${detailed ? ' formula-meta--detailed' : ''}">${parts.join(' ')}</span>`;
}

function isChargebackEligible(operator, formula, gemsRate) {
    return Boolean(operator.loyalty?.chargebackInfo && formula.chargebackEligible && gemsRate > 0);
}

function renderOperatorsCompact(operators, consumption, logos, onModal, favorites, onToggleFavorite) {
    const container = document.getElementById('operators-compact');
    container.innerHTML = '';

    const sortedOperators = Object.entries(operators).sort((a, b) => {
        const aFav = a[1].formulas.some(formula => favorites.has(formulaFavoriteId(a[0], formula.name)));
        const bFav = b[1].formulas.some(formula => favorites.has(formulaFavoriteId(b[0], formula.name)));
        return Number(bFav) - Number(aFav) || a[1].name.localeCompare(b[1].name, getLocale());
    });
    for (const [opKey, operator] of sortedOperators) {
        const card = document.createElement('div');
        card.className = 'operator-compact';

        let formulasHtml = `
            <div class="formula-compact-header-row">
                <span class="formula-compact-name">Formule</span>
                <span class="formula-compact-rate formula-compact-rate--unit">€/kWh</span>
                <span class="formula-compact-threshold">Rentabilité</span>
            </div>`;
        const cbConfig  = operator.loyalty?.chargebackConfig || null;
        const gemsRate  = operator.loyalty?.chargebackInfo && cbConfig
            ? getAtlanteGemsRate(cbConfig) : 0;

        for (const formula of operator.formulas) {
            const result = calculateBreakeven(formula, consumption);
            const thresholdDisplay = result.km === 0 ? '—'
                : result.km === Infinity ? 'Non rentable'
                : `≥${formatNumber(result.km)} km`;

            if (isChargebackEligible(operator, formula, gemsRate)) {
                const cbRate      = atlanteSteadyStateRate(formula.rate, gemsRate);
                const cbKm        = chargebackBreakeven(formula, consumption, gemsRate);
                const cbThreshold = cbKm === 0 ? '—'
                    : cbKm === Infinity ? 'Non rentable'
                    : `≥${formatNumber(cbKm)} km`;
                formulasHtml += `
                    <div class="formula-compact">
                        <span class="formula-compact-name"><button type="button" class="favorite-btn${favorites.has(formulaFavoriteId(opKey, formula.name)) ? ' is-favorite' : ''}" data-favorite-id="${escapeHtml(formulaFavoriteId(opKey, formula.name))}" aria-label="${favorites.has(formulaFavoriteId(opKey, formula.name)) ? 'Retirer des favoris' : 'Ajouter aux favoris'}" aria-pressed="${favorites.has(formulaFavoriteId(opKey, formula.name))}">★</button>${escapeHtml(formula.name)}${formula.cost > 0 ? ` <span class="formula-sub">${escapeHtml(formatOperatorSubscription(formula))}${formula.previousCost ? ` <span class="formula-prev-cost">(${escapeHtml(formatOperatorCurrency(formula.previousCost))})</span>` : ''}</span>` : ''}${formula.note ? `<br><span class="formula-note">${escapeHtml(localizeTariffText(formula.note))}</span>` : ''}<br>${buildFormulaMeta(formula)}</span>
                        <span class="formula-compact-rate ${escapeHtml(operator.color)} cb-struck">${escapeHtml(formatOperatorCurrency(formula.rate))}</span>
                        <span class="formula-compact-threshold cb-struck">${thresholdDisplay}</span>
                    </div>
                    <div class="formula-compact cb-effective-compact">
                        <span class="formula-compact-name">${escapeHtml(t('operators.effectiveChargeback'))}</span>
                        <span class="atlante cb-effective-rate">${escapeHtml(formatOperatorCurrency(cbRate, 3))}</span>
                        <span class="formula-compact-threshold">${cbThreshold}</span>
                    </div>`;
            } else {
                formulasHtml += `
                    <div class="formula-compact">
                        <span class="formula-compact-name"><button type="button" class="favorite-btn${favorites.has(formulaFavoriteId(opKey, formula.name)) ? ' is-favorite' : ''}" data-favorite-id="${escapeHtml(formulaFavoriteId(opKey, formula.name))}" aria-label="${favorites.has(formulaFavoriteId(opKey, formula.name)) ? 'Retirer des favoris' : 'Ajouter aux favoris'}" aria-pressed="${favorites.has(formulaFavoriteId(opKey, formula.name))}">★</button>${escapeHtml(formula.name)}${formula.cost > 0 ? ` <span class="formula-sub">${escapeHtml(formatOperatorSubscription(formula))}${formula.previousCost ? ` <span class="formula-prev-cost">(${escapeHtml(formatOperatorCurrency(formula.previousCost))})</span>` : ''}</span>` : ''}${formula.note ? `<br><span class="formula-note">${escapeHtml(localizeTariffText(formula.note))}</span>` : ''}<br>${buildFormulaMeta(formula)}</span>
                        <span class="formula-compact-rate ${escapeHtml(operator.color)}">${escapeHtml(formatOperatorCurrency(formula.rate))}</span>
                        <span class="formula-compact-threshold">${thresholdDisplay}</span>
                    </div>`;
            }
        }

        const logoSrc = logos[opKey] || '';
        card.innerHTML = `
            <div class="operator-compact-header">
                <span class="operator-compact-name ${escapeHtml(operator.color)}">
                    ${logoSrc ? `<img src="${logoSrc}" class="operator-logo" alt="${escapeHtml(operator.name)}" loading="lazy">` : ''}
                    ${escapeHtml(operator.name)}${buildInfoBtns(operator)}
                </span>
                <div class="operator-card-heading">
                    ${operator.badge ? `<span class="operator-badge">${escapeHtml(t('operators.chargers', { power: operator.badge }))}</span>` : ''}
                    ${buildMapLink(opKey, operator.mapUrl, 'C')}
                </div>
            </div>
            <div class="operator-compact-formulas">${formulasHtml}</div>
            ${buildLoyaltyBadge(operator, false)}
            ${buildIziviaBadge(operator, false)}
            ${buildIonityRewardsBadge(operator, false)}
        `;
        // Délégation d'événements pour les boutons ⓘ (évite les onclick inline)
        card.addEventListener('click', event => {
            const favoriteButton = event.target.closest('[data-favorite-id]');
            if (favoriteButton) {
                onToggleFavorite?.(favoriteButton.dataset.favoriteId);
                return;
            }
            handleInfoBtnClick(event, onModal);
        });
        container.appendChild(card);
    }
}

function renderOperatorsDetailed(operators, consumption, logos, onModal, favorites, onToggleFavorite) {
    const container = document.getElementById('operators-detailed');
    container.innerHTML = '';

    const sortedOperators = Object.entries(operators).sort((a, b) => {
        const aFav = a[1].formulas.some(formula => favorites.has(formulaFavoriteId(a[0], formula.name)));
        const bFav = b[1].formulas.some(formula => favorites.has(formulaFavoriteId(b[0], formula.name)));
        return Number(bFav) - Number(aFav) || a[1].name.localeCompare(b[1].name, getLocale());
    });
    for (const [opKey, operator] of sortedOperators) {
        const card = document.createElement('div');
        card.className = 'operator-card';

        const cbConfigD  = operator.loyalty?.chargebackConfig || null;
        const gemsRateD  = operator.loyalty?.chargebackInfo && cbConfigD
            ? getAtlanteGemsRate(cbConfigD) : 0;

        let rowsHtml = '';
        for (const formula of operator.formulas) {
            const result = calculateBreakeven(formula, consumption);
            const costDisplay = formula.period === PERIOD.NONE ? '—'
                : `${escapeHtml(formatOperatorSubscription(formula))}${formula.previousCost ? ` <span class="formula-prev-cost">(${escapeHtml(formatOperatorCurrency(formula.previousCost))})</span>` : ''}`;
            const thresholdDisplay = result.km === 0 ? '—'
                : result.km === Infinity ? 'Non rentable'
                : `${formatNumber(result.km)} km/mois`;

            if (isChargebackEligible(operator, formula, gemsRateD)) {
                const cbRate      = atlanteSteadyStateRate(formula.rate, gemsRateD);
                const cbKm        = chargebackBreakeven(formula, consumption, gemsRateD);
                const cbThreshold = cbKm === 0 ? '—'
                    : cbKm === Infinity ? 'Non rentable'
                    : `${formatNumber(cbKm)} km/mois`;
                rowsHtml += `
                    <tr class="cb-struck-row">
                        <td class="formula-name" rowspan="2"><button type="button" class="favorite-btn${favorites.has(formulaFavoriteId(opKey, formula.name)) ? ' is-favorite' : ''}" data-favorite-id="${escapeHtml(formulaFavoriteId(opKey, formula.name))}" aria-label="${favorites.has(formulaFavoriteId(opKey, formula.name)) ? 'Retirer des favoris' : 'Ajouter aux favoris'}" aria-pressed="${favorites.has(formulaFavoriteId(opKey, formula.name))}">★</button>${escapeHtml(formula.name)}${formula.note ? `<br><span class="formula-note">${escapeHtml(localizeTariffText(formula.note))}</span>` : ''}<br>${buildFormulaMeta(formula, true)}</td>
                        <td class="formula-cost" rowspan="2">${costDisplay}</td>
                        <td class="formula-kwh ${escapeHtml(operator.color)} cb-struck">${escapeHtml(formatOperatorCurrency(formula.rate))}</td>
                        <td class="result-km cb-struck">${thresholdDisplay}</td>
                    </tr>
                    <tr class="cb-effective-row">
                        <td class="atlante cb-effective-rate">${escapeHtml(formatOperatorCurrency(cbRate, 3))}</td>
                        <td class="result-km">${cbThreshold}</td>
                    </tr>`;
            } else {
                rowsHtml += `
                    <tr>
                        <td class="formula-name"><button type="button" class="favorite-btn${favorites.has(formulaFavoriteId(opKey, formula.name)) ? ' is-favorite' : ''}" data-favorite-id="${escapeHtml(formulaFavoriteId(opKey, formula.name))}" aria-label="${favorites.has(formulaFavoriteId(opKey, formula.name)) ? 'Retirer des favoris' : 'Ajouter aux favoris'}" aria-pressed="${favorites.has(formulaFavoriteId(opKey, formula.name))}">★</button>${escapeHtml(formula.name)}${formula.note ? `<br><span class="formula-note">${escapeHtml(localizeTariffText(formula.note))}</span>` : ''}<br>${buildFormulaMeta(formula, true)}</td>
                        <td class="formula-cost">${costDisplay}</td>
                        <td class="formula-kwh ${escapeHtml(operator.color)}">${escapeHtml(formatOperatorCurrency(formula.rate))}</td>
                        <td class="result-km">${thresholdDisplay}</td>
                    </tr>`;
            }
        }

        const logoSrc = logos[opKey] || '';
        card.innerHTML = `
            <div class="operator-header">
                <span class="operator-name ${escapeHtml(operator.color)}">
                    ${logoSrc ? `<img src="${logoSrc}" class="operator-logo" alt="${escapeHtml(operator.name)}" loading="lazy">` : ''}
                    ${escapeHtml(operator.name)}${buildInfoBtns(operator)}
                </span>
                <div class="header-right">
                    ${operator.badge ? `<span class="operator-badge">${escapeHtml(t('operators.chargers', { power: operator.badge }))}</span>` : ''}
                    ${buildMapLink(opKey, operator.mapUrl, 'D')}
                </div>
            </div>
            <table class="tarif-table">
                <thead><tr>
                    <th>Formule</th><th>Coût</th><th>€/kWh</th><th>Rentabilité</th>
                </tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
            ${buildLoyaltyBadge(operator, true)}
            ${buildIziviaBadge(operator, true)}
            ${buildIonityRewardsBadge(operator, true)}
        `;
        card.addEventListener('click', event => {
            const favoriteButton = event.target.closest('[data-favorite-id]');
            if (favoriteButton) {
                onToggleFavorite?.(favoriteButton.dataset.favoriteId);
                return;
            }
            handleInfoBtnClick(event, onModal);
        });
        container.appendChild(card);
    }
}

function handleInfoBtnClick(e, onModal) {
    const btn = e.target.closest('[data-modal]');
    if (!btn) return;
    onModal?.(btn.dataset.modal);
}

export function renderOperatorsViews({ operators, consumption, logos, onModal, favorites = new Set(), onToggleFavorite }) {
    const count = document.getElementById('operators-page-count');
    if (count) {
        const operatorCount = Object.keys(operators).length;
        const formulaCount = Object.values(operators).reduce((total, operator) => total + operator.formulas.length, 0);
        count.innerHTML = `<strong>${operatorCount}</strong><span>opérateurs</span><strong>${formulaCount}</strong><span>formules</span>`;
    }
    renderOperatorsCompact(operators, consumption, logos, onModal, favorites, onToggleFavorite);
    renderOperatorsDetailed(operators, consumption, logos, onModal, favorites, onToggleFavorite);
}
