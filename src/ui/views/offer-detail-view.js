import {
    formatCurrency,
    formatDate,
    formatNumber,
    formatTariffsVerifiedOn,
    localizeTariffText,
    t
} from '../../i18n/i18n.js';

function currency(value, fractionDigits = 2) {
    return formatCurrency(value, {
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits
    });
}

function rate(value, fractionDigits = 3) {
    return `${currency(value, fractionDigits)}/kWh`;
}

function detailDate(value) {
    if (!value) return t('offerDetail.unknownDate');
    const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return formatDate(date, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function offerDetailPricingLabel(formula) {
    if (formula.pricingType === 'range' || formula.pricingType === 'discount') {
        const range = `${currency(formula.rateMin)}–${rate(formula.rateMax, 2)}`;
        return formula.pricingType === 'discount' && Number.isFinite(formula.discountPerKwh)
            ? t('offerDetail.discountRange', { discount: rate(formula.discountPerKwh, 2), range })
            : range;
    }
    if (formula.pricingType === 'station') {
        return t('offerDetail.variableEstimate', { rate: rate(formula.rate) });
    }
    return rate(formula.rate);
}

export function offerDetailTypeLabel(formula) {
    if (formula.pricingType === 'discount') return t('offerDetail.discount');
    if (formula.pricingType === 'range') return t('offerDetail.priceRange');
    if (formula.pricingType === 'station') return t('offerDetail.variablePrice');
    return t('offerDetail.fixedPrice');
}

export function offerDetailSubscriptionLabel(formula) {
    if (!(formula.cost > 0)) return t('offerDetail.noSubscription');
    if (formula.period === 'annual') {
        return t('offerDetail.annualSubscription', {
            amount: currency(formula.cost),
            monthlyAmount: currency(formula.monthlyCost ?? formula.cost / 12)
        });
    }
    return t('offerDetail.monthlySubscription', { amount: currency(formula.cost) });
}

export function offerDetailThresholdLabel(value) {
    if (value === 0) return t('offerDetail.noBreakEven');
    if (value === Infinity) return t('offerDetail.notProfitable');
    return t('offerDetail.breakEvenValue', { distance: formatNumber(Math.round(value)) });
}

function historyLabel(state) {
    const key = ['stable', 'up', 'down'].includes(state) ? state : 'unknown';
    return t(`offerDetail.history.${key}`);
}

function detailIcon(type) {
    const icons = {
        energy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>',
        subscription: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18v12H3z"/><path d="M3 10h18M16 15h2"/></svg>',
        cost: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h2m2 0h2m2 0h2M8 15h2m2 0h2m2 0h2M8 19h2m2 0h2m2 0h2"/></svg>',
        threshold: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10m5 10V4m5 16v-7m5 7V7"/><path d="m3 8 5-5 5 5 7-7"/></svg>'
    };
    return icons[type] || '';
}

function displayFormulaName(value) {
    return String(value || '').replace(/\s*[—–]\s*/g, ' – ');
}

export function renderOfferDetail({ body, title, formula, logo = '', historyEntries = [], evolution = { state: 'unknown', deltaRate: 0 } }) {
    if (!body || !title || !formula) return false;
    const formulaName = displayFormulaName(formula.name);
    const typeLabel = offerDetailTypeLabel(formula);
    const verifiedBadge = formula.verifiedAt
        ? `<span class="detail-badge detail-badge--verified">${formatTariffsVerifiedOn(formula.verifiedAt)}</span>`
        : '';
    const chargebackBadge = formula.chargebackRate !== null
        ? '<span class="detail-badge detail-badge--chargeback">ChargeBack</span>'
        : '';
    const rateDelta = evolution.deltaRate
        ? `${evolution.deltaRate > 0 ? '+' : ''}${rate(evolution.deltaRate)}`
        : t('offerDetail.noVariation');
    const historyRows = historyEntries.slice(-4).reverse().map(entry => {
        const date = entry.updatedAt || entry.capturedAt;
        const parsedDate = date ? new Date(date) : null;
        const dateLabel = parsedDate && !Number.isNaN(parsedDate.getTime())
            ? formatDate(parsedDate, { day: '2-digit', month: 'short', year: 'numeric' })
            : (entry.updatedAt || t('offerDetail.unknownDate'));
        return `<li><time>${dateLabel}</time><strong>${rate(Number(entry.rate))}</strong></li>`;
    }).join('');

    title.textContent = `${formula.operator} - ${formulaName}`;
    body.innerHTML = `
        <header class="formula-detail-header">
            ${logo}
            <div class="formula-detail-heading">
                <p class="formula-detail-operator" data-i18n-skip>${formula.operator}</p>
                <p class="formula-detail-name" data-i18n-skip>${formulaName}</p>
                <div class="formula-detail-badges"><span class="detail-badge detail-badge--type">${typeLabel}</span>${verifiedBadge}${chargebackBadge}</div>
            </div>
        </header>
        ${formula.badge ? `<p class="formula-detail-power" data-i18n-skip>${t('offerDetail.network', { power: formula.badge })}</p>` : ''}
        <dl class="formula-detail-grid">
            <div class="detail-stat detail-stat--energy"><span class="detail-stat-icon">${detailIcon('energy')}</span><span><dt>${t('offerDetail.energyPrice')}</dt><dd>${offerDetailPricingLabel(formula)}</dd></span></div>
            <div class="detail-stat detail-stat--subscription"><span class="detail-stat-icon">${detailIcon('subscription')}</span><span><dt>${t('offerDetail.subscription')}</dt><dd>${offerDetailSubscriptionLabel(formula)}</dd></span></div>
            <div class="detail-stat detail-stat--cost"><span class="detail-stat-icon">${detailIcon('cost')}</span><span><dt>${t('offerDetail.estimatedCost')}</dt><dd>${t('offerDetail.costPer100km', { amount: currency(formula.costPer100km) })}</dd></span></div>
            <div class="detail-stat detail-stat--threshold"><span class="detail-stat-icon">${detailIcon('threshold')}</span><span><dt>${t('offerDetail.breakEven')}</dt><dd>${offerDetailThresholdLabel(formula.km)}</dd></span></div>
        </dl>
        <section class="formula-history" data-state="${evolution.state}">
            <div class="formula-history-heading"><h3>${t('offerDetail.history.title')}</h3><span>${rateDelta}</span></div>
            <p>${historyLabel(evolution.state)}</p>
            ${historyRows ? `<ul>${historyRows}</ul>` : ''}
        </section>
        <section class="formula-source">
            <p><strong>${typeLabel}</strong></p>
            <p>${formatTariffsVerifiedOn(formula.verifiedAt) || t('tariffs.verifiedOn', { date: t('offerDetail.unknownDate') })}</p>
            ${formula.validUntil ? `<p>${t('offerDetail.validUntil', { date: detailDate(formula.validUntil) })}</p>` : ''}
            ${formula.calculationBasis !== 'official' ? `<p>${t('offerDetail.estimateWarning')}</p>` : ''}
            ${formula.sourceUrl ? `<a href="${formula.sourceUrl}" target="_blank" rel="noopener noreferrer">${t('offerDetail.officialSource')} <span aria-hidden="true">↗</span></a>` : ''}
        </section>
        ${formula.note ? `<p class="formula-detail-note">${localizeTariffText(formula.note)}</p>` : ''}
        ${formula.mapUrl ? `<a class="formula-detail-link" href="${formula.mapUrl}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">⌖</span> ${t('offerDetail.operatorStations')} <span aria-hidden="true">›</span></a>` : ''}`;
    return true;
}
