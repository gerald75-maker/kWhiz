// Détection des stations situées sur une aire d'autoroute, à partir du nom et de
// l'adresse de la base IRVE (qui n'a pas de champ dédié). kWhiz compare les tarifs
// hors autoroute : ces stations sont masquées par défaut sur la carte.
//
// Est retenue comme autoroute une station dont le texte mentionne :
// - une aire (« Aire de… », hors covoiturage, camping…) ;
// - ou le mot « autoroute » ;
// - ou un numéro d'autoroute (A7, A 36) donné comme adresse, sans rue ni enseigne.
// Une sortie, un échangeur ou une enseigne commerciale (hôtel, supermarché)
// indiquent au contraire une station hors autoroute, même proche d'un échangeur.

const AREA = /\baires?\s+(?:de|d['’]|du|des|la|le)\b/i;
const NOT_MOTORWAY_AREA = /covoiturage|camping|jeux|stationnement|loisirs|pique-nique/i;
const MOTORWAY_WORD = /\bautoroute\b/i;
const MOTORWAY_NUMBER = /(?<![\w-])A\s?\d{1,3}(?![\w-])/;
const OFF_MOTORWAY = /\bsortie\b|\béchangeur\b|\bpéage\b/i;
const STREET = /\b(rue|avenue|av\.|bd|boulevard|route|rte|chemin|allée|impasse|place|quai|zac|za|zi|lieu-?dit|centre commercial)\b/i;
const SHOP = /hôtel|hotel|kyriad|campanile|ibis|première classe|b&b|leclerc|carrefour|auchan|intermarch|super u|lidl|mcdonald|restaurant|garage|retail|parc commercial/i;

export function isMotorwayStation(station = {}) {
    const name = String(station.name || '');
    const address = String(station.address || '');
    const text = `${name} ${address}`;
    if (OFF_MOTORWAY.test(text) && !/\baire\b/i.test(address)) return false;
    if (AREA.test(text) && !NOT_MOTORWAY_AREA.test(text)) return true;
    if (MOTORWAY_WORD.test(text)) return true;
    return MOTORWAY_NUMBER.test(address) && !STREET.test(address) && !SHOP.test(name);
}
