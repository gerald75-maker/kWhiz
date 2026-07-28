/**
 * Prépare une livraison avec séparation explicite entre le document root
 * public et les fichiers PHP internes.
 *
 * Usage : npm run release
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const distDir = resolve(root, 'dist');
const helperPath = resolve(root, 'php', 'telemetry-storage.php');
const releaseDir = resolve(root, 'release');
const releaseDocumentRoot = resolve(releaseDir, 'document-root');
const releasePhpDir = resolve(releaseDir, 'php');
const releaseHelperPath = resolve(releasePhpDir, 'telemetry-storage.php');

if (!existsSync(resolve(distDir, 'index.html'))) {
  throw new Error('Build de production absent : dist/index.html est introuvable.');
}

if (!existsSync(helperPath)) {
  throw new Error('Helper privé absent : php/telemetry-storage.php est introuvable.');
}

rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(releaseDocumentRoot, { recursive: true });
mkdirSync(releasePhpDir, { recursive: true });

cpSync(distDir, releaseDocumentRoot, { recursive: true });
cpSync(helperPath, releaseHelperPath);

const exposedHelper = resolve(releaseDocumentRoot, 'telemetry-storage.php');
if (existsSync(exposedHelper)) {
  throw new Error('Livraison refusée : telemetry-storage.php ne doit pas se trouver dans document-root/.');
}

for (const endpoint of ['ping.php', 'stats.php']) {
  const endpointPath = resolve(releaseDocumentRoot, endpoint);
  if (!existsSync(endpointPath)) {
    throw new Error(`Livraison incomplète : document-root/${endpoint} est introuvable.`);
  }
  const source = readFileSync(endpointPath, 'utf8');
  if (!source.includes("dirname(__DIR__) . '/php/telemetry-storage.php'")) {
    throw new Error(`Chemin du helper inattendu dans document-root/${endpoint}.`);
  }
}

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const instructions = `LIVRAISON kWhiz ${pkg.version}
========================

Ce paquet contient deux répertoires qui NE DOIVENT PAS être copiés au même
emplacement.

1. document-root/
-----------------
Copier LE CONTENU de document-root/ dans le document root du site kWhiz.

Exemple :
  release/document-root/*  ->  /home/COMPTE/kwhiz.aubard.net/

Veiller à transférer aussi les fichiers cachés, notamment .htaccess.

2. php/
-------
Copier le répertoire php/ à côté du document root, dans son répertoire parent.
Le helper doit donc être accessible au chemin suivant :

  <parent-du-document-root>/php/telemetry-storage.php

Exemple :
  release/php/telemetry-storage.php  ->  /home/COMPTE/php/telemetry-storage.php

NE PAS copier php/ dans le document root.

Structure attendue sur le serveur :

  /home/COMPTE/
  ├── php/
  │   └── telemetry-storage.php
  ├── var/
  │   └── telemetry/            (créé automatiquement si les droits le permettent)
  └── kwhiz.aubard.net/         (document root)
      ├── .htaccess
      ├── index.html
      ├── ping.php
      ├── stats.php
      └── ...

ORDRE DE DÉPLOIEMENT
--------------------
1. Copier d’abord php/telemetry-storage.php hors du document root.
2. Copier ensuite le contenu de document-root/ dans le document root.

PERMISSIONS
-----------
- PHP doit pouvoir lire <parent-du-document-root>/php/telemetry-storage.php.
- PHP doit pouvoir créer et écrire <parent-du-document-root>/var/telemetry/.
- À défaut, définir KWHIZ_TELEMETRY_DIR vers un chemin absolu, persistant,
  accessible en écriture et situé hors du document root.

L’ancien visits.log éventuellement présent dans le document root sera migré
automatiquement lors du premier accès. La règle .htaccess continue d’en
interdire l’accès HTTP direct pendant cette transition.
`;

writeFileSync(resolve(releaseDir, 'README_DEPLOY.txt'), instructions, 'utf8');

console.log(`[prepare-release] ✓ Livraison ${pkg.version} générée dans release/`);
console.log('[prepare-release] ✓ document-root/ et php/ sont séparés');
console.log('[prepare-release] ✓ README_DEPLOY.txt généré');
