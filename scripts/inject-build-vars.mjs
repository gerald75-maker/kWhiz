/**
 * inject-build-vars.mjs
 *
 * Post-build script — injecte deux variables dans dist/ :
 *
 *   1. Version (dist/index.html)
 *      Remplace __VERSION__ par la valeur de "version" dans package.json.
 *      Source unique : package.json → plus jamais de numéro hardcodé dans le HTML.
 *
 *   2. Cache hash SW (dist/sw.js)
 *      Calcule un SHA-256 de dist/index.html (déjà patché avec la version)
 *      et l'injecte à la place du placeholder __CACHE_HASH__.
 *      Garantit un nouveau nom de cache à chaque build qui modifie quelque chose.
 *
 * Usage : node scripts/inject-build-vars.mjs
 * Appelé automatiquement via "npm run build".
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, '..');

const pkgPath   = resolve(root, 'package.json');
const indexPath = resolve(root, 'dist', 'index.html');
const swPath    = resolve(root, 'dist', 'sw.js');

const VERSION_PLACEHOLDER = '__VERSION__';
const HASH_PLACEHOLDER    = '__CACHE_HASH__';
const ASSETS_PLACEHOLDER  = '__BUILD_ASSETS__';

// ── 1. Lire package.json → version ───────────────────────────────────────────
let version;
try {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  version = pkg.version;
  if (!version) throw new Error('"version" absent de package.json');
} catch (err) {
  console.error(`[inject-build-vars] ✗ Impossible de lire la version depuis package.json`);
  console.error(`  → ${err.message}`);
  process.exit(1);
}

// Formater : "3.90.0" → "v3.90"  (retire le patch si = 0, ajoute le préfixe v)
const [major, minor, patch] = version.split('.').map(Number);
const displayVersion = patch === 0 ? `v${major}.${minor}` : `v${major}.${minor}.${patch}`;

// ── 2. Lire dist/index.html ──────────────────────────────────────────────────
let indexContent;
try {
  indexContent = readFileSync(indexPath, 'utf8');
} catch (err) {
  console.error(`[inject-build-vars] ✗ Impossible de lire ${indexPath}`);
  console.error(`  → Avez-vous lancé "vite build" avant ce script ?`);
  process.exit(1);
}

// ── 3. Injecter la version dans dist/index.html ──────────────────────────────
// Note : le plugin Vite htmlVersion() remplace déjà __VERSION__ pendant le build.
// Si le placeholder est absent, c'est normal — on continue (le hash SW reste utile).
let indexPatched = indexContent;
if (indexContent.includes(VERSION_PLACEHOLDER)) {
  indexPatched = indexContent.replace(VERSION_PLACEHOLDER, displayVersion);
  try {
    writeFileSync(indexPath, indexPatched, 'utf8');
  } catch (err) {
    console.error(`[inject-build-vars] ✗ Impossible d'écrire dans ${indexPath}`);
    process.exit(1);
  }
  console.log(`[inject-build-vars] ✓ Version injectée : ${displayVersion}`);
} else {
  console.log(`[inject-build-vars] ℹ Version déjà injectée par Vite : ${displayVersion}`);
}

// ── 4. Calculer le hash sur index.html patché ────────────────────────────────
const hash = createHash('sha256').update(indexPatched).digest('hex').slice(0, 8);

// ── 5. Lire dist/sw.js ───────────────────────────────────────────────────────
let swContent;
try {
  swContent = readFileSync(swPath, 'utf8');
} catch (err) {
  console.error(`[inject-build-vars] ✗ Impossible de lire ${swPath}`);
  process.exit(1);
}

if (!swContent.includes(HASH_PLACEHOLDER)) {
  console.error(`[inject-build-vars] ✗ Placeholder "${HASH_PLACEHOLDER}" introuvable dans dist/sw.js`);
  console.error(`  → Vérifiez que public/sw.js contient bien : 'kwhiz-__CACHE_HASH__'`);
  process.exit(1);
}

// ── 6. Injecter le hash dans dist/sw.js ─────────────────────────────────────
if (!swContent.includes(ASSETS_PLACEHOLDER)) {
  console.error(`[inject-build-vars] ✗ Placeholder "${ASSETS_PLACEHOLDER}" introuvable dans dist/sw.js`);
  process.exit(1);
}

const buildAssets = [...indexPatched.matchAll(/(?:src|href)=["'](?:\.\/|\/)(assets\/[^"']+)["']/g)]
  .map(match => `./${match[1]}`);

if (buildAssets.length === 0) {
  console.error('[inject-build-vars] ✗ Aucun asset Vite trouvé dans dist/index.html');
  process.exit(1);
}

const swPatched = swContent
  .replace(HASH_PLACEHOLDER, hash)
  .replace(ASSETS_PLACEHOLDER, JSON.stringify([...new Set(buildAssets)]));

try {
  writeFileSync(swPath, swPatched, 'utf8');
} catch (err) {
  console.error(`[inject-build-vars] ✗ Impossible d'écrire dans ${swPath}`);
  process.exit(1);
}

console.log(`[inject-build-vars] ✓ CACHE_NAME = 'kwhiz-${hash}'`);
console.log(`[inject-build-vars] ✓ Assets préchargés : ${buildAssets.length}`);
