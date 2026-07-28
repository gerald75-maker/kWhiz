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

## Checklist de recette de release

### Mon choix

- [ ] Modifier la consommation du véhicule avec le curseur et les profils Citadine, Berline, SUV et Van.
- [ ] Modifier le kilométrage mensuel.
- [ ] Modifier la part de recharge rapide.
- [ ] Vérifier la mise à jour de la recommandation, du classement et des coûts.
- [ ] Tester le partage du résultat.

La capacité de batterie et la puissance maximale de recharge ne sont pas des paramètres du profil kWhiz 2.19 et ne font pas partie de cette recette.

### Opérateurs

- [ ] Vérifier plusieurs opérateurs dans les vues compacte et détaillée.
- [ ] Contrôler les tarifs, conditions, liens et aides disponibles.
- [ ] Ouvrir et fermer la popup ChargeBack.

### Comparer

- [ ] Tester les tris par coût aux 100 km, prix du kWh, opérateur et seuil.
- [ ] Vérifier les ordres croissant et décroissant.
- [ ] Ouvrir et fermer plusieurs détails de formule sans perte de sélection.

### Menu et persistance

- [ ] Ouvrir puis fermer À propos, Aide / FAQ et Informations tarifaires.
- [ ] Recharger la page et vérifier la persistance des données prévues, notamment la part de recharge rapide.

### Responsive, console et validation technique

- [ ] Rejouer les scénarios principaux à 320, 390, 768 et 1440 px.
- [ ] Vérifier l'absence d'erreur console, de nouveau warning et de requête applicative en échec.
- [ ] Exécuter `npm test`.
- [ ] Exécuter `npm run build`.
- [ ] Exécuter `git diff --check`.

## Installation

1. Décompresser l'archive.
2. Dans le dossier du projet, exécuter `npm install`.
3. Lancer `npm run dev` ou `npm run build`.

Le dossier `node_modules` n'est volontairement pas inclus dans l'archive.
