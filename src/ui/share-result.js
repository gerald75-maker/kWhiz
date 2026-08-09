import { formatCurrency, formatDistance, formatPercentage, localizeCommercialLabel, t } from '../i18n/i18n.js';

function currency(value) {
    return formatCurrency(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildShareText({ operator, formula, monthlyCost, annualCost, km, fastPercentage }) {
    const operatorLabel = localizeCommercialLabel(operator);
    const formulaLabel = localizeCommercialLabel(formula);
    return [
        t('share.summaryTitle', { operator: operatorLabel, formula: formulaLabel }),
        t('share.summaryCosts', {
            monthly: t('share.monthlyAmount', { amount: currency(monthlyCost) }),
            annual: t('share.annualAmount', { amount: currency(annualCost) })
        }),
        t('share.summaryProfile', { distance: formatDistance(km), percentage: formatPercentage(fastPercentage) })
    ].join('\n');
}

async function copyText(text, { navigatorRef, documentRef }) {
    if (navigatorRef.clipboard?.writeText) {
        await navigatorRef.clipboard.writeText(text);
        return;
    }

    const textarea = documentRef.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    documentRef.body.appendChild(textarea);
    textarea.select();
    const copied = documentRef.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('share.copyFailed');
}

export async function shareResult(payload, environment = {}) {
    const navigatorRef = environment.navigatorRef || navigator;
    const documentRef = environment.documentRef || document;
    const locationRef = environment.locationRef || window.location;
    const text = buildShareText(payload);
    const url = payload.url || locationRef.href.split('#')[0];

    if (navigatorRef.share) {
        try {
            await navigatorRef.share({ title: t('share.title'), text, url });
            return 'shared';
        } catch (error) {
            if (error?.name === 'AbortError') return 'cancelled';
        }
    }

    try {
        await copyText(`${text}\n${url}`, { navigatorRef, documentRef });
        return 'copied';
    } catch {
        return 'copyFailed';
    }
}
