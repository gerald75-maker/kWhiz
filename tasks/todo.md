# kWhiz — Refonte UI/UX (palette brief + carte gagnante + desktop)

## Audit tarifaire complet des opérateurs (2026-09-21)

- [x] Vérifier les 12 opérateurs actifs sur leurs sources officielles
- [x] Distinguer tarifs fixes, variables, promotions et valeurs non publiées
- [x] Corriger `public/tarifs.json`, les traductions et les tests pour chaque écart confirmé
- [x] Actualiser les dates uniquement pour les offres réellement vérifiées
- [x] Versionner la livraison en 2.25.11 et exécuter toute la suite de tests
- [x] Reconstruire `dist/` et vérifier le cache PWA ainsi que `assets/`

## Tarification variable Electra (2026-09-11)

- [x] Actualiser la description française des trois niveaux de prix Electra
- [x] Mettre à jour la traduction anglaise correspondante
- [x] Adapter les tests Electra sans modifier les montants faute de nouveaux prix annoncés
- [x] Exécuter les tests et reconstruire `dist/`
- [x] Vérifier que `dist/assets/` reste propre

## Livraison 2.25.8 (2026-09-11)

- [x] Passer les manifestes et le test de cohérence en 2.25.8
- [x] Relancer toute la suite de tests
- [x] Reconstruire `dist/` et vérifier la version injectée

## Précisions Atlante Go — livraison 2.25.9 (2026-09-11)

- [x] Ajouter l’absence d’engagement et les conditions de décagnottage
- [x] Ajouter le ChargeBack Powerdot à 10 % sans intégrer les partenaires au classement
- [x] Actualiser la traduction anglaise et les tests Atlante
- [x] Passer la livraison en 2.25.9
- [x] Exécuter les tests, reconstruire `dist/` et vérifier les assets

## Abonnements mensuels sans engagement — livraison 2.25.10 (2026-09-11)

- [x] Centraliser le libellé « Sans engagement » pour toutes les offres mensuelles
- [x] Couvrir Comparer, Opérateurs, le détail et la recommandation en français et en anglais
- [x] Vérifier que les offres annuelles restent inchangées
- [x] Passer la livraison en 2.25.10
- [x] Exécuter les tests et reconstruire `dist/`

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

## Périmètre hors autoroute (2026-09-28)

- [x] Repérer accueil, introduction, À propos et traductions.
- [x] Remplacer les deux titres existants et ajouter la précision dans À propos, sans changement métier ; centrage sûr de l’introduction sur petit écran.
- [x] Vérifier tests, build et rendu responsive : 347 tests réussis, build réussi, captures Chromium à 320×568, 390×844, 768×1024 et 1440×900 ; aucun débordement horizontal. Introduction accessible par défilement sur petit écran.

- [x] Complément Mon choix : titre et traduction actualisés ; 347 tests réussis, build réussi, rendu vérifié de 320 à 1440 px.

- [x] Reformulations finales appliquées : titre Mon choix, baseline et À propos harmonisés ; 347 tests réussis, build réussi, rendu contrôlé à 320, 390, 768 et 1440 px.

- [x] Taille du prix alignée sur le titre : 30,4 px à 320/390 px, 35,2 px à 768/1440 px ; captures contrôlées, build réussi.

## Powerdot direct (2026-10-08)

- [x] Vérifier les tarifs et CGU Powerdot Adhoc, la carte officielle et les offres Octopus distinctes.
- [x] Ajouter deux formules DC directes, conserver les prix AC et l'essai gratuit dans le détail ; mensualité normale pour les calculs.
- [x] Enregistrer logo WebP et couleur, traductions FR/EN et reconnaissance IRVE pour la prochaine actualisation des stations.
- [x] Vérifier les tests et le rendu puis construire dist : 350 tests réussis, build 2.25.12 réussi, annuaire et fiche Powerdot vérifiés en bureau et mobile à 390 px.

Carte : lien officiel immédiat. Le jeu IRVE existant ne contient pas Powerdot ; aucune station inventée ou modification de date de ce jeu.
Tarif sans abonnement non vérifié : seuil indisponible. Electroverse reste distinct ; Drive Pack lié au contrat d'électricité reste hors du comparateur de recharge publique autonome.

## Promotion Atlante Go (2026-10-19)

- [x] Vérifier les données Atlante et le périmètre de la promotion fournie par Gérald.
- [x] Appliquer 4,99 €/mois au lieu de 9,99 €, avec la condition de souscription avant le 31 décembre 2026, en français et en anglais.
- [x] Vérifier les calculs, les tests et le build ; relire le diff ciblé. 351 tests réussis, build réussi depuis le dossier canonique. Source officielle : prix conservé tant que l’abonnement reste actif ; ChargeBack 100 % jusqu’au 31/12/2026 intégré via la configuration existante.

Plan validé par la demande explicite de Gérald ; conserver les autres modifications en cours.

## Archive de livraison Atlante (2026-10-19)

- [x] Vérifier le dossier de livraison existant et le contenu de dist.
- [x] Créer une archive ZIP de publication sans fichiers macOS, en préservant les livraisons précédentes.
- [x] Vérifier l’intégrité et la présence des tarifs Atlante actualisés dans l’archive.

Archive : ../livraisons/2.25.13/kwhiz-2.25.13-atlante-2026-10-19-a-publier.zip ; intégrité ZIP et correspondance exacte avec dist vérifiées. Notice jointe. Ancienne livraison préservée ; aucune publication effectuée.

## Livraison 2.25.14 (2026-10-19)

- [x] Actualiser la version des manifestes et du test de cohérence.
- [x] Exécuter les tests et reconstruire dist.
- [x] Vérifier le ZIP 2.25.14 puis ranger les anciennes livraisons dans archives ; conserver un seul ZIP dans livraisons.

Validation : 351 tests réussis, build 2.25.14 et cache kwhiz-2163a04c. ZIP vérifié dans ../livraisons/2.25.14/ ; une seule archive ZIP présente dans livraisons. Anciennes livraisons déplacées vers ../archives/livraisons/2.25.13/ avec contrôle des empreintes. Aucune publication effectuée.

## Livraison 2.25.15 (2026-11-11)

- [x] Recommiter la 2.25.14 publiée (versions 2.25.12 à 2.25.14 restées hors Git) et fusionner `main` (source IRVE PAN, Vianeo Max).
- [x] Reporter la note ENGIE Vianeo Super Heures Creuses (7 novembre), saisie par erreur dans l'ancienne copie `Documents/Claude/Projects/kWhiz`.
- [x] Intégrer la base IRVE du 2026-11-11 (PR #29).
- [x] Fusion automatique de l'actualisation IRVE hebdomadaire et alerte de mise en ligne FTP par issue GitHub.
- [ ] Retirer la mention Super Heures Creuses après le 31/12/2026.
- [ ] Retour au tarif Atlante Go 9,99 € et ChargeBack 50 % après le 31/12/2026.

## Livraison 2.26.0 (2026-11-11)

- [x] Top 10 de l'audit UX : prix payé à la borne et après ChargeBack, part de recharge rapide dès l'accueil, seuil incalculable distingué, actions sur l'offre n°1, prix et tri par coût sur la carte, noms de stations lisibles, doublons IRVE fusionnés, aires d'autoroute masquées par défaut, couverture locale des réseaux, bandeau de consommation en pastille, choix du modèle de véhicule.
- [x] Version 2.26.0 dans les manifestes et le test de cohérence.
- [x] 384 tests réussis, build 2.26.0, cache kwhiz-74942e0b.
- [ ] Revérifier fiche par fiche les capacités utiles des véhicules avant de calculer un coût de session.

## Livraison 2.26.1 (2026-11-11)

- [x] Aide mise à jour (FR/EN) : pastille Consommation et choix du modèle, source EV Database, zone de recharge, « Jamais rentable » et « Seuil non calculé », ChargeBack, prix et tri sur la carte, aires d'autoroute.
- [x] 384 tests réussis, build 2.26.1, cache kwhiz-2a5d2beb.

## Livraison 2.26.2 (2026-11-11)

- [x] Audit n° 12 : filtres « Sans abonnement » et « Réseaux près de chez moi » dans Comparer. Le filtre « Paiement CB » attend des données de paiement structurées (n° 17).
- [x] Audit n° 16 : champ « Autour de… » sur la carte ; sans localisation, la carte se place sur la zone de recharge.
- [x] Audit n° 19 : retour en haut de page à chaque changement d'onglet.
- [x] Audit n° 21 : compteur « X sur N stations dans la zone affichée », balises Open Graph.
- [x] Aide FR/EN complétée (filtres, champ « Autour de… »).
- [x] 390 tests réussis, build 2.26.2, cache kwhiz-b548274a.

## Livraison 2.26.3 (2026-11-11)

- [x] Débordement à droite sur iPhone après saisie d'une ville : le champ « Ma zone de recharge » imposait sa largeur naturelle à la colonne de Mon choix (+19 px sur mobile), et iOS zoomait sur les champs de moins de 16 px. Champs à 16 px sur écran tactile ; largeurs minimales neutralisées (zone, modèle, « Autour de… »).
- [x] Contrôle sans débordement à 375 et 390 px sur les quatre onglets ; 391 tests réussis ; cache kwhiz-18d37a7d.

## Livraison 2.27.0 (2026-11-11)

- [x] Audit n° 8 : coût sur 12 mois calculé mois par mois avec le taux ChargeBack en vigueur (Atlante Go à 1 000 km : 487 € au lieu de 373 €), note de fin de promotion, écart annuel inversé signalé.
- [x] Audit n° 20 : « dès X €/kWh » sous chaque réseau, un seul chevron, bouton Carte vers la carte kWhiz (Lidl compris), lien ↗ pour Powerdot et Electroverse.
- [x] Audit n° 10 : Comparer devient « Toutes les offres » ; bouton « Toutes les offres, avec filtres et détails » sous le classement de Mon choix.
- [x] Audit n° 18 : écart chiffré sur l'accueil (79 €/mois au 11/11 pour 1 000 km à 18 kWh/100 km).
- [x] « Ma position » (Mon choix) : état d'attente sur le bouton, messages distincts pour refus et délai dépassé.
- [x] Aide complétée ; 398 tests ; contrôle sans débordement à 390 px ; cache kwhiz-711ccc2c.

## Livraison 2.28.0 (2026-11-11) : refonte, étape 1

- [x] Maquettes validées par Gérald (canevas « kWhiz — maquettes de la refonte »).
- [x] Ligne de résumé du profil en haut de l'écran ; panneau Mon profil (voiture, consommation, kilométrage, part rapide, ville).
- [x] Mon offre : offre n°1 (prix, stations proches, Souscrire, Bornes), deux suivantes, lien vers toutes les offres ; classement parmi les réseaux présents près de la ville.
- [x] Panneau « Pourquoi ce choix ? » : coût sur 12 mois, promotion, prix à la borne et après ChargeBack, écart, seuil, source, partage.
- [x] Premier lancement : présentation, puis voiture, kilomètres, lieu de recharge, ville.
- [x] Clés i18n devenues inutiles supprimées ; aide mise à jour ; 393 tests ; aucun débordement à 390 px ; cache kwhiz-56007331.
- [x] Étape 2 : Carte plein écran (livrée en 2.29.0).
- [ ] Étape 3 : onglet Offres (fusion Comparer et Opérateurs), navigation à trois onglets, menu dans l'en-tête.

## Livraison 2.29.0 (2026-11-11) : refonte, étape 2

- [x] Carte en plein écran : recherche « Autour de… », boutons Réseaux et Trajet, bouton de localisation rond.
- [x] Réseaux (filtres, aires d'autoroute, source IRVE) et Stations sur mon trajet dans des panneaux ; le panneau Trajet se ferme quand le tracé s'affiche.
- [x] Liste des stations dans un panneau repliable en bas de la carte.
- [x] Audit n° 15 : regroupement des stations proches (cellules de 72 px jusqu'au zoom 13), prix sous chaque logo (jamais sur autoroute).
- [x] Aide complétée ; 394 tests ; parcours testé en émulation iPhone sans débordement ni défilement de page ; cache kwhiz-f9d16e80.
