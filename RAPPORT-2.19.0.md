# kWhiz 2.19.0 — Rapport de livraison

## Modifications réalisées

- Correction durable des logos dans la recommandation principale et la shortlist.
- Ajout d'un conteneur de logo commun généré par `renderOperatorLogo()`.
- Traitement spécifique du fichier Atlante, dont le visuel comporte une marge blanche importante.
- Suppression des règles responsive qui masquaient `.profile-shortlist-logo`.
- Stabilisation de la grille de la shortlist sur mobile et ordinateur.
- Échappement des chemins et clés injectés dans le HTML des logos.
- Suppression d'un commentaire obsolète dans `profile-view.js`.
- Correction de la faute « la offre » en « l’offre ».
- Passage de la version du projet et du verrou npm à 2.19.0.
- Mise à jour du test de cohérence de version.

## Validation

- `node --check src/ui/views/profile-view.js` : OK.
- `npm test` : 36 tests réussis, aucun échec.
- Le build Vite n'a pas pu être relancé dans l'environnement de livraison après réinstallation des dépendances, car l'installation npm n'a pas terminé dans le délai disponible. Le build initial échouait uniquement à cause du module natif Rollup correspondant à Linux absent du `node_modules` fourni depuis macOS.

## Installation

1. Décompresser l'archive.
2. Dans le dossier du projet, exécuter `npm install`.
3. Lancer `npm run dev` ou `npm run build`.

Le dossier `node_modules` n'est volontairement pas inclus dans l'archive.
