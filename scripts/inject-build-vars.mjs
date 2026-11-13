/**
 * inject-build-vars.mjs
 *
 * Post-build script — injecte les variables de build dans dist/ :
 *
 *   1. Version (dist/index.html)
 *      Remplace __VERSION__ par la valeur de "version" dans package.json.
 *      Source unique : package.json → plus jamais de numéro hardcodé dans le HTML.
 *
 *   2. Assets et cache hash SW (dist/sw.js)
 *      Injecte les ressources critiques et facultatives réellement précachées,
 *      puis calcule un SHA-256 déterministe de leurs chemins et contenus.
 *
 * Usage : node scripts/inject-build-vars.mjs
 * Appelé automatiquement via "npm run build".
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, '..');

const pkgPath   = resolve(root, 'package.json');
const indexPath = resolve(root, 'dist', 'index.html');
const swPath    = resolve(root, 'dist', 'sw.js');
const manifestPath = resolve(root, 'dist', '.vite', 'manifest.json');

const VERSION_PLACEHOLDER = '__VERSION__';
const HASH_PLACEHOLDER    = '__CACHE_HASH__';
const CRITICAL_PLACEHOLDER = '__CRITICAL_ASSETS__';
const OPTIONAL_PLACEHOLDER = '__OPTIONAL_ASSETS__';

const CRITICAL_PUBLIC_ASSETS = [
  './index.html',
  './tarifs.json'
];

const OPTIONAL_PUBLIC_ASSETS = [
  './irve-fast.json',
  './manifest.json',
  './icon.svg',
  './logos/engie-vianeo.webp',
  './logos/powerdot.webp',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png'
];

// Fichiers du build absents de index.html : modules chargés à la demande (carte), leurs
// feuilles de style et les polices. Lus dans le manifeste Vite, ils sont précachés à titre
// facultatif pour que la carte et la police restent disponibles hors ligne.
export function lazyBuildAssets(manifest, alreadyListed = []) {
  const listed = new Set(alreadyListed);
  const files = new Set();
  Object.values(manifest || {}).forEach(entry => {
    [entry.file, ...(entry.css || []), ...(entry.assets || [])]
      .filter(Boolean)
      .map(file => `./${file}`)
      .filter(file => file.startsWith('./assets/') && !listed.has(file))
      .forEach(file => files.add(file));
  });
  return [...files].sort();
}

export function computeCacheHash(entries) {
  const hash = createHash('sha256');
  [...entries]
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
    .forEach(({ path, content }) => {
      const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
      hash.update(`${path}\0${bytes.length}\0`);
      hash.update(bytes);
    });
  return hash.digest('hex').slice(0, 8);
}

function run() {

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

// ── 4. Lire dist/sw.js ───────────────────────────────────────────────────────
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

const buildAssets = [...indexPatched.matchAll(/(?:src|href)=["'](?:\.\/|\/)(assets\/[^"']+)["']/g)]
  .map(match => `./${match[1]}`);

if (buildAssets.length === 0) {
  console.error('[inject-build-vars] ✗ Aucun asset Vite trouvé dans dist/index.html');
  process.exit(1);
}

for (const placeholder of [CRITICAL_PLACEHOLDER, OPTIONAL_PLACEHOLDER]) {
  if (!swContent.includes(placeholder)) {
    console.error(`[inject-build-vars] ✗ Placeholder "${placeholder}" introuvable dans dist/sw.js`);
    process.exit(1);
  }
}

const uniqueBuildAssets = [...new Set(buildAssets)].sort();
const criticalAssets = [...CRITICAL_PUBLIC_ASSETS, ...uniqueBuildAssets];
let manifest = {};
if (existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    console.error(`[inject-build-vars] ✗ Manifeste Vite illisible : ${manifestPath}`);
    process.exit(1);
  }
} else {
  console.error(`[inject-build-vars] ✗ Manifeste Vite introuvable : ${manifestPath}`);
  console.error('  → Vérifiez que vite.config.js contient build.manifest: true');
  process.exit(1);
}
const lazyAssets = lazyBuildAssets(manifest, uniqueBuildAssets);
const optionalAssets = [...OPTIONAL_PUBLIC_ASSETS, ...lazyAssets];
const precachedAssets = [...criticalAssets, ...optionalAssets];
const hashEntries = precachedAssets.map(assetPath => {
  const filePath = resolve(root, 'dist', assetPath.replace(/^\.\//, ''));
  try {
    return { path: assetPath, content: readFileSync(filePath) };
  } catch (err) {
    console.error(`[inject-build-vars] ✗ Ressource précachée introuvable : ${filePath}`);
    process.exit(1);
  }
});
const hash = computeCacheHash(hashEntries);

const swPatched = swContent
  .replace(HASH_PLACEHOLDER, hash)
  .replace(CRITICAL_PLACEHOLDER, JSON.stringify(criticalAssets))
  .replace(OPTIONAL_PLACEHOLDER, JSON.stringify(optionalAssets));

try {
  writeFileSync(swPath, swPatched, 'utf8');
} catch (err) {
  console.error(`[inject-build-vars] ✗ Impossible d'écrire dans ${swPath}`);
  process.exit(1);
}

console.log(`[inject-build-vars] ✓ CACHE_NAME = 'kwhiz-${hash}'`);
console.log(`[inject-build-vars] ✓ Assets critiques : ${criticalAssets.length}`);
console.log(`[inject-build-vars] ✓ Assets facultatifs : ${optionalAssets.length}`);
console.log(`[inject-build-vars] ✓ Dont chargés à la demande : ${lazyAssets.length}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
