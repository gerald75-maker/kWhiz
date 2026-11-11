// Modèles de véhicules proposés dans le réglage de consommation.
// whKm : consommation réelle moyenne estimée par EV Database (énergie prise
// dans la batterie, hors pertes de recharge). usableKwh : capacité utile.
// Valeurs relevées le 11/11/2026 ; à revérifier lors des mises à jour.
export const VEHICLE_SOURCE = Object.freeze({
    name: 'EV Database',
    url: 'https://ev-database.org/',
    asOf: '2026-11-11'
});

const list = [
    ['bmw-ix1-edrive20', 'BMW', 'iX1 eDrive20', 163, 64.7],
    ['byd-atto3-evo', 'BYD', 'Atto 3 Evo', 185, 74.8],
    ['byd-dolphin-surf-43', 'BYD', 'Dolphin Surf 43 kWh', 163, 43.2],
    ['citroen-ec3-44', 'Citroën', 'ë-C3 44 kWh', 172, 43.8],
    ['citroen-ec4-54', 'Citroën', 'ë-C4 54 kWh', 156, 50.8],
    ['dacia-spring-100', 'Dacia', 'Spring 100', 145, 24],
    ['fiat-500e-42', 'Fiat', '500e 42 kWh', 159, 37.3],
    ['hyundai-ioniq5-73-2021', 'Hyundai', 'Ioniq 5 73 kWh propulsion (2021)', 189, 70],
    ['hyundai-ioniq5-84-rwd', 'Hyundai', 'Ioniq 5 84 kWh propulsion', 178, 80],
    ['hyundai-kona-65', 'Hyundai', 'Kona Electric 65 kWh', 168, 65.4],
    ['kia-ev2-42', 'Kia', 'EV2 42 kWh', 161, 41],
    ['kia-ev3-lr', 'Kia', 'EV3 Long Range', 171, 78],
    ['kia-ev6-lr-2wd', 'Kia', 'EV6 Long Range 2WD', 176, 80],
    ['mg-mg4-lr', 'MG', 'MG4 Long Range', 171, 61.7],
    ['mini-cooper-e', 'Mini', 'Cooper E', 146, 36.6],
    ['peugeot-e208-54', 'Peugeot', 'e-208 54 kWh', 152, 50.8],
    ['peugeot-e2008-54', 'Peugeot', 'e-2008 54 kWh', 169, 50.8],
    ['peugeot-e3008-73', 'Peugeot', 'e-3008 73 kWh', 192, 73],
    ['peugeot-e5008-73', 'Peugeot', 'e-5008 73 kWh', 197, 73],
    ['renault-4-52', 'Renault', '4 E-Tech 52 kWh', 163, 52],
    ['renault-5-40', 'Renault', '5 E-Tech 40 kWh', 148, 40],
    ['renault-5-52', 'Renault', '5 E-Tech 52 kWh', 151, 52],
    ['renault-megane-ev60', 'Renault', 'Mégane E-Tech EV60', 158, 60],
    ['renault-scenic-ev87', 'Renault', 'Scénic E-Tech EV87', 181, 87],
    ['renault-twingo', 'Renault', 'Twingo E-Tech', 149, 27.5],
    ['skoda-elroq-60', 'Škoda', 'Elroq 60', 168, 58],
    ['skoda-elroq-85', 'Škoda', 'Elroq 85', 171, 77],
    ['skoda-enyaq-85', 'Škoda', 'Enyaq 85', 167, 77],
    ['tesla-model3-rwd', 'Tesla', 'Model 3 Propulsion', 133, 60],
    ['tesla-modely-rwd', 'Tesla', 'Model Y Propulsion', 158, 60],
    ['tesla-modely-lr-rwd', 'Tesla', 'Model Y Grande Autonomie Propulsion', 159, 74],
    ['toyota-bz4x-73', 'Toyota', 'bZ4X 73 kWh traction', 179, 69],
    ['volvo-ex30-lr', 'Volvo', 'EX30 Extended Range', 178, 65],
    ['vw-id3-58', 'Volkswagen', 'ID.3 58 kWh', 159, 58],
    ['vw-id4-77', 'Volkswagen', 'ID.4 Pro 77 kWh', 171, 77]
];

export const VEHICLES = Object.freeze(list.map(([id, brand, model, whKm, usableKwh]) =>
    Object.freeze({ id, brand, model, whKm, usableKwh })));

export function findVehicle(id) {
    return VEHICLES.find(vehicle => vehicle.id === id) || null;
}

// Le curseur avance au kWh/100 km entier, entre 10 et 30.
export function vehicleSliderValue(vehicle) {
    return Math.min(30, Math.max(10, Math.round(vehicle.whKm / 10)));
}

export function vehicleLabel(vehicle) {
    return `${vehicle.brand} ${vehicle.model}`;
}
