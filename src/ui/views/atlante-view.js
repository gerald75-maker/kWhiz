import { getAtlanteGemsRate, atlanteSteadyStateRate } from '../../domain/pricing.js';
import { formatCurrency, formatDate, formatPercentage, t } from '../../i18n/i18n.js';

let currentState = null;

export function buildAtlanteChargebackState(operators, now = new Date()) {
    const atlante = operators?.atlante;
    const config = atlante?.loyalty?.chargebackConfig;
    if (!config?.enabled) return null;

    const goFormula = atlante.formulas?.find(formula => formula.id === 'atlante-go');
    const nominalRate = goFormula?.rate ?? 0.29;
    const gemsRate = getAtlanteGemsRate(config, now);
    const promoEnd = config.promoEndDate ? new Date(`${config.promoEndDate}T23:59:59+02:00`) : null;

    return {
        paid: 1,
        credit: gemsRate,
        gemsRate,
        effectiveRate: atlanteSteadyStateRate(nominalRate, gemsRate),
        promoEnd: promoEnd && now <= promoEnd ? promoEnd : null
    };
}

export function renderAtlanteChargebackState(state = currentState) {
    const infoElement = document.getElementById('infos-atlante-cb-text');
    if (!infoElement || !state) return;

    const promotion = state.promoEnd
        ? t('tariffsInfo.atlanteChargeback.promotion', { date: formatDate(state.promoEnd, { day: 'numeric', month: 'long' }) })
        : '';
    infoElement.textContent = t('tariffsInfo.atlanteChargeback.summary', {
        paid: formatCurrency(state.paid, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
        credit: formatCurrency(state.credit, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        rate: formatPercentage(state.gemsRate * 100, { maximumFractionDigits: 0 }),
        promotion,
        effectiveRate: formatCurrency(state.effectiveRate, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    });
}

export function renderAtlanteChargebackInfo(operators, now = new Date()) {
    currentState = buildAtlanteChargebackState(operators, now);
    renderAtlanteChargebackState(currentState);
}
