# Audit IRVE ENGIE Vianeo — 11 août 2026

Source : consolidation nationale IRVE v2.3.1 du 11 août 2026 (233 875 lignes), téléchargée depuis data.gouv.fr. La carte ENGIE Vianeo n'a pas été scrapée.

## Appellations auditées

La recherche porte sur des mots entiers, après suppression des accents et passage en minuscules, dans `nom_station`, `nom_enseigne`, `nom_operateur` et `nom_amenageur`.

| Appellation | Stations brutes uniques | Points bruts uniques | Décision |
| --- | ---: | ---: | --- |
| ENGIE Vianeo | 624 | 4 157 | Retenir après filtres DC rapide et France |
| Vianeo | 624 | 4 157 | Même ensemble ; retenir après filtres |
| ENGIE Solutions | 0 | 0 | Aucun résultat |
| ENGIE | 627 | 4 169 | Ne pas retenir génériquement |
| CERTAS Energy | 0 | 0 | Aucun résultat |
| ESSO | 2 | 10 | Ne pas retenir |

Les totaux bruts incluent des doublons de producteurs dans la consolidation. Après la règle Vianeo, la zone France métropolitaine et le seuil existant de 100 kW, la sortie contient **181 stations**, **1 403 associations de points aux stations** et **1 347 identifiants de point uniques**. Les points uniquement AC et toutes les puissances inférieures à 100 kW sont exclus.

## Échantillon contrôlé

| Station | Enseigne | Opérateur brut | Puissance max | Coordonnées |
| --- | --- | --- | ---: | --- |
| Urban Garden 2 | ENGIE Vianeo | ENGIE Vianeo | 300 kW | 45.726572, 4.818809 |
| Eurotunnel Calais | ENGIE Vianeo | Greenflux / ENGIE Vianeo selon le producteur | 210 kW | 50.934884, 1.813087 |
| A6 Les Chères Ouest | ENGIE Vianeo | ENGIE Vianeo | 300 kW | 45.902756, 4.728580 |
| A20 Nauze Vert | ENGIE Vianeo | Greenflux | 300 kW | 43.957677, 1.326500 |
| A43 Le Guiers | ENGIE Vianeo | Greenflux | 300 kW | 45.578152, 5.633879 |
| A49 Porte de la Drôme | ENGIE Vianeo | Greenflux | 300 kW | 45.075703, 5.211201 |

Contre-échantillons exclus : `ENGIE PACA - Résidence de La Cadenelle` (Greenspot, 22,08 kW), `Engie Nouvelle-Calédonie` (Freshmile, hors zone), `Esso Arnage` (C4Energies) et `Esso - Saint-Geours-de-Maremne` (Power Dot). Une recherche naïve de sous-chaîne dans le JSON dérivé trouvait aussi `Bessoncourt`, `Essouvert` et `Cesson` : ce sont des faux positifs lexicaux.

## Règle de correspondance

Le générateur attribue `engie-vianeo` uniquement si le jeton complet `Vianeo` ou la séquence complète `ENGIE Vianeo` figure dans l'un des quatre champs d'identité. `ENGIE`, `ENGIE Solutions`, `ESSO` et `CERTAS Energy` seuls ne suffisent jamais. Les filtres communs exigent ensuite une puissance nominale d'au moins 100 kW, des coordonnées valides dans le périmètre France et l'appartenance au périmètre `irve-fast`.
