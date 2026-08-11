export const IRVE_NETWORKS = Object.freeze([
  ['engie-vianeo', /\b(?:engie\s+)?vianeo\b/],
  ['ionity', /\bionity\b/],
  ['tesla', /\btesla\b|supercharger/],
  ['electra', /\belectra\b/],
  ['iecharge', /\biecharge\b|nw ie charge/],
  ['fastned', /\bfastned\b/],
  ['atlante', /\batlante\b/],
  ['zunder', /\bzunder\b/],
  ['pluginn', /\bplug inn fast charge\b/],
  ['iziviafast', /\bizivia\b/],
  ['lidl', /\blidl\b/]
]);

// Electroverse agrège des réseaux partenaires : il n'exploite pas de stations
// propres à faire correspondre dans la Base nationale IRVE.
export const ACTIVE_WITHOUT_OWN_STATIONS = Object.freeze(['electroverse']);

export const IRVE_OPERATOR_KEYS = Object.freeze(IRVE_NETWORKS.map(([key]) => key));

export function resolveIrveDate({ sourceDate, inputPath, now = new Date() }) {
  if (sourceDate) {
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(sourceDate) || Number.isNaN(Date.parse(`${sourceDate}T00:00:00Z`))) {
      throw new Error(`Date IRVE invalide : ${sourceDate}`);
    }
    return sourceDate;
  }
  const compact = String(inputPath || '').match(/(?:^|\D)(20\d{6})(?:\D|$)/)?.[1];
  if (compact) return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  return now.toISOString().slice(0, 10);
}
