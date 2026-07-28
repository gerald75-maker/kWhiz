# kWhiz — Refonte UI/UX (palette brief + carte gagnante + desktop)

## Polissage ergonomique mobile et tablette (2026-07-28)

- [x] Auditer les vues de 320 à 430 px et les largeurs tablette
- [x] Vérifier espacements, marges, hauteurs, alignements et débordements
- [x] Vérifier les zones tactiles, contrastes, focus et scrolls internes
- [x] Vérifier la fermeture du menu au second clic (correctif déjà présent dans la source et le bundle)
- [x] Réduire les animations sans bénéfice UX et respecter `prefers-reduced-motion`
- [ ] Contrôler visuellement les vues corrigées sur mobile et tablette — navigateur intégré indisponible dans cette session
- [x] Exécuter `npm test`, `npm run build` et examiner le diff final

## Relecture éditoriale et FAQ (2026-07-28)

- [x] Auditer tous les textes visibles et fixer les conventions de vocabulaire et de typographie
- [x] Corriger les textes statiques de l’interface et les libellés d’accessibilité
- [x] Harmoniser les textes générés par JavaScript et les notes tarifaires affichées
- [x] Enrichir la page Aide avec une FAQ complète sans modifier les composants existants
- [x] Vérifier l’absence de changement de logique métier ou de design
- [x] Exécuter les tests et `npm run build`
- [x] Examiner le diff final et documenter les enseignements

## Statut : terminé (v2.1.0)

## Normalisation neutres vers design system canonique partagé (2026-06-22, suite)

- [x] Fond principal `--bg-main-solid`/`--bg-main` : `#071426` → `#0F172A` (styles.css, 4 endroits) + `background_color` dans `public/manifest.json`
- [x] Cartes `--bg-card`/`--border-subtle` : déjà `#1e293b` dans le code shippé (conforme canonique, aucun changement nécessaire — le brief mentionnait `#13263D` mais ce n'était plus la valeur réelle en place)
- [x] Texte secondaire `--text-secondary`/`--text-muted` : déjà `#94a3b8` dans le code shippé (conforme canonique, aucun changement nécessaire — le brief mentionnait `#A8B3C7` mais ce n'était plus la valeur réelle en place)
- [x] Accent cyan `#00C2FF` : non touché (identité kWhiz validée, conforme aux instructions)
- [x] Carte gagnante : pas de couleur `#18364F` dans le code réel (`.profile-best-card` utilise `var(--bg-card)` + halo vert succès `rgba(22,199,132,...)`) — rien à migrer, le `#18364F` du brief n'existait que dans les previews HTML jamais committées comme code
- [x] Vérif grep exhaustive anti-piège préfixe alpha (#071426XX, #13263DXX, #A8B3C7XX) : aucune collision trouvée
- [x] Contraste AA recalculé (voir rapport) : tout passe largement AA normal (≥4.5:1), y compris le pire cas texte secondaire/carte à 5.71:1
- [x] `tasks/lessons.md` mis à jour (2 nouvelles leçons : divergence brief/code réel + limite du build sandbox Linux)
- [ ] `npm run build` n'a pas pu être validé dans le sandbox Cowork (binaire natif Rollup Linux absent, voir lesson) — à relancer sur la machine de Gérald (macOS) pour confirmer le build de prod avant déploiement
- [ ] Fichiers `preview/kwhiz-preview-redesign.html` et `preview/kwhiz-preview-redesign-v2.html` contiennent encore les anciennes valeurs (#071426/#13263D/#A8B3C7/#18364F) — laissés intacts (maquettes historiques, pas du code de prod) ; à nettoyer ou supprimer si Gérald les juge obsolètes

- [x] Audit code actuel vs brief
- [x] Preview HTML avant/après + vérif des chiffres
- [x] Backups horodatés (app.js / index.html / styles.css / package.json) avant édition
- [x] Bump version package.json 2.0.6 → 2.1.0
- [x] Palette brief appliquée (#071426 / #00C2FF / #16C784) dans styles.css, index.html (SVG + theme-color), public/manifest.json
- [x] Carte gagnante redesignée (`renderProfileHero()` + `.phm-*` CSS) selon preview v2
- [x] Logos opérateurs + couleurs de rang (best/mid/high) dans tableau classement et tableau profil
- [x] Transition `.is-jumping` sur le slider lors des clics véhicule (drag live non touché)
- [x] Layout desktop ≥1024px : `.container` élargi à 1100px, slider+véhicules côte à côte, grilles 2 colonnes pour les opérateurs, grid hero+carte gagnante+tableau pour Mon profil — système d'onglets inchangé (zéro JS modifié)
- [x] Vérifications finales : `node --check app.js` OK, accolades CSS équilibrées (374/374), aucune ancienne couleur résiduelle

## Décisions prises sans solliciter à nouveau l'utilisateur (déléguées via "fais ce qui te semble le mieux")

1. **Layout desktop** : la maquette preview montrait le classement sous forme de cartes (`desktop-cards-grid`) à droite, en permanence visible. Implémenter ça fidèlement aurait demandé un second moteur de rendu (cartes) pour le classement, en plus du `<table>` existant — exactement ce qui avait été jugé disproportionné lors de la tâche #8 (logos/couleurs de rang sur le tableau existant plutôt que de le transformer en cartes). Par cohérence, j'ai gardé le système d'onglets existant et simplement mieux utilisé l'espace disponible à l'intérieur de chaque onglet (CSS uniquement, aucun risque sur la logique JS de navigation).
2. **Vert ChargeBack / Atlante (#10b981)** : laissé tel quel, non aligné sur #16C784. Risque de collision avec la couleur de marque Atlante (`.atlante { color: #10b981 }`), et les deux verts ont des rôles différents (info fidélité vs succès/économie) — les garder visuellement distincts aide à la lecture.

## Reste à faire (pas demandé, mais à garder en tête)

- Tester réellement le rendu desktop dans un navigateur (aucune vérification visuelle n'a été possible dans cette session, seulement du raisonnement CSS) — à valider par Gérald avant de considérer ce point définitivement clos.
- Si Gérald veut un jour le vrai layout "cartes côte à côte" de la preview, il faudra construire une fonction de rendu en cartes pour le classement desktop (changement plus large, JS + CSS).
