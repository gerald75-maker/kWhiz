import { formatNumber } from '../shared/dom.js';
import { getLanguage } from '../i18n/i18n.js';

export function buildShareText({ operator, formula, monthlyCost, annualCost, km, fastPercentage }) {
    if (getLanguage() === 'en') {
        return [
            `My kWhiz recommendation: ${operator} · ${formula}`,
            `${formatNumber(monthlyCost, 2)} €/month, or ${formatNumber(annualCost, 0)} € per year`,
            `Profile: ${formatNumber(km, 0)} km/month · ${fastPercentage}% fast charging`
        ].join('\n');
    }
    return [
        `Mon choix kWhiz : ${operator} · ${formula}`,
        `${formatNumber(monthlyCost, 2)} €/mois, soit ${formatNumber(annualCost, 0)} € par an`,
        `Profil : ${formatNumber(km, 0)} km/mois · ${fastPercentage} % de recharge rapide`
    ].join('\n');
}

async function copyText(text) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Copie impossible');
}

export async function shareResult(payload) {
    const text = buildShareText(payload);
    const url = payload.url || window.location.href.split('#')[0];

    if (navigator.share) {
        try {
            await navigator.share({ title: getLanguage() === 'en' ? 'My kWhiz recommendation' : 'Mon choix kWhiz', text, url });
            return 'shared';
        } catch (error) {
            if (error?.name === 'AbortError') return 'cancelled';
        }
    }

    await copyText(`${text}\n${url}`);
    return 'copied';
}
