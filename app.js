import {
    getAtlanteGemsRate,
    atlanteSteadyStateRate,
    chargebackBreakeven,
    calculateBreakeven,
    computeProfileMonthlyCost,
    monthlyCostSpread
} from './src/domain/pricing.js';
import { buildStationPrices, formulaPlanId } from './src/domain/station-pricing.js';
import { COVERAGE_RADIUS_KM, countStationsByOperator } from './src/domain/coverage.js';
import { initZoneControls } from './src/ui/controllers/zone-controls.js';
import { initSheets, openSheet, closeSheet } from './src/ui/sheet.js';
import { VEHICLES } from './src/config/vehicles.js';
import { loadTariffs } from './src/data/tariffs-repository.js';
import { assessTariffsFreshness } from './src/domain/tariffs-freshness.js';
import { buildTariffSnapshot, appendTariffSnapshot, getFormulaHistory, describeTariffChange } from './src/domain/tariff-history.js';
import { renderTarifsDateBanner, renderComparisonTable } from './src/ui/views/comparison-view.js';
import { renderProfileView } from './src/ui/views/profile-view.js';
import { renderOperatorsViews } from './src/ui/views/operators-view.js';
import { renderOfferDetail } from './src/ui/views/offer-detail-view.js';
import { renderTariffSources } from './src/ui/tariffs-info.js';

// ═══════════════════════════════════════════════════════════════════════════
// kWhiz — app.js
// ═══════════════════════════════════════════════════════════════════════════
//  TABLE DES MATIÈRES
//   1. Dépendances et état applicatif
//   2. Chargement des tarifs
//   3. Calcul et orchestration des vues
//   4. Landing et dialogues
//   5. Initialisation DOM
//   6. Bootstrap
// ═══════════════════════════════════════════════════════════════════════════


// ── 1. Dépendances, configuration et état ──────────────────────────

import {
    CONFIG,
    LOGOS,
    VALID_COLORS,
    STORAGE_KEYS,
    HOME_RATE_KWH,
    MAP_OPERATOR_KEYS
} from './src/config/app-config.js';
import { on } from './src/shared/dom.js';
import { applyTheme, initTheme, toggleTheme } from './src/ui/theme.js';
import {
    initPwa,
    triggerNativeInstall,
    getInstallEnvironment,
    checkForApplicationUpdate,
    markUpdateApplied,
    showUpdateStatus,
    reloadApplication
} from './src/pwa/pwa-manager.js';
import { initModalManager, openModal } from './src/ui/modal-manager.js';
import { initNavigation } from './src/ui/navigation.js';
import { initConsumptionController } from './src/ui/controllers/consumption-controller.js';
import { initProfileControls } from './src/ui/controllers/profile-controls.js';
import { applyChargingTime, dependsOnChargingTime, normalizeChargingTime } from './src/domain/charging-time.js';
import { renderAtlanteChargebackInfo, renderAtlanteChargebackState } from './src/ui/views/atlante-view.js';
import { initPullToRefresh } from './src/ui/pull-to-refresh.js';
import { initNetworkStatus } from './src/ui/network-status.js';
import { loadFavorites, saveFavorites, toggleFavorite } from './src/ui/favorites.js';
import { showFavoriteFeedback } from './src/ui/favorite-feedback.js';
import { initDataBackup } from './src/ui/data-backup.js';
import { initStationsMap } from './src/ui/stations-map.js';
import { initMenuLanguage } from './src/ui/menu-language.js';
import { formatCurrency, formatNumber, formatTariffsFreshness, formatTariffsStatusLine, initI18n, getLanguage, setLanguage, t, onLanguageChange } from './src/i18n/i18n.js';

const TARIFS_CACHE_KEY = STORAGE_KEYS.tariffsCache;
const LANDING_KEY = STORAGE_KEYS.landingSeen;
const FAST_PCT_KEY = STORAGE_KEYS.fastPercentage;
const PROFILE_KM_KEY = STORAGE_KEYS.profileKm;
const CONSUMPTION_KEY = STORAGE_KEYS.consumption;
const FAVORITES_KEY = STORAGE_KEYS.favorites;

initI18n();
initTheme();
initPwa();

let OPERATORS = {};
let currentComparisonQuery = '';
let allFormulasData = [];
// Moment de recharge (Mon profil) : fixe le prix retenu pour les tarifs publiés en fourchette.
let chargingTime = normalizeChargingTime(readStoredChargingTime());
function readStoredChargingTime() {
    try { return localStorage.getItem(STORAGE_KEYS.chargingTime); } catch { return null; }
}
let fastPct = (() => {
    const saved = parseInt(localStorage.getItem(FAST_PCT_KEY), 10);
    return (!Number.isNaN(saved) && saved >= 0 && saved <= 100) ? saved : 100;
})();
let consumptionController = null;
let landingTrigger = null;
let profileControls = null;
let navigation = null;
let zoneControls = null;
let coverage = null;
const comparisonFilters = { noSubscription: false, nearby: false };
let irveStationsPromise = null;

// Stations IRVE pour la couverture locale (même fichier que la carte, servi en Network First).
function loadIrveStations() {
    irveStationsPromise ||= fetch('./irve-fast.json')
        .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
        .then(payload => payload.stations || [])
        .catch(error => { irveStationsPromise = null; throw error; });
    return irveStationsPromise;
}

async function refreshCoverage() {
    const zone = zoneControls?.getZone();
    if (!zone) {
        coverage = null;
    } else {
        try {
            const stations = await loadIrveStations();
            coverage = {
                label: zoneControls.getLabel(),
                radiusKm: COVERAGE_RADIUS_KM,
                counts: countStationsByOperator(stations, zone),
                operators: new Set(stations.map(station => station.operator))
            };
        } catch {
            coverage = null;
        }
    }
    updateCalculations({ recomputeAtlanteChargeback: false });
}
let stationsMap = null;
let tariffsRequest = null;
let favorites = loadFavorites(FAVORITES_KEY);
let tariffHistory = (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.tariffHistory) || '[]'); }
    catch (_) { return []; }
})();
let appInitialized = false;
let currentFormulaDetail = null;
let currentApplicationStatus = null;

const savedConsumption = Number.parseInt(localStorage.getItem(CONSUMPTION_KEY), 10);
const initialConsumption = Number.isFinite(savedConsumption) && savedConsumption >= 10 && savedConsumption <= 30 ? savedConsumption : 18;
const savedMonthlyKm = Number.parseInt(localStorage.getItem(PROFILE_KM_KEY), 10);
const initialMonthlyKm = Number.isFinite(savedMonthlyKm) && savedMonthlyKm >= 0 && savedMonthlyKm <= 9999 ? savedMonthlyKm : 1000;
let currentTariffsStatus = null;

function renderApplicationStatus() {
    if (!currentApplicationStatus) return;
    const { state, messageKey } = currentApplicationStatus;
    const badge = document.getElementById('about-app-status-badge');
    const text = document.getElementById('about-app-status');
    if (badge) {
        badge.dataset.state = state;
        badge.textContent = t(`appStatus.badge.${state}`);
    }
    if (text) text.textContent = t(messageKey);
}

function setApplicationStatus(state, messageKey) {
    currentApplicationStatus = { state, messageKey };
    renderApplicationStatus();
}

function renderTariffsStatus() {
    if (!currentTariffsStatus) return;
    const { updatedAt, source, freshness, error } = currentTariffsStatus;
    const text = document.getElementById('about-tariffs-status');
    const badge = document.getElementById('about-tariffs-freshness');
    if (text) text.textContent = error
        ? t('tariffs.status.unavailable')
        : formatTariffsStatusLine(updatedAt, source);
    if (badge && freshness) {
        badge.dataset.state = freshness.state;
        badge.textContent = formatTariffsFreshness(freshness);
    }
}

function setTariffsStatus(status) {
    currentTariffsStatus = status;
    renderTariffsStatus();
    renderTarifsDateBanner(status.updatedAt, status.error, status.freshness, status.source);
}

async function checkStatusFromAbout() {
    const button = document.getElementById('about-check-update');
    if (button) {
        button.disabled = true;
        button.classList.add('is-checking');
    }
    setApplicationStatus('checking', 'appStatus.checking');

    try {
        const result = await refreshApplicationAndTariffs();
        if (result.reloadPending) return;
        if (!navigator.onLine) {
            setApplicationStatus('offline', 'appStatus.offline');
            showUpdateStatus('pwa.status.checkFailed');
        } else {
            setApplicationStatus('current', 'appStatus.current');
            showUpdateStatus('pwa.status.current');
        }
    } catch (error) {
        setApplicationStatus('error', 'appStatus.error');
        showUpdateStatus('pwa.status.checkFailed');
    } finally {
        if (button) {
            button.disabled = false;
            button.classList.remove('is-checking');
        }
    }
}


// ── 2. Chargement des tarifs ────────────────────────────────────────────

async function refreshApplicationAndTariffs({ setStatus } = {}) {
    try {
        const updateResult = await checkForApplicationUpdate({ onStatus: setStatus });
        if (updateResult.updated) {
            markUpdateApplied();
            setStatus?.('appUpdated');
            window.setTimeout(reloadApplication, 650);
            return { ok: true, state: 'appUpdated', reloadPending: true };
        }
    } catch (error) {
        console.warn('[kWhiz] Vérification de mise à jour impossible', error);
    }

    setStatus?.('refreshing');
    const tariffResult = await loadTarifs();
    return {
        ...tariffResult,
        state: tariffResult.ok ? 'success' : 'error'
    };
}

async function loadTarifs() {
    if (tariffsRequest) return tariffsRequest;

    tariffsRequest = (async () => {
        try {
            const result = await loadTariffs({
                url: './tarifs.json',
                cacheKey: TARIFS_CACHE_KEY,
                validColors: VALID_COLORS
            });
            // Stations-e n’est plus un opérateur actif. Filtrer aussi un ancien
            // cache local afin qu’une préférence historique ne réintroduise pas
            // ses formules dans les calculs ou les vues.
            OPERATORS = Object.fromEntries(
                Object.entries(result.data).filter(([key]) => key !== 'statione')
            );
            renderTariffSources(OPERATORS);
            const snapshot = buildTariffSnapshot(OPERATORS, result.updatedAt);
            tariffHistory = appendTariffSnapshot(tariffHistory, snapshot);
            try { localStorage.setItem(STORAGE_KEYS.tariffHistory, JSON.stringify(tariffHistory)); } catch (_) {}
            const offline = result.source === 'localStorage';
            const source = offline ? 'localCache' : 'online';
            const freshness = assessTariffsFreshness(result.updatedAt);
            setTariffsStatus({ updatedAt: result.updatedAt, source, freshness, error: false });
            console.log(`✓ Tarifs chargés depuis ${result.source}`);
            updateCalculations();
            return { ok: true, source: result.source, offline };
        } catch (error) {
            console.warn('⚠️ Aucun tarif exploitable', error.message);
            const freshness = { state: 'unknown', ageDays: null };
            setTariffsStatus({ updatedAt: null, source: 'offline', freshness, error: true });
            updateCalculations();
            return { ok: false, error };
        } finally {
            tariffsRequest = null;
        }
    })();

    return tariffsRequest;
}



function renderCurrentFormulaDetail() {
    if (!currentFormulaDetail) return false;
    const body = document.getElementById('formula-detail-body');
    const title = document.getElementById('formula-detail-title');
    const { formula } = currentFormulaDetail;
    const logo = LOGOS[formula.opKey]
        ? `<img src="${LOGOS[formula.opKey]}" class="formula-detail-logo" alt="">`
        : '';
    const historyEntries = getFormulaHistory(tariffHistory, `${formula.opKey}::${formula.name}`);
    const evolution = describeTariffChange(historyEntries);
    return renderOfferDetail({ body, title, formula, logo, historyEntries, evolution });
}

function openFormulaDetail(formula, trigger) {
    currentFormulaDetail = { formula };
    if (!renderCurrentFormulaDetail()) return;
    openModal('formula-detail-overlay', trigger);
}

// ── 3. Calcul et orchestration des vues ────────────────────────────────

function updateCalculations({ recomputeAtlanteChargeback = true } = {}) {
    const consumption = consumptionController?.getConsumption() ?? 0.18;
    allFormulasData = [];
    for (const [opKey, operator] of Object.entries(OPERATORS)) {
        // ChargeBack : config et taux en vigueur aujourd'hui
        const hasCB    = operator.loyalty?.chargebackInfo || false;
        const cbConfig = operator.loyalty?.chargebackConfig || null;
        const gemsRate = hasCB && cbConfig ? getAtlanteGemsRate(cbConfig) : 0;

        for (const sourceFormula of operator.formulas) {
            const formula = applyChargingTime(sourceFormula, chargingTime);
            const result = calculateBreakeven(formula, consumption);

            // Taux et seuil effectifs (steady-state pour le classement)
            const chargebackEligible = hasCB && formula.chargebackEligible === true && gemsRate > 0;
            const effectiveRate = chargebackEligible
                ? atlanteSteadyStateRate(formula.rate, gemsRate)
                : formula.rate;
            const effectiveKm = chargebackEligible
                ? chargebackBreakeven(formula, consumption, gemsRate)
                : result.km;
            const effectiveCostPer100km = effectiveRate * consumption * 100;

            allFormulasData.push({
                operator:       operator.name,
                opKey:          opKey,
                color:          operator.color,
                chargebackInfo: hasCB,
                chargebackConfig: chargebackEligible ? cbConfig : null, // uniquement pour les offres éligibles
                chargebackRate: chargebackEligible ? effectiveRate : null,
                // Valeurs effectives (pour tri et affichage)
                rate:           effectiveRate,
                ref:            formula.ref,
                km:             effectiveKm,
                costPer100km:   effectiveCostPer100km,
                // Valeurs brutes (pour la ligne barrée)
                rateRaw:        formula.rate,
                kmRaw:          result.km,
                costRaw:        result.costPer100km,
                name:           formula.name,
                cost:           formula.cost,
                period:         formula.period,
                monthlyCost:    result.monthlyCost || 0,
                note:           formula.note || null,
                previousCost:   formula.previousCost || null,
                badge:          operator.badge || null,
                mapUrl:         operator.mapUrl || null,
                pricingType:    formula.pricingType || 'fixed',
                calculationBasis: formula.calculationBasis || 'official',
                rateMin:        Number.isFinite(formula.rateMin) ? formula.rateMin : null,
                rateMax:        Number.isFinite(formula.rateMax) ? formula.rateMax : null,
                discountPerKwh: Number.isFinite(formula.discountPerKwh) ? formula.discountPerKwh : null,
                referenceUnavailable: formula.referenceUnavailable === true,
                sourceUrl:      formula.sourceUrl || operator.sourceUrl || null,
                verifiedAt:     formula.verifiedAt || operator.verifiedAt || null,
                validUntil:     formula.validUntil || null,
                isMinimum:      formula.isMinimum === true,
                chargingTime:   dependsOnChargingTime(sourceFormula) ? chargingTime : null
            });
        }
    }
    const monthlyKm = profileControls?.getMonthlyKm() ?? Math.max(0, parseInt(document.getElementById('profile-km')?.value, 10) || 0);
    const fastPercentage = profileControls?.getFastPercentage() ?? fastPct;
    renderComparisonTable(allFormulasData, {
        monthlyKm,
        consumption,
        fastPercentage,
        homeRate: HOME_RATE_KWH,
        logos: LOGOS,
        onModal: openInfoModal,
        onDetail: openFormulaDetail,
        query: currentComparisonQuery,
        coverage,
        filters: comparisonFilters
    });
    renderOperatorsViews({
        operators: OPERATORS,
        consumption,
        logos: LOGOS,
        onModal: openInfoModal,
        favorites,
        onToggleFavorite: handleToggleFavorite,
        onDetail: openFormulaDetail,
        mapOperators: MAP_OPERATOR_KEYS,
        onShowOperatorMap: showOperatorOnMap,
        chargingTime
    });
    // Recalcule le comparateur profil si c'est la vue active ou si déjà rendu
    if (navigation?.getCurrentView() === 'profile' || document.getElementById('profile-body')?.hasChildNodes()) {
        renderProfile();
    }
    // UI ChargeBack Atlante — générée depuis tarifs.json (source unique)
    if (recomputeAtlanteChargeback) renderAtlanteChargebackInfo(OPERATORS);
    refreshStationPrices();
    renderLandingBenefit();
    renderProfileSummary();
}

// Puces « Quand rechargez-vous ? » du panneau Mon profil.
function initChargingTimeControls() {
    const group = document.getElementById('charging-time-chips');
    if (!group) return;
    const render = () => group.querySelectorAll('[data-charging-time]').forEach(chip => {
        const active = chip.dataset.chargingTime === chargingTime;
        chip.classList.toggle('active', active);
        chip.setAttribute('aria-pressed', String(active));
    });
    group.addEventListener('click', event => {
        const chip = event.target.closest('[data-charging-time]');
        if (!chip) return;
        const next = normalizeChargingTime(chip.dataset.chargingTime);
        if (next === chargingTime) return;
        chargingTime = next;
        try { localStorage.setItem(STORAGE_KEYS.chargingTime, chargingTime); } catch { /* stockage indisponible : réglage gardé pour la session */ }
        render();
        updateCalculations();
    });
    render();
}

// Ligne de résumé en haut de l'écran : voiture · kilométrage · part rapide · ville.
function renderProfileSummary() {
    const node = document.getElementById('profile-summary-text');
    if (!node) return;
    const consumption = consumptionController?.getValue?.() ?? 18;
    const parts = [
        consumptionController?.getVehicleLabel?.() || t('summary.consumption', { value: formatNumber(consumption) }),
        t('summary.km', { km: formatNumber(profileControls?.getMonthlyKm() ?? 0) }),
        t('summary.fast', { percentage: formatNumber(profileControls?.getFastPercentage() ?? fastPct) })
    ];
    if (chargingTime !== 'any') parts.push(t(chargingTime === 'offpeak' ? 'summary.offpeak' : 'summary.peak'));
    const place = zoneControls?.getZone() ? zoneControls.getLabel() : '';
    if (place) parts.push(place);
    node.textContent = parts.join(' · ');
    document.getElementById('profile-summary')?.setAttribute('aria-label', t('summary.edit', { summary: node.textContent }));
}

// Accueil : écart réel entre la formule la moins chère et la plus chère, pour un profil
// de référence affiché en toutes lettres (1 000 km/mois, 18 kWh/100 km, tout en rapide).
const LANDING_REFERENCE = Object.freeze({ km: 1000, consumption: 0.18 });
function renderLandingBenefit() {
    const node = document.getElementById('landing-benefit');
    if (!node) return;
    const result = monthlyCostSpread(allFormulasData, LANDING_REFERENCE.km, LANDING_REFERENCE.consumption, { homeRate: HOME_RATE_KWH });
    node.hidden = !result || result.spread < 1;
    node.textContent = node.hidden ? '' : t('landing.benefit', {
        amount: formatCurrency(Math.round(result.spread), { maximumFractionDigits: 0 }),
        km: formatNumber(LANDING_REFERENCE.km),
        consumption: formatNumber(LANDING_REFERENCE.consumption * 100)
    });
}

// Prix affichés sur la carte : sans abonnement, plus les abonnements favoris
// et l'offre recommandée par Mon choix lorsqu'elle comporte un abonnement.
function refreshStationPrices() {
    if (!stationsMap?.setPrices) return;
    const planIds = new Set(favorites);
    const km = profileControls?.getMonthlyKm() ?? 0;
    if (km > 0 && allFormulasData.length) {
        const consumption = consumptionController?.getConsumption() ?? 0.18;
        const fastPercentage = profileControls?.getFastPercentage() ?? fastPct;
        const best = allFormulasData
            .map(formula => ({ formula, cost: computeProfileMonthlyCost(formula, km, consumption, { fastPercentage, homeRate: HOME_RATE_KWH }) }))
            .filter(item => Number.isFinite(item.cost))
            .sort((a, b) => a.cost - b.cost)[0];
        if (best?.formula.monthlyCost > 0) planIds.add(formulaPlanId(best.formula));
    }
    stationsMap.setPrices(buildStationPrices(allFormulasData, { planIds }));
}


function handleToggleFavorite(id) {
    const wasFavorite = favorites.has(id);
    const activeElement = document.activeElement;
    const focusScope = activeElement?.closest?.('.tab-content, .page-overlay');
    favorites = toggleFavorite(favorites, id);
    saveFavorites(FAVORITES_KEY, favorites);
    updateCalculations();
    const candidates = focusScope?.querySelectorAll?.('[data-favorite-id]')
        || document.querySelectorAll('[data-favorite-id]');
    Array.from(candidates).find(button => button.dataset.favoriteId === id)?.focus();
    showFavoriteFeedback(
        document.getElementById('favorite-status'),
        t(wasFavorite ? 'favorites.removed' : 'favorites.added')
    );
}

function openInfoModal(name) {
    if (name === 'izivia') openIziviaModal();
    if (name === 'ionity-rewards') openIonityRewardsModal();
}

function renderProfile() {
    renderProfileView({
        formulasData: allFormulasData,
        consumption: consumptionController?.getConsumption() ?? 0.18,
        fastPercentage: profileControls?.getFastPercentage() ?? fastPct,
        homeRate: HOME_RATE_KWH,
        logos: LOGOS,
        favorites,
        onToggleFavorite: handleToggleFavorite,
        onDetail: openFormulaDetail,
        mapOperators: MAP_OPERATOR_KEYS,
        coverage,
        onShowOperatorMap: showOperatorOnMap
    });
}

// Ouvre la carte kWhiz filtrée sur un réseau (offre n°1, liste des opérateurs).
function showOperatorOnMap(opKey) {
    navigation?.switchView('map');
    void stationsMap?.showOperator?.(opKey);
}

// ── 4. Landing et dialogues ────────────────────────────────────────────

function showLanding() {
    const overlay = document.getElementById('landing-overlay');
    if (!overlay) return;
    landingTrigger = document.activeElement;
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => requestAnimationFrame(() => {
        overlay.classList.add('visible');
        document.getElementById('landing-start')?.focus({ preventScroll: true });
    }));
}

function applyInstallOsDetection() {
    const userAgent = navigator.userAgent || '';
    const { isIos, isAndroid, isStandalone } = getInstallEnvironment({
        userAgent,
        displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
        navigatorStandalone: window.navigator.standalone
    });
    const installSection = document.getElementById('settings-install');
    const iosBlock = document.getElementById('install-ios');
    const androidBlock = document.getElementById('install-android');
    if (installSection) installSection.hidden = isStandalone;
    if (isIos && androidBlock) androidBlock.hidden = true;
    if (isAndroid && iosBlock) iosBlock.hidden = true;
}

// Premier lancement : présentation, puis voiture, kilomètres, lieu de recharge et ville.
// Chaque réponse est enregistrée aussitôt ; « Passer » garde la valeur actuelle.
const LANDING_STEPS = ['landing-intro', 'landing-car', 'landing-km', 'landing-usage', 'landing-city'];
let landingStep = 0;

function showLandingStep(index) {
    landingStep = Math.max(0, Math.min(LANDING_STEPS.length - 1, index));
    LANDING_STEPS.forEach((id, position) => {
        const section = document.getElementById(id);
        if (section) section.hidden = position !== landingStep;
    });
    const id = LANDING_STEPS[landingStep];
    if (id === 'landing-car') fillLandingCars();
    if (id === 'landing-km') markLandingKm(profileControls?.getMonthlyKm() ?? 1000);
    if (id === 'landing-usage') {
        const current = profileControls?.getFastPercentage() ?? fastPct;
        document.querySelectorAll('#landing-usage [data-fast-pct]').forEach(button => {
            button.setAttribute('aria-pressed', String(Number(button.dataset.fastPct) === current));
        });
    }
    if (id === 'landing-city') void zoneControls?.loadPlaces?.().catch(() => {});
    document.getElementById('landing-overlay')?.scrollTo?.({ top: 0 });
    document.querySelector(`#${id} .landing-heading`)?.focus({ preventScroll: true });
}

function nextLandingStep() {
    if (landingStep >= LANDING_STEPS.length - 1) finishLanding();
    else showLandingStep(landingStep + 1);
}

function fillLandingCars() {
    const select = document.getElementById('landing-car-select');
    if (!select || select.querySelector('optgroup')) return;
    const brands = new Map();
    VEHICLES.forEach(vehicle => {
        if (!brands.has(vehicle.brand)) brands.set(vehicle.brand, []);
        brands.get(vehicle.brand).push(vehicle);
    });
    brands.forEach((vehicles, brand) => {
        const group = document.createElement('optgroup');
        group.label = brand;
        vehicles.forEach(vehicle => {
            const option = document.createElement('option');
            option.value = vehicle.id;
            option.textContent = vehicle.model;
            group.append(option);
        });
        select.append(group);
    });
    const current = consumptionController?.getVehicle?.();
    if (current) select.value = current.id;
}

function markLandingKm(km) {
    let matched = false;
    document.querySelectorAll('#landing-km [data-km]').forEach(button => {
        const active = Number(button.dataset.km) === km;
        matched ||= active;
        button.setAttribute('aria-pressed', String(active));
    });
    const input = document.getElementById('landing-km-input');
    if (input) input.value = matched ? '' : String(km);
}

function chooseLandingUsage(value) {
    const percentage = parseInt(value, 10);
    if (!Number.isNaN(percentage)) {
        fastPct = profileControls ? profileControls.setFastPercentage(percentage) : percentage;
    }
    nextLandingStep();
}

async function finishLandingCity() {
    const input = document.getElementById('landing-city-input');
    const status = document.getElementById('landing-city-status');
    const query = input?.value.trim();
    if (!query) { finishLanding(); return; }
    const error = await zoneControls?.applyQuery(query);
    if (error) {
        if (status) status.textContent = t(error);
        return;
    }
    finishLanding();
}

async function locateLandingCity() {
    const status = document.getElementById('landing-city-status');
    if (status) status.textContent = t('profile.zone.locating');
    const error = await zoneControls?.locate();
    if (error) {
        if (status) status.textContent = t(error);
        return;
    }
    finishLanding();
}

function finishLanding() {
    hideLanding();
    navigation?.switchView('profile');
}

function resetLandingSteps() {
    landingStep = 0;
    LANDING_STEPS.forEach((id, position) => {
        const section = document.getElementById(id);
        if (section) section.hidden = position !== 0;
    });
    const status = document.getElementById('landing-city-status');
    if (status) status.textContent = '';
}

// Ouvre Mon profil ; avec focusZone, place le curseur dans le champ ville.
function openProfileSheet(trigger, { focusZone = false } = {}) {
    openSheet('profile-sheet', trigger);
    if (focusZone) {
        window.setTimeout(() => {
            const input = document.getElementById('profile-zone-input');
            input?.scrollIntoView({ block: 'center' });
            input?.focus({ preventScroll: true });
        }, 260);
    }
}

function hideLanding() {
    const overlay = document.getElementById('landing-overlay');
    if (!overlay) return;
    resetLandingSteps();
    overlay.classList.remove('visible');
    overlay.classList.add('hidden');
    localStorage.setItem(LANDING_KEY, '1');
    if (landingTrigger instanceof HTMLElement) landingTrigger.focus();
    landingTrigger = null;
}

function openIziviaModal(trigger) { openModal('izivia-overlay', trigger); }
function openIonityRewardsModal(trigger) { openModal('ionity-rewards-overlay', trigger); }

// ── 5. Initialisation DOM ───────────────────────────────────────────────

function initApp() {
    if (appInitialized) return;
    appInitialized = true;

    initModalManager([
        { overlayId: 'izivia-overlay', closeId: 'izivia-close' },
        { overlayId: 'ionity-rewards-overlay', closeId: 'ionity-rewards-close' },
        { overlayId: 'formula-detail-overlay', closeId: 'formula-detail-close' },
        { overlayId: 'route-choice-overlay', closeId: 'route-choice-close' }
    ]);

    consumptionController = initConsumptionController({
        initialValue: initialConsumption,
        storageKey: CONSUMPTION_KEY,
        vehicleStorageKey: STORAGE_KEYS.vehicleModel,
        onChange: updateCalculations
    });

    profileControls = initProfileControls({
        initialFastPercentage: fastPct,
        initialMonthlyKm,
        storageKey: FAST_PCT_KEY,
        monthlyKmStorageKey: PROFILE_KM_KEY,
        onChange: updateCalculations
    });
    initChargingTimeControls();

    stationsMap = initStationsMap({
        getHomeZone: () => zoneControls?.getZone(),
        // Le tracé est affiché : on referme le panneau pour montrer la carte.
        onRouteShown: () => closeSheet({ restoreFocus: false })
    });
    document.getElementById('map-filters-open')?.addEventListener('click', event => openSheet('map-filters-sheet', event.currentTarget));
    document.getElementById('map-route-open')?.addEventListener('click', event => openSheet('map-route-sheet', event.currentTarget));
    refreshStationPrices();
    zoneControls = initZoneControls({ storageKey: STORAGE_KEYS.homeZone, loadStations: loadIrveStations, onChange: refreshCoverage });
    if (zoneControls.getZone()) void refreshCoverage();
    navigation = initNavigation({
        initialView: 'profile',
        onViewChange: view => {
            closeSheet({ restoreFocus: false });
            if (view === 'profile') renderProfile();
            if (view === 'map') stationsMap?.activate();
        },
        onToggleTheme: toggleTheme,
        onShowLanding: showLanding
    });

    on('install-native-btn', 'click', triggerNativeInstall);
    on('about-check-update', 'click', checkStatusFromAbout);
    initDataBackup({
        storageKeys: STORAGE_KEYS,
        onRestored: ({ keys = [] } = {}) => {
            if (keys.includes(CONSUMPTION_KEY)) consumptionController?.setValue(localStorage.getItem(CONSUMPTION_KEY), { notifyChange: false });
            if (keys.includes(FAST_PCT_KEY)) profileControls?.setFastPercentage(localStorage.getItem(FAST_PCT_KEY), { notifyChange: false });
            if (keys.includes(PROFILE_KM_KEY)) profileControls?.setMonthlyKm(localStorage.getItem(PROFILE_KM_KEY), { notifyChange: false });
            updateCalculations();
        }
    });
    const languageMenu = initMenuLanguage({ getLanguage, setLanguage, t });
    onLanguageChange(() => {
        consumptionController?.refresh?.();
        zoneControls?.refreshLanguage();
        if (coverage) coverage.label = zoneControls?.getLabel() || coverage.label;
        languageMenu.update();
        applyTheme(document.body.classList.contains('light') ? 'light' : 'dark');
        renderApplicationStatus();
        if (currentTariffsStatus) setTariffsStatus(currentTariffsStatus);
        if (document.getElementById('formula-detail-overlay')?.getAttribute('aria-hidden') === 'false') {
            renderCurrentFormulaDetail();
        }
        updateCalculations({ recomputeAtlanteChargeback: false });
        renderAtlanteChargebackState();
        stationsMap?.refreshLanguage();
        applyInstallOsDetection();
    });

    if (navigator.onLine) {
        setApplicationStatus('current', 'appStatus.ready');
    } else {
        setApplicationStatus('offline', 'appStatus.offline');
    }

    document.getElementById('compare-search')?.addEventListener('input', event => {
        currentComparisonQuery = event.target.value;
        updateCalculations();
    });
    // Offres : classement par prix ou annuaire par réseau.
    document.getElementById('offers-mode')?.addEventListener('click', event => {
        const button = event.target.closest?.('[data-offers-mode]');
        if (!button) return;
        const byNetwork = button.dataset.offersMode === 'network';
        document.querySelectorAll('#offers-mode [data-offers-mode]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        document.getElementById('offers-by-price').hidden = byNetwork;
        document.getElementById('offers-by-network').hidden = !byNetwork;
    });
    // Sur la carte, l'en-tête est masqué : le bouton Menu de la carte ouvre le même menu.
    document.getElementById('map-menu')?.addEventListener('click', () => document.getElementById('bnav-menu')?.click());
    document.getElementById('profile-all-offers')?.addEventListener('click', () => navigation?.switchView('compare'));
    document.getElementById('compare-filters')?.addEventListener('click', event => {
        const button = event.target.closest?.('[data-compare-filter]');
        if (!button) return;
        const key = button.dataset.compareFilter;
        comparisonFilters[key] = !comparisonFilters[key];
        updateCalculations({ recomputeAtlanteChargeback: false });
    });
    // Sans zone de recharge, le filtre « près de chez moi » ouvre Mon profil sur le champ ville.
    document.getElementById('compare-zone-link')?.addEventListener('click', event => openProfileSheet(event.currentTarget, { focusZone: true }));
    initSheets();
    document.getElementById('profile-summary')?.addEventListener('click', event => openProfileSheet(event.currentTarget));
    document.addEventListener('click', event => {
        const profileTrigger = event.target.closest?.('[data-open-profile]');
        if (profileTrigger) openProfileSheet(profileTrigger, { focusZone: true });
        const whyTrigger = event.target.closest?.('[data-open-why]');
        if (whyTrigger) openSheet('why-sheet', whyTrigger);
    });

    initNetworkStatus({ onReconnect: loadTarifs });

    document.getElementById('landing-start')?.addEventListener('click', () => showLandingStep(1));
    document.getElementById('landing-overlay')?.addEventListener('click', event => {
        const target = event.target;
        if (target.closest?.('[data-landing-back]')) { showLandingStep(landingStep - 1); return; }
        if (target.closest?.('[data-landing-skip]')) { event.preventDefault(); nextLandingStep(); return; }
        const usage = target.closest?.('[data-fast-pct]');
        if (usage) { chooseLandingUsage(usage.dataset.fastPct); return; }
        const kmChoice = target.closest?.('[data-km]');
        if (kmChoice) {
            profileControls?.setMonthlyKm(kmChoice.dataset.km);
            markLandingKm(Number(kmChoice.dataset.km));
            nextLandingStep();
            return;
        }
        if (target.closest?.('[data-landing-next]')) {
            const step = LANDING_STEPS[landingStep];
            if (step === 'landing-car') {
                const id = document.getElementById('landing-car-select')?.value;
                if (id) consumptionController?.chooseVehicle?.(id);
            }
            if (step === 'landing-km') {
                const typed = parseInt(document.getElementById('landing-km-input')?.value, 10);
                if (typed > 0) profileControls?.setMonthlyKm(typed);
            }
            nextLandingStep();
        }
    });
    document.getElementById('landing-finish')?.addEventListener('click', () => { void finishLandingCity(); });
    document.getElementById('landing-city-locate')?.addEventListener('click', () => { void locateLandingCity(); });
    document.getElementById('landing-help-link')?.addEventListener('click', event => {
        event.preventDefault();
        hideLanding();
        window.setTimeout(() => {
            navigation?.openPage('page-aide');
        }, 420);
    });

    initPullToRefresh({ onRefresh: refreshApplicationAndTariffs });

    applyInstallOsDetection();
    if (!localStorage.getItem(LANDING_KEY)) showLanding();

    // Charger les données seulement après l'installation de tous les
    // contrôleurs. En PWA, la réponse peut venir instantanément du cache.
    loadTarifs();
    fetch(CONFIG.pingUrl, { method: 'GET', mode: 'no-cors' }).catch(() => {});
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp, { once: true });
} else {
    initApp();
}


// ── 6. Bootstrap ────────────────────────────────────────────────────────

// Sticky thead : mesure dynamique du wrapper .sticky-top
// Met à jour --sticky-top-height dès que le wrapper change de taille
// (ex: affichage/masquage du hint, changement orientation, zoom).
(function initStickyTopHeight() {
    const wrapper = document.getElementById('sticky-top');
    if (!wrapper) return;
    const update = () => {
        document.documentElement.style.setProperty(
            '--sticky-top-height',
            wrapper.offsetHeight + 'px'
        );
    };
    update();
    new ResizeObserver(update).observe(wrapper);
})();
