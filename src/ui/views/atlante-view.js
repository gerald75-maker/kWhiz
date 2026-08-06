import { getAtlanteGemsRate, atlanteSteadyStateRate } from '../../domain/pricing.js';

export function renderAtlanteChargebackInfo(operators, now = new Date()) {
    const atlante = operators?.atlante;
    if (!atlante) return;
    const config = atlante.loyalty?.chargebackConfig;
    if (!config?.enabled) return;

    const goFormula = atlante.formulas?.find(formula => formula.id === 'atlante-go');
    const nominalRate = goFormula?.rate ?? 0.29;
    const gemsRate = getAtlanteGemsRate(config, now);
    const formatDate = date => date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    const formatRate = rate => atlanteSteadyStateRate(nominalRate, rate).toFixed(3).replace('.', ',').replace(/0$/, '');
    const formatCredit = rate => rate === 1 ? '1 €' : `${rate} €`.replace('.', ',');
    const promoEnd = config.promoEndDate ? new Date(`${config.promoEndDate}T23:59:59+02:00`) : null;

    const infoElement = document.getElementById('infos-atlante-cb-text');
    if (infoElement) {
        const promoNote = promoEnd && now <= promoEnd ? ` (promotion jusqu’au ${formatDate(promoEnd)})` : '';
        infoElement.textContent = `1 € payé génère ${formatCredit(gemsRate)} de crédit en Gems (taux de ${Math.round(gemsRate * 100)} %)${promoNote} • prix effectif estimé à ${formatRate(gemsRate)} €/kWh en usage régulier`;
    }
}
