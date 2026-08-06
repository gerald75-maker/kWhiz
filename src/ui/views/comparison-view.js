import { PERIOD } from '../../domain/pricing.js';
import { escapeHtml, formatNumber } from '../../shared/dom.js';

export function renderTarifsDateBanner(dateText, isError, freshness = null) {
    const banner = document.getElementById('tarifs-update-banner');
    const text = document.getElementById('tarifs-update-text');
    if (!banner || !text) return;
    banner.classList.toggle('tariffs-update-banner--error', isError);
    banner.classList.toggle('tariffs-update-banner--stale', freshness?.state === 'stale' || freshness?.state === 'critical');
    banner.classList.add('tariffs-update-banner--visible');
    text.textContent = isError
        ? '⚠️ Tarifs indisponibles — vérifiez votre connexion'
        : freshness?.state === 'critical'
            ? '⚠️ ' + freshness.label + ' — vérifiez avant de choisir'
            : freshness?.state === 'stale'
                ? '⚠️ ' + freshness.label
                : 'Tarifs vérifiés le ' + dateText;

    const infosDate = document.getElementById('infos-tarifs-date');
    if (infosDate) infosDate.textContent = isError
        ? 'Tarifs embarqués (hors ligne)'
        : freshness?.state === 'critical'
            ? '⚠️ ' + freshness.label + ' — vérifiez avant de choisir'
            : freshness?.state === 'stale'
                ? '⚠️ ' + freshness.label
                : 'Tarifs vérifiés le ' + dateText;
}

export function rankTierClass(rate, lowest) {
    if (!isFinite(rate) || !isFinite(lowest) || lowest <= 0) return '';
    if (rate <= lowest + 1e-9) return 'rank-best';
    const gapPct = (rate - lowest) / lowest * 100;
    return gapPct <= 15 ? 'rank-mid' : 'rank-high';
}

function compareValues(a, b, column, direction) {
    let valA = a[column];
    let valB = b[column];
    if (valA === Infinity && valB === Infinity) return 0;
    if (valA === Infinity) return 1;
    if (valB === Infinity) return -1;
    if (typeof valA === 'string') valA = valA.toLocaleLowerCase('fr-FR');
    if (typeof valB === 'string') valB = valB.toLocaleLowerCase('fr-FR');
    const result = valA > valB ? 1 : valA < valB ? -1 : 0;
    return direction === 'asc' ? result : -result;
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

function thresholdLabel(km) {
    if (km === 0) return 'Sans seuil';
    if (km === Infinity) return 'Non rentable';
    return `Rentable dès ${formatNumber(km)} km/mois`;
}

function subscriptionLabel(formula) {
    if (!(formula.cost > 0)) return 'Sans abonnement';
    return `${formatNumber(formula.cost, 2)} €/${formula.period === PERIOD.MONTHLY ? 'mois' : 'an'}`;
}

export function renderComparisonTable(formulasData, column, direction, { logos = {}, onModal, onDetail, query = '' } = {}) {
    const normalizedQuery = query.trim().toLocaleLowerCase('fr-FR');
    const data = formulasData
        .filter(formula => !normalizedQuery || `${formula.operator} ${formula.name}`.toLocaleLowerCase('fr-FR').includes(normalizedQuery))
        .sort((a, b) => compareValues(a, b, column, direction));

    const list = document.getElementById('ranking-list');
    const count = document.getElementById('compare-count');
    if (!list) return { column, direction, query };

    if (count) count.textContent = `${data.length} formule${data.length > 1 ? 's' : ''}`;
    const lowestCost = data.reduce((min, formula) => Math.min(min, formula.costPer100km), Infinity);

    list.innerHTML = data.length ? data.map((formula, index) => {
        const formulaKey = `${formula.opKey}::${formula.name}`;
        const logo = logos[formula.opKey]
            ? `<img src="${escapeHtml(logos[formula.opKey])}" class="compare-logo" alt="" loading="lazy">`
            : '<span class="compare-logo compare-logo--fallback" aria-hidden="true"></span>';
        const difference = Number.isFinite(lowestCost) ? formula.costPer100km - lowestCost : 0;
        const differenceText = difference <= 0.005
            ? 'Coût le plus bas'
            : `+${formatNumber(difference, 2)} €/100 km`;
        const rawRate = formula.chargebackRate !== null && Number.isFinite(formula.rateRaw)
            ? `<span class="compare-old-rate">${formatNumber(formula.rateRaw, 2)} €</span>`
            : '';
        const note = formula.note ? `<p class="compare-note">${escapeHtml(formula.note)}</p>` : '';
        const rank = index + 1;

        return `<article class="compare-item${difference <= 0.005 ? ' compare-item--best' : ''}" data-detail="${escapeHtml(formulaKey)}" tabindex="0" role="button" aria-label="Voir le détail de ${escapeHtml(formula.operator)} ${escapeHtml(formula.name)}">
            <div class="compare-rank" aria-hidden="true">${rank}</div>
            <div class="compare-identity">
                ${logo}
                <div class="compare-copy">
                    <p class="compare-operator ${escapeHtml(formula.color)}">${escapeHtml(formula.operator)}</p>
                    <h3>${escapeHtml(formula.name)}</h3>
                    <div class="compare-badges">${pricingBadge(formula)}${formula.verifiedAt ? `<span class="compare-verified">Vérifié le ${escapeHtml(formula.verifiedAt.split('-').reverse().join('/'))}</span>` : ''}</div>
                    ${note}
                </div>
            </div>
            <div class="compare-prices">
                <strong>${formatNumber(formula.costPer100km, 2)} €</strong>
                <span>/100 km</span>
                <small class="${difference <= 0.005 ? 'is-best' : ''}">${differenceText}</small>
            </div>
            <div class="compare-meta" aria-label="Détails tarifaires">
                <span><small>Tarif</small>${rawRate}${rateLabel(formula)}</span>
                <span><small>Abonnement</small>${subscriptionLabel(formula)}</span>
                <span><small>Seuil</small>${thresholdLabel(formula.km)}</span>
            </div>
            <svg class="compare-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </article>`;
    }).join('') : '<p class="compare-empty">Aucune formule ne correspond à cette recherche.</p>';

    document.querySelectorAll('.compare-sort-btn').forEach(button => {
        const active = button.dataset.sort === column;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
        button.dataset.direction = active ? direction : '';
    });

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
    return { column, direction, query };
}
