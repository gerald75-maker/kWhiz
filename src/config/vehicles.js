// Modèles de véhicules proposés dans le réglage de consommation.
// whKm : consommation réelle moyenne estimée par EV Database (énergie prise
// dans la batterie, hors pertes de recharge). usableKwh : capacité utile.
// Valeurs relevées le 11/11/2026 ; à revérifier lors des mises à jour.
// Accord d'EV Database du 18/11/2026 : relevé et mise à jour strictement
// manuels (aucune collecte automatique), valeurs publiées sans modification,
// source citée avec un lien vers la fiche du véhicule là où la donnée sert.
// evdbPath : chemin de la fiche sur EV Database, relevé à la main. Un modèle
// sans fiche connue n'entre pas dans la liste.
export const VEHICLE_SOURCE = Object.freeze({
    name: 'EV Database',
    url: 'https://ev-database.org/',
    asOf: '2026-11-11'
});

const list = [
    ['bmw-ix1-edrive20', 'BMW', 'iX1 eDrive20', 163, 64.7, '3458/BMW-iX1-eDrive20'],
    ['byd-atto3-evo', 'BYD', 'Atto 3 Evo', 185, 74.8, '3474/BYD-ATTO-3-Evo-RWD-Design'],
    ['byd-dolphin-surf-43', 'BYD', 'Dolphin Surf 43 kWh', 163, 43.2, '3195/BYD-DOLPHIN-SURF-432-kWh-Comfort'],
    ['citroen-ec3-44', 'Citroën', 'ë-C3 44 kWh', 172, 43.8, '2039/Citroen-e-C3-Standard-Range-44-kWh'],
    ['citroen-ec4-54', 'Citroën', 'ë-C4 54 kWh', 156, 50.8, '3048/Citroen-e-C4-54-kWh'],
    ['dacia-spring-100', 'Dacia', 'Spring 100', 145, 24, '3409/Dacia-Spring-Electric-100'],
    ['fiat-500e-42', 'Fiat', '500e 42 kWh', 159, 37.3, '1285/Fiat-500e-Hatchback-42-kWh'],
    ['hyundai-ioniq5-73-2021', 'Hyundai', 'Ioniq 5 73 kWh propulsion (2021)', 189, 70, '1478/Hyundai-IONIQ-5-Long-Range-2WD'],
    ['hyundai-ioniq5-84-rwd', 'Hyundai', 'Ioniq 5 84 kWh propulsion', 178, 80, '2236/Hyundai-IONIQ-5-84-kWh-RWD'],
    ['hyundai-kona-65', 'Hyundai', 'Kona Electric 65 kWh', 168, 65.4, '1830/Hyundai-Kona-Electric-65-kWh'],
    ['kia-ev2-42', 'Kia', 'EV2 42 kWh', 161, 41, '3490/Kia-EV2-422-kWh'],
    ['kia-ev3-lr', 'Kia', 'EV3 Long Range', 171, 78, '3638/Kia-EV3-Long-Range'],
    ['kia-ev6-lr-2wd', 'Kia', 'EV6 Long Range 2WD', 176, 80, '3028/Kia-EV6-Long-Range-2WD'],
    ['mg-mg4-lr', 'MG', 'MG4 Long Range', 171, 61.7, '3467/MG-MG4-Premium-Long-Range'],
    ['mini-cooper-e', 'Mini', 'Cooper E', 146, 36.6, '1997/Mini-Cooper-E'],
    ['peugeot-e208-54', 'Peugeot', 'e-208 54 kWh', 152, 50.8, '3223/Peugeot-e-208-54-kWh'],
    ['peugeot-e2008-54', 'Peugeot', 'e-2008 54 kWh', 169, 50.8, '1947/Peugeot-e-2008-54-kWh'],
    ['peugeot-e3008-73', 'Peugeot', 'e-3008 73 kWh', 192, 73, '2003/Peugeot-e-3008-73-kWh'],
    ['peugeot-e5008-73', 'Peugeot', 'e-5008 73 kWh', 197, 73, '2149/Peugeot-e-5008-73-kWh'],
    ['renault-4-52', 'Renault', '4 E-Tech 52 kWh', 163, 52, '3854/Renault-4-E-Tech-52kWh-150hp'],
    ['renault-5-40', 'Renault', '5 E-Tech 40 kWh', 148, 40, '3709/Renault-5-E-Tech-40kWh-120hp'],
    ['renault-5-52', 'Renault', '5 E-Tech 52 kWh', 151, 52, '3710/Renault-5-E-Tech-52kWh-150hp'],
    ['renault-megane-ev60', 'Renault', 'Mégane E-Tech EV60', 158, 60, '3132/Renault-Megane-E-Tech-EV60-220hp'],
    ['renault-scenic-ev87', 'Renault', 'Scénic E-Tech EV87', 181, 87, '3219/Renault-Scenic-E-Tech-EV87-220hp'],
    ['renault-twingo', 'Renault', 'Twingo E-Tech', 149, 27.5, '3392/Renault-Twingo-E-Tech-275-kWh'],
    ['skoda-elroq-60', 'Škoda', 'Elroq 60', 168, 58, '3565/Skoda-Elroq-60'],
    ['skoda-elroq-85', 'Škoda', 'Elroq 85', 171, 77, '3566/Skoda-Elroq-85'],
    ['skoda-enyaq-85', 'Škoda', 'Enyaq 85', 167, 77, '3570/Skoda-Enyaq-85'],
    ['tesla-model3-rwd', 'Tesla', 'Model 3 Propulsion', 133, 60, '3740/Tesla-Model-3-RWD'],
    ['tesla-modely-rwd', 'Tesla', 'Model Y Propulsion', 158, 60, '3741/Tesla-Model-Y-RWD'],
    ['tesla-modely-lr-rwd', 'Tesla', 'Model Y Grande Autonomie Propulsion', 159, 74, '3595/Tesla-Model-Y-Premium-RWD'],
    ['toyota-bz4x-73', 'Toyota', 'bZ4X 73 kWh traction', 179, 69, '3134/Toyota-bZ4X-FWD-731-kWh'],
    ['volvo-ex30-lr', 'Volvo', 'EX30 P5 Long Range', 178, 65, '3480/Volvo-EX30-P5-Long-Range'],
    ['vw-id3-58', 'Volkswagen', 'ID.3 58 kWh', 159, 58, '3521/Volkswagen-ID3-Neo-140-kW---58-kWh'],
    ['vw-id4-77', 'Volkswagen', 'ID.4 Pro 77 kWh', 171, 77, '3875/Volkswagen-ID4-Pro-77-kWh']
];

export const VEHICLES = Object.freeze(list.map(([id, brand, model, whKm, usableKwh, evdbPath]) =>
    Object.freeze({
        id, brand, model, whKm, usableKwh, evdbPath,
        sourceUrl: evdbPath ? `https://ev-database.org/car/${evdbPath}` : null
    })));

export function findVehicle(id) {
    return VEHICLES.find(vehicle => vehicle.id === id) || null;
}

// Le curseur avance au kWh/100 km entier, entre 10 et 30.
export function vehicleSliderValue(vehicle) {
    return Math.min(30, Math.max(10, Math.round(vehicle.whKm / 10)));
}

export function vehicleSourceUrl(vehicle) {
    return vehicle?.sourceUrl || null;
}

export function vehicleLabel(vehicle) {
    return `${vehicle.brand} ${vehicle.model}`;
}
