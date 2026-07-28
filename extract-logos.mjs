/**
 * extract-logos.mjs
 * Extrait tous les logos base64 du LOGOS object vers public/logos/
 * et met à jour index.html avec les chemins relatifs.
 *
 * Usage : node extract-logos.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const HTML_PATH   = './index.html';
const LOGOS_DIR   = './public/logos';
const BACKUP_PATH = './index.html.bak';

// ── 1. Lecture ────────────────────────────────────────────────────────────────
let html = readFileSync(HTML_PATH, 'utf8');
writeFileSync(BACKUP_PATH, html);           // sauvegarde de sécurité
mkdirSync(LOGOS_DIR, { recursive: true });

// ── 2. Extraction des logos dans le LOGOS object ──────────────────────────────
// Pattern : key: 'data:image/TYPE;base64,DATA'
const LOGO_RE = /(\w+):\s*'data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/=\s]+?)'/g;

let match;
let count = 0;
const replacements = [];

while ((match = LOGO_RE.exec(html)) !== null) {
    const [full, key, mime, b64raw] = match;
    const b64 = b64raw.replace(/\s/g, '');
    const ext  = mime === 'jpeg' ? 'jpg' : mime;
    const filename = `${key}.${ext}`;
    const filepath = join(LOGOS_DIR, filename);

    writeFileSync(filepath, Buffer.from(b64, 'base64'));
    const kb = (Buffer.byteLength(b64, 'base64') / 1024).toFixed(1);
    console.log(`  ✓ ${filename}  (${kb} kB)`);

    replacements.push({ full, key, replacement: `${key}: './logos/${filename}'` });
    count++;
}

console.log(`\n${count} logos extraits dans ${LOGOS_DIR}/\n`);

// ── 3. Remplacement dans le HTML ──────────────────────────────────────────────
for (const { full, replacement } of replacements) {
    html = html.replace(full, replacement);
}

// ── 4. Traiter les autres data:image dans la bottom-nav et les cartes ---------
// (icônes encodées dans des <img src="data:image/...">)
// On les laisse en base64 : elles sont dans le HTML statique, pas dans le JS,
// et Vite ne les bundle pas dans le JS — seul le LOGOS object posait problème.

writeFileSync(HTML_PATH, html, 'utf8');
console.log('index.html mis à jour.');
console.log('Sauvegarde : index.html.bak\n');
console.log('Lance maintenant : npm run build');
