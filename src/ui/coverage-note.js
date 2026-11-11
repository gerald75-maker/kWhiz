import { escapeHtml } from '../shared/dom.js';
import { formatNumber, t } from '../i18n/i18n.js';

// Phrase de couverture locale d'une offre : « 3 stations Atlante à moins de 20 km de
// Montluçon ». Version courte pour les listes. Rien si aucune zone n'est définie ou si
// le réseau n'a pas de stations propres dans la base (Electroverse).
export function coverageNoteText(coverage, opKey, operatorLabel, { short = false } = {}) {
    if (!coverage || !coverage.operators?.has(opKey)) return '';
    const count = coverage.counts.get(opKey) || 0;
    const params = { count: formatNumber(count), operator: operatorLabel, place: coverage.label, radius: coverage.radiusKm };
    if (short) return t(count ? 'coverage.short' : 'coverage.shortNone', params);
    return t(count === 0 ? 'coverage.none' : count === 1 ? 'coverage.one' : 'coverage.many', params);
}

export function coverageNoteHtml(coverage, opKey, operatorLabel, { short = false, tag = 'p' } = {}) {
    const text = coverageNoteText(coverage, opKey, operatorLabel, { short });
    if (!text) return '';
    const empty = !(coverage.counts.get(opKey) > 0);
    return `<${tag} class="coverage-note${short ? ' coverage-note--short' : ''}${empty ? ' is-empty' : ''}"><span aria-hidden="true">⌖</span> ${escapeHtml(text)}</${tag}>`;
}
