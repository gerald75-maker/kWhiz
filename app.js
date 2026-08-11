import {
    getAtlanteGemsRate,
    atlanteSteadyStateRate,
    chargebackBreakeven,
    calculateBreakeven
} from './src/domain/pricing.js';
import { loadTariffs } from './src/data/tariffs-repository.js';
import { assessTariffsFreshness } from './src/domain/tariffs-freshness.js';
import { buildTariffSnapshot, appendTariffSnapshot, getFormulaHistory, describeTariffChange } from './src/domain/tariff-history.js';
import { openComparisonRecommendation, renderTarifsDateBanner, renderComparisonTable } from './src/ui/views/comparison-view.js';
import { renderProfileView } from './src/ui/views/profile-view.js';
import { renderOperatorsViews } from './src/ui/views/operators-view.js';
import { renderOfferDetail } from './src/ui/views/offer-detail-view.js';

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
    HOME_RATE_KWH
} from './src/config/app-config.js';
import { on } from './src/shared/dom.js';
import { applyTheme, initTheme, toggleTheme } from './src/ui/theme.js';
import {
    initPwa,
    triggerNativeInstall,
    getInstallEnvironment,
    checkForApplicationUpdate,
    reloadApplication
} from './src/pwa/pwa-manager.js';
import { initModalManager, openModal } from './src/ui/modal-manager.js';
import { initNavigation } from './src/ui/navigation.js';
import { initConsumptionController } from './src/ui/controllers/consumption-controller.js';
import { initProfileControls } from './src/ui/controllers/profile-controls.js';
import { renderAtlanteChargebackInfo, renderAtlanteChargebackState } from './src/ui/views/atlante-view.js';
import { initPullToRefresh } from './src/ui/pull-to-refresh.js';
import { initNetworkStatus } from './src/ui/network-status.js';
import { loadFavorites, saveFavorites, toggleFavorite } from './src/ui/favorites.js';
import { initDataBackup } from './src/ui/data-backup.js';
import { initStationsMap } from './src/ui/stations-map.js';
import { initMenuLanguage } from './src/ui/menu-language.js';
import { formatTariffsFreshness, formatTariffsStatusLine, initI18n, getLanguage, setLanguage, t, onLanguageChange } from './src/i18n/i18n.js';

const TARIFS_CACHE_KEY = STORAGE_KEYS.tariffsCache;
const LANDING_KEY = STORAGE_KEYS.landingSeen;
const FAST_PCT_KEY = STORAGE_KEYS.fastPercentage;
const FAVORITES_KEY = STORAGE_KEYS.favorites;

initI18n();
initTheme();
initPwa();

let OPERATORS = {};
let currentComparisonQuery = '';
let allFormulasData = [];
let fastPct = (() => {
    const saved = parseInt(localStorage.getItem(FAST_PCT_KEY), 10);
    return (!Number.isNaN(saved) && saved >= 0 && saved <= 100) ? saved : 100;
})();
let consumptionController = null;
let landingTrigger = null;
let profileControls = null;
let navigation = null;
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
    if (button) button.disabled = true;
    setApplicationStatus('checking', 'appStatus.checking');

    try {
        const result = await refreshApplicationAndTariffs();
        if (result.reloadPending) return;
        if (!navigator.onLine) {
            setApplicationStatus('offline', 'appStatus.offline');
        } else {
            setApplicationStatus('current', 'appStatus.current');
        }
    } catch (error) {
        setApplicationStatus('error', 'appStatus.error');
    } finally {
        if (button) button.disabled = false;
    }
}


// ── 2. Chargement des tarifs ────────────────────────────────────────────

async function refreshApplicationAndTariffs({ setStatus } = {}) {
    try {
        const updateResult = await checkForApplicationUpdate({ onStatus: setStatus });
        if (updateResult.updated) {
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

        for (const formula of operator.formulas) {
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
                sourceUrl:      formula.sourceUrl || operator.sourceUrl || null,
                verifiedAt:     formula.verifiedAt || operator.verifiedAt || null,
                validUntil:     formula.validUntil || null,
                isMinimum:      formula.isMinimum === true
            });
        }
    }
    const monthlyKm = profileControls?.getMonthlyKm() ?? Math.max(0, parseInt(document.getElementById('profile-km')?.value, 10) || 0);
    const fastPercentage = profileControls?.getFastPercentage() ?? fastPct;
    const comparisonKm = document.getElementById('compare-km');
    if (comparisonKm && comparisonKm !== document.activeElement) comparisonKm.value = String(monthlyKm);
    renderComparisonTable(allFormulasData, {
        monthlyKm,
        consumption,
        fastPercentage,
        homeRate: HOME_RATE_KWH,
        logos: LOGOS,
        onModal: openInfoModal,
        onDetail: openFormulaDetail,
        query: currentComparisonQuery
    });
    renderOperatorsViews({
        operators: OPERATORS,
        consumption,
        logos: LOGOS,
        onModal: openInfoModal,
        favorites,
        onToggleFavorite: handleToggleFavorite
    });
    // Recalcule le comparateur profil si c'est la vue active ou si déjà rendu
    if (navigation?.getCurrentView() === 'profile' || document.getElementById('profile-body')?.hasChildNodes()) {
        renderProfile();
    }
    // UI ChargeBack Atlante — générée depuis tarifs.json (source unique)
    if (recomputeAtlanteChargeback) renderAtlanteChargebackInfo(OPERATORS);
}


function handleToggleFavorite(id) {
    favorites = toggleFavorite(favorites, id);
    saveFavorites(FAVORITES_KEY, favorites);
    updateCalculations();
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
        onToggleFavorite: handleToggleFavorite
    });
}

// ── 4. Landing et dialogues ────────────────────────────────────────────

function showLanding() {
    const overlay = document.getElementById('landing-overlay');
    if (!overlay) return;
    landingTrigger = document.activeElement;
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => requestAnimationFrame(() => {
        overlay.classList.add('visible');
        document.getElementById('landing-start')?.focus();
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

function hideLanding() {
    const overlay = document.getElementById('landing-overlay');
    if (!overlay) return;
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
        initialValue: 18,
        onChange: updateCalculations
    });

    profileControls = initProfileControls({
        initialFastPercentage: fastPct,
        storageKey: FAST_PCT_KEY,
        onChange: updateCalculations
    });

    stationsMap = initStationsMap();
    navigation = initNavigation({
        initialView: 'profile',
        onViewChange: view => {
            if (view === 'profile') renderProfile();
            if (view === 'map') stationsMap?.activate();
        },
        onToggleTheme: toggleTheme,
        onShowLanding: showLanding
    });

    on('install-native-btn', 'click', triggerNativeInstall);
    on('about-check-update', 'click', checkStatusFromAbout);
    initDataBackup({ storageKeys: STORAGE_KEYS });
    const languageMenu = initMenuLanguage({ getLanguage, setLanguage, t });
    onLanguageChange(() => {
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

    const viewMode = document.getElementById('view-mode');
    viewMode?.addEventListener('change', event => {
        document.getElementById('operators-compact').hidden = event.target.checked;
        document.getElementById('operators-detailed').hidden = !event.target.checked;
    });

    document.getElementById('compare-km')?.addEventListener('input', event => {
        profileControls?.setMonthlyKm(event.target.value);
    });

    document.getElementById('compare-search')?.addEventListener('input', event => {
        currentComparisonQuery = event.target.value;
        updateCalculations();
    });
    document.getElementById('compare-profile-link')?.addEventListener('click', () => openComparisonRecommendation(navigation));

    initNetworkStatus({ onReconnect: loadTarifs });

    document.getElementById('landing-start')?.addEventListener('click', hideLanding);
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
