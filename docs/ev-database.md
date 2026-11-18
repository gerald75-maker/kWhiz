# EV Database : conditions de l’accord et fiches des modèles

Accord d’EV Database du 18/11/2026, sous cinq conditions :

1. Relevé et mise à jour strictement manuels : aucune collecte automatique, sous aucune forme (script, curl, robot, outil d'IA).
2. Source citée, avec un lien visible partout où la donnée sert.
3. Lien visible vers la fiche du véhicule dès qu’on utilise la donnée d’un véhicule précis.
4. Aucune image provenant de leurs serveurs.
5. Donnée publiée dans son état d’origine.

## Règle : relevé manuel uniquement

Les valeurs (Wh/km, kWh utiles) sont relevées à la main sur chaque fiche et saisies dans `src/config/vehicles.js`. Aucun script, aucune tâche planifiée et aucun workflow ne doit interroger ev-database.org. `tests/vehicles.test.js` le contrôle.

## Modèles (34)

| Modèle | Wh/km | kWh utiles | Fiche |
|---|---|---|---|
| BMW iX1 eDrive20 | 163 | 64,7 | [Fiche](https://ev-database.org/car/3458/BMW-iX1-eDrive20) |
| BYD Atto 3 Evo | 185 | 74,8 | [Fiche](https://ev-database.org/car/3474/BYD-ATTO-3-Evo-RWD-Design) |
| BYD Dolphin Surf 43 kWh | 163 | 43,2 | [Fiche](https://ev-database.org/car/3195/BYD-DOLPHIN-SURF-432-kWh-Comfort) |
| Citroën ë-C3 44 kWh | 172 | 43,8 | [Fiche](https://ev-database.org/car/2039/Citroen-e-C3-Standard-Range-44-kWh) |
| Citroën ë-C4 54 kWh | 156 | 50,8 | [Fiche](https://ev-database.org/car/3048/Citroen-e-C4-54-kWh) |
| Dacia Spring 100 | 145 | 24 | [Fiche](https://ev-database.org/car/3409/Dacia-Spring-Electric-100) |
| Fiat 500e 42 kWh | 159 | 37,3 | [Fiche](https://ev-database.org/car/1285/Fiat-500e-Hatchback-42-kWh) |
| Hyundai Ioniq 5 73 kWh propulsion (2021) | 189 | 70 | [Fiche](https://ev-database.org/car/1478/Hyundai-IONIQ-5-Long-Range-2WD) |
| Hyundai Ioniq 5 84 kWh propulsion | 178 | 80 | [Fiche](https://ev-database.org/car/2236/Hyundai-IONIQ-5-84-kWh-RWD) |
| Hyundai Kona Electric 65 kWh | 168 | 65,4 | [Fiche](https://ev-database.org/car/1830/Hyundai-Kona-Electric-65-kWh) |
| Kia EV2 42 kWh | 161 | 41 | [Fiche](https://ev-database.org/car/3490/Kia-EV2-422-kWh) |
| Kia EV3 Long Range | 171 | 78 | [Fiche](https://ev-database.org/car/3638/Kia-EV3-Long-Range) |
| Kia EV6 Long Range 2WD | 176 | 80 | [Fiche](https://ev-database.org/car/3028/Kia-EV6-Long-Range-2WD) |
| MG MG4 Long Range | 171 | 61,7 | [Fiche](https://ev-database.org/car/3467/MG-MG4-Premium-Long-Range) |
| Mini Cooper E | 146 | 36,6 | [Fiche](https://ev-database.org/car/1997/Mini-Cooper-E) |
| Peugeot e-208 54 kWh | 152 | 50,8 | [Fiche](https://ev-database.org/car/3223/Peugeot-e-208-54-kWh) |
| Peugeot e-2008 54 kWh | 169 | 50,8 | [Fiche](https://ev-database.org/car/1947/Peugeot-e-2008-54-kWh) |
| Peugeot e-3008 73 kWh | 192 | 73 | [Fiche](https://ev-database.org/car/2003/Peugeot-e-3008-73-kWh) |
| Peugeot e-5008 73 kWh | 197 | 73 | [Fiche](https://ev-database.org/car/2149/Peugeot-e-5008-73-kWh) |
| Renault 4 E-Tech 52 kWh | 163 | 52 | [Fiche](https://ev-database.org/car/3854/Renault-4-E-Tech-52kWh-150hp) |
| Renault 5 E-Tech 40 kWh | 148 | 40 | [Fiche](https://ev-database.org/car/3709/Renault-5-E-Tech-40kWh-120hp) |
| Renault 5 E-Tech 52 kWh | 151 | 52 | [Fiche](https://ev-database.org/car/3710/Renault-5-E-Tech-52kWh-150hp) |
| Renault Mégane E-Tech EV60 | 158 | 60 | [Fiche](https://ev-database.org/car/3132/Renault-Megane-E-Tech-EV60-220hp) |
| Renault Scénic E-Tech EV87 | 181 | 87 | [Fiche](https://ev-database.org/car/3219/Renault-Scenic-E-Tech-EV87-220hp) |
| Renault Twingo E-Tech | 149 | 27,5 | [Fiche](https://ev-database.org/car/3392/Renault-Twingo-E-Tech-275-kWh) |
| Škoda Elroq 60 | 168 | 58 | [Fiche](https://ev-database.org/car/3565/Skoda-Elroq-60) |
| Škoda Elroq 85 | 171 | 77 | [Fiche](https://ev-database.org/car/3566/Skoda-Elroq-85) |
| Škoda Enyaq 85 | 167 | 77 | [Fiche](https://ev-database.org/car/3570/Skoda-Enyaq-85) |
| Tesla Model 3 Propulsion | 133 | 60 | [Fiche](https://ev-database.org/car/3740/Tesla-Model-3-RWD) |
| Tesla Model Y Propulsion | 158 | 60 | [Fiche](https://ev-database.org/car/3741/Tesla-Model-Y-RWD) |
| Tesla Model Y Grande Autonomie Propulsion | 159 | 74 | [Fiche](https://ev-database.org/car/3595/Tesla-Model-Y-Premium-RWD) |
| Toyota bZ4X 73 kWh traction | 179 | 69 | [Fiche](https://ev-database.org/car/3134/Toyota-bZ4X-FWD-731-kWh) |
| Volkswagen ID.3 58 kWh | 159 | 58 | [Fiche](https://ev-database.org/car/3521/Volkswagen-ID3-Neo-140-kW---58-kWh) |
| Volkswagen ID.4 Pro 77 kWh | 171 | 77 | [Fiche](https://ev-database.org/car/3875/Volkswagen-ID4-Pro-77-kWh) |

Un modèle n'entre dans la liste que si l'adresse de sa fiche est connue. La Volvo EX30 Extended Range (178 Wh/km, 65 kWh utiles relevés le 11/11/2026) a été retirée le 18/11/2026 : elle reviendra quand Gérald aura noté l'adresse de sa fiche.

À valider à la main en priorité : Renault 4 E-Tech 52 kWh et Tesla Model 3 Propulsion, pour lesquelles deux fiches existaient lors du relevé.
