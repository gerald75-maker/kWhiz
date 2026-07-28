/**
 * prune-old-assets.mjs
 *
 * Post-build script — nettoie dist/assets/ des anciens bundles hashés.
 *
 * Contexte : vite.config.js utilise `emptyOutDir: false` volontairement
 * (voir commentaire dans vite.config.js) pour qu'un déploiement FTP non-atomique
 * sur o2switch ne casse pas les sessions en cours pendant l'upload. Conséquence :
 * chaque `npm run build` ajoute de nouveaux fichiers hashés (assets/index-XXXX.js)
 * sans jamais supprimer les précédents → dist/assets/ grossit indéfiniment.
 *
 * Ce script garde :
 *   1. Les fichiers référencés par le dist/index.html actuel (build courant).
 *   2. Le groupe de fichiers non référencés le plus récent (build précédent),
 *      identifié par proximité de date de modification — c'est le filet de
 *      sécurité pour les clients qui auraient encore l'ancien index.html en cache
 *      pendant la bascule.
 * Et supprime tout le reste (builds plus anciens).
 *
 * Usage : node scripts/prune-old-assets.mjs
 * Appelé automatiquement via "npm run build", après inject-build-vars.mjs.
 */

import { readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const root       = resolve(__dirname, '..');
const indexPath  = resolve(root, 'dist', 'index.html');
const assetsDir  = resolve(root, 'dist', 'assets');

// Fenêtre de regroupement : les fichiers d'un même build vite sont écrits en
// quelques secondes. 10 min laisse une marge confortable tout en séparant
// clairement deux builds distincts.
const CLUSTER_WINDOW_MS = 10 * 60 * 1000;

// ── 1. Lire dist/index.html → fichiers référencés (build courant) ───────────
let indexContent;
try {
  indexContent = readFileSync(indexPath, 'utf8');
} catch (err) {
  console.error(`[prune-old-assets] ✗ Impossible de lire ${indexPath}`);
  console.error(`  → Avez-vous lancé "vite build" avant ce script ?`);
  process.exit(1);
}

const referenced = new Set(
  [...indexContent.matchAll(/assets\/[A-Za-z0-9_.-]+/g)].map(m => m[0].replace(/^assets\//, ''))
);

if (referenced.size === 0) {
  console.warn('[prune-old-assets] ⚠ Aucune référence "assets/…" trouvée dans dist/index.html — abandon par précaution.');
  process.exit(0);
}

// ── 2. Lister dist/assets/ ───────────────────────────────────────────────────
let entries;
try {
  entries = readdirSync(assetsDir, { withFileTypes: true }).filter(e => e.isFile());
} catch (err) {
  console.error(`[prune-old-assets] ✗ Impossible de lire ${assetsDir}`);
  process.exit(1);
}

// Vérif défensive : un fichier référencé mais absent du disque = build cassé.
for (const name of referenced) {
  if (!entries.some(e => e.name === name)) {
    console.warn(`[prune-old-assets] ⚠ "${name}" est référencé dans index.html mais absent de dist/assets/`);
  }
}

// ── 3. Séparer fichiers du build courant / candidats à la purge ─────────────
const unreferenced = entries
  .filter(e => !referenced.has(e.name))
  .map(e => ({ name: e.name, mtime: statSync(join(assetsDir, e.name)).mtimeMs }));

if (unreferenced.length === 0) {
  console.log('[prune-old-assets] ✓ Rien à purger — dist/assets/ ne contient que le build courant.');
  process.exit(0);
}

// ── 4. Garder le cluster le plus récent (build précédent), purger le reste ──
const newestUnreferencedMtime = Math.max(...unreferenced.map(f => f.mtime));

const toDelete = unreferenced.filter(f => newestUnreferencedMtime - f.mtime > CLUSTER_WINDOW_MS);
const toKeep   = unreferenced.filter(f => newestUnreferencedMtime - f.mtime <= CLUSTER_WINDOW_MS);

for (const f of toKeep) {
  console.log(`[prune-old-assets] ℹ Conservé (build précédent, filet de sécurité) : ${f.name}`);
}

let deletedCount = 0;
let deletedBytes = 0;
for (const f of toDelete) {
  const filePath = join(assetsDir, f.name);
  try {
    deletedBytes += statSync(filePath).size;
    unlinkSync(filePath);
    deletedCount++;
    console.log(`[prune-old-assets] ✓ Supprimé (build obsolète) : ${f.name}`);
  } catch (err) {
    console.warn(`[prune-old-assets] ⚠ Impossible de supprimer ${f.name} : ${err.message}`);
  }
}

if (deletedCount > 0) {
  console.log(`[prune-old-assets] ✓ ${deletedCount} fichier(s) purgé(s) (${(deletedBytes / 1024).toFixed(0)} Ko libérés).`);
} else {
  console.log('[prune-old-assets] ✓ Rien à purger au-delà du build précédent.');
}
