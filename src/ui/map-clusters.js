// Fusion des regroupements de stations qui se chevauchent à l'écran.
//
// Le regroupement par grille place chaque groupe au barycentre de ses stations :
// deux groupes de cellules voisines peuvent donc se superposer, ce qui rend les
// cibles tactiles ambiguës (WCAG 2.5.8). Cette passe fusionne les groupes de
// plusieurs stations dont les centres sont trop proches.

/** Écart minimal entre deux centres de groupes, en pixels (plus grand groupe : 42 px). */
export const MIN_CLUSTER_GAP_PX = 44;

function centroid(group, toPoint) {
    const points = group.map(toPoint);
    return {
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length
    };
}

/**
 * @param {Array<Array<object>>} groups groupes issus de la grille
 * @param {(station: object) => {x: number, y: number}} toPoint position écran d'une station
 * @param {{ minGap?: number, isPinned?: (group: Array<object>) => boolean }} [options]
 *        isPinned : groupe à ne jamais fusionner (station sélectionnée)
 * @returns {Array<Array<object>>}
 */
export function mergeOverlappingGroups(groups, toPoint, { minGap = MIN_CLUSTER_GAP_PX, isPinned = () => false } = {}) {
    const fixed = groups.filter(group => group.length < 2 || isPinned(group));
    const clusters = groups
        .filter(group => group.length > 1 && !isPinned(group))
        .map(group => ({ stations: [...group], center: centroid(group, toPoint) }));

    // Fusion gloutonne jusqu'à stabilité ; le nombre de groupes affichés reste faible.
    let merged = true;
    while (merged) {
        merged = false;
        outer: for (let i = 0; i < clusters.length; i++) {
            for (let j = i + 1; j < clusters.length; j++) {
                const dx = clusters[i].center.x - clusters[j].center.x;
                const dy = clusters[i].center.y - clusters[j].center.y;
                if (Math.hypot(dx, dy) >= minGap) continue;
                const stations = clusters[i].stations.concat(clusters[j].stations);
                clusters[i] = { stations, center: centroid(stations, toPoint) };
                clusters.splice(j, 1);
                merged = true;
                break outer;
            }
        }
    }
    return fixed.concat(clusters.map(cluster => cluster.stations));
}
