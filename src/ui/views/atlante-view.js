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

    const changeDate = new Date(`${config.beforeDate}T00:00:00+02:00`);
    const promoEnd = config.promoEndDate ? new Date(`${config.promoEndDate}T23:59:59+02:00`) : null;

    let phase;
    if (now < changeDate) {
        phase = { label: `Jusqu'au ${formatDate(new Date(changeDate - 86400000))}`, rate: config.rateBefore };
    } else if (promoEnd && now <= promoEnd) {
        phase = { label: `Jusqu'au ${formatDate(promoEnd)}`, rate: config.rateAfter };
    } else if (promoEnd) {
        phase = {
            label: 'Taux actuel',
            rate: config.rateAfterPromo ?? config.rateAfter,
            unconfirmed: config.rateAfterPromo == null
        };
    } else {
        phase = { label: `À partir du ${formatDate(changeDate)}`, rate: config.rateAfter };
    }

    const stepsElement = document.getElementById('cb-modal-steps');
    if (stepsElement) {
        stepsElement.replaceChildren();
        const step = document.createElement('div');
        step.className = 'help-step help-step--compact';
        const label = document.createElement('p');
        label.className = 'cb-phase-label';
        label.append(document.createTextNode(phase.label));
        if (phase.unconfirmed) {
            const note = document.createElement('span');
            note.className = 'cb-phase-note';
            note.textContent = ' (non confirmé par Atlante — dernière valeur connue)';
            label.append(note);
        }
        const details = document.createElement('p');
        details.className = 'cb-phase-details';
        details.innerHTML = `1 € dépensé → <strong>${Math.round(phase.rate * 100)} Gems</strong> → <strong>${formatCredit(phase.rate)} offert</strong> — effectif : <strong>${formatRate(phase.rate)} €/kWh</strong>`;
        step.append(label, details);
        stepsElement.append(step);
    }

    const infoElement = document.getElementById('infos-atlante-cb-text');
    if (infoElement) {
        const promoNote = promoEnd && now <= promoEnd ? ` (promo jusqu'au ${formatDate(promoEnd)})` : '';
        infoElement.textContent = `1 € payé = ${formatCredit(gemsRate)} offert en Gems (taux ${Math.round(gemsRate * 100)} %)${promoNote} • tarif effectif ~${formatRate(gemsRate)} €/kWh en usage régulier`;
    }
}
