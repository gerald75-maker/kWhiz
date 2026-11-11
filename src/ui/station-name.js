// Nom lisible d'une station pour l'affichage. Les données IRVE ne sont pas modifiées :
// les identifiants, les statuts et les liens restent ceux de la base nationale.
//
// - Un nom technique (« LFR4049EVCP03 », « 836 », « GF18 ») ou réduit à la marque
//   (« LIDL », « IONITY GMBH », « ENGIE Vianeo ») devient « Réseau · Commune », la
//   commune étant lue dans l'adresse. Sans commune : le nom du réseau seul.
// - Un nom tout en majuscules (« AIGUES-MORTES ») est remis en casse de titre.
// - Les mentions juridiques (GmbH, SAS) et le nom de réseau répété sont retirés.

const LEGAL_FORMS = /\b(gmbh|sas|sasu|sarl|s\.a\.s\.?|s\.a\.?)\b/gi;
const BRAND_NAMES = [
    'lidl', 'atlante', 'engie vianeo', 'ionity', 'izivia fast', 'izivia express', 'izivia max',
    'izivia', 'tesla', 'tesla supercharger', 'zunder', 'fastned', 'electra', 'iecharge', 'plug inn', 'powerdot'
];
const LOWERCASE_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'sur', 'sous', 'en', 'et', 'aux', 'au', 'à', 'lès', 'lez']);

const simplify = value => String(value || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

function isTechnicalCode(name) {
    if (/^\d+$/.test(name)) return true;
    if (/\s/.test(name)) return false;
    // Codes sans espace mêlant lettres et chiffres : LFR4049EVCP03, GF18, COU25E, e-charge50
    return /\d/.test(name) && /[a-z]/i.test(name);
}

function isBrandOnly(name, operatorLabel) {
    const simple = simplify(name);
    return simple === simplify(operatorLabel) || BRAND_NAMES.includes(simple);
}

export function communeFromAddress(address) {
    const text = String(address || '').replace(/,?\s*France\s*$/i, '').trim();
    const afterPostcode = text.match(/\b\d{5}\b[\s,]+([^,\d][^,]*?)\s*$/);
    if (afterPostcode) return titleCaseIfUpper(afterPostcode[1].trim());
    const last = text.split(',').pop().trim();
    const beforePostcode = last.match(/^([^\d,]+?)\s+\d{5}$/);
    return beforePostcode ? titleCaseIfUpper(beforePostcode[1].trim()) : '';
}

export function titleCaseIfUpper(value) {
    const text = String(value || '').trim();
    if (!/[A-ZÀ-Ý]/.test(text) || text !== text.toUpperCase()) return text;
    let first = true;
    return text.toLowerCase().replace(/[^\s-']+/g, word => {
        const keepLower = !first && LOWERCASE_WORDS.has(word);
        first = false;
        return keepLower ? word : word.charAt(0).toUpperCase() + word.slice(1);
    });
}

function withoutLegalForms(name, operatorLabel) {
    let text = name.replace(LEGAL_FORMS, ' ').replace(/\s+/g, ' ').trim();
    // « IONITY IONITY Vérités » → « IONITY Vérités »
    const label = operatorLabel.split(' ')[0];
    if (label) {
        const repeated = new RegExp(`^(${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s+\\1\\b`, 'i');
        text = text.replace(repeated, '$1');
    }
    return text;
}

export function stationDisplayName(station = {}, operatorLabel = '') {
    const raw = String(station.name || '').trim();
    const name = withoutLegalForms(raw, operatorLabel);
    if (!name || isTechnicalCode(name) || isBrandOnly(name, operatorLabel)) {
        const commune = communeFromAddress(station.address);
        if (operatorLabel && commune) return `${operatorLabel} · ${commune}`;
        return operatorLabel || commune || raw;
    }
    return titleCaseIfUpper(name);
}
