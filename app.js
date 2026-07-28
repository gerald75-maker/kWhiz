import {
    getAtlanteGemsRate,
    atlanteSteadyStateRate,
    chargebackBreakeven,
    calculateBreakeven
} from './src/domain/pricing.js';
import { loadTariffs } from './src/data/tariffs-repository.js';
import { assessTariffsFreshness } from './src/domain/tariffs-freshness.js';
import { buildTariffSnapshot, appendTariffSnapshot, getFormulaHistory, describeTariffChange } from './src/domain/tariff-history.js';
import { renderTarifsDateBanner, renderComparisonTable } from './src/ui/views/comparison-view.js';
import { renderProfileView } from './src/ui/views/profile-view.js';
import { renderOperatorsViews } from './src/ui/views/operators-view.js';

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
import { initTheme, toggleTheme } from './src/ui/theme.js';
import {
    initPwa,
    triggerNativeInstall,
    checkForApplicationUpdate,
    reloadApplication
} from './src/pwa/pwa-manager.js';
import { initModalManager, openModal } from './src/ui/modal-manager.js';
import { initNavigation } from './src/ui/navigation.js';
import { initConsumptionController } from './src/ui/controllers/consumption-controller.js';
import { initProfileControls } from './src/ui/controllers/profile-controls.js';
import { renderAtlanteChargebackInfo } from './src/ui/views/atlante-view.js';
import { initPullToRefresh } from './src/ui/pull-to-refresh.js';
import { initNetworkStatus } from './src/ui/network-status.js';
import { loadFavorites, saveFavorites, toggleFavorite } from './src/ui/favorites.js';
import { initDataBackup } from './src/ui/data-backup.js';
import { initHelpFaq } from './src/ui/help-faq.js';

const TARIFS_CACHE_KEY = STORAGE_KEYS.tariffsCache;
const LANDING_KEY = STORAGE_KEYS.landingSeen;
const FAST_PCT_KEY = STORAGE_KEYS.fastPercentage;
const FAVORITES_KEY = STORAGE_KEYS.favorites;

initTheme();
initPwa();

let OPERATORS = {};
let currentSort = { column: 'rate', direction: 'asc' };
let allFormulasData = [];
let fastPct = (() => {
    const saved = parseInt(localStorage.getItem(FAST_PCT_KEY), 10);
    return (!Number.isNaN(saved) && saved >= 0 && saved <= 100) ? saved : 100;
})();
let consumptionController = null;
let profileControls = null;
let navigation = null;
let tariffsRequest = null;
let favorites = loadFavorites(FAVORITES_KEY);
let tariffHistory = (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.tariffHistory) || '[]'); }
    catch (_) { return []; }
})();

function setApplicationStatus(state, message) {
    const badge = document.getElementById('about-app-status-badge');
    const text = document.getElementById('about-app-status');
    if (badge) {
        badge.dataset.state = state;
        badge.textContent = state === 'current' ? 'À jour'
            : state === 'offline' ? 'Hors ligne'
            : state === 'error' ? 'Indisponible'
            : 'Vérification…';
    }
    if (text) text.textContent = message;
}

function setTariffsStatus(message, freshness = null) {
    const text = document.getElementById('about-tariffs-status');
    const badge = document.getElementById('about-tariffs-freshness');
    if (text) text.textContent = message;
    if (badge && freshness) {
        badge.dataset.state = freshness.state;
        badge.textContent = freshness.label;
    }
}

async function checkStatusFromAbout() {
    const button = document.getElementById('about-check-update');
    if (button) button.disabled = true;
    setApplicationStatus('checking', 'Recherche d’une nouvelle version…');

    try {
        const result = await refreshApplicationAndTariffs();
        if (result.reloadPending) return;
        if (!navigator.onLine) {
            setApplicationStatus('offline', 'Version installée utilisable hors ligne');
        } else {
            setApplicationStatus('current', 'Dernière version disponible installée');
        }
    } catch (error) {
        setApplicationStatus('error', 'Vérification impossible');
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
            OPERATORS = result.data;
            const snapshot = buildTariffSnapshot(OPERATORS, result.updatedAt);
            tariffHistory = appendTariffSnapshot(tariffHistory, snapshot);
            try { localStorage.setItem(STORAGE_KEYS.tariffHistory, JSON.stringify(tariffHistory)); } catch (_) {}
            const offline = result.source === 'localStorage';
            const suffix = offline ? ' (hors ligne)' : '';
            const tariffsLabel = (result.updatedAt || 'cache') + suffix;
            const freshness = assessTariffsFreshness(result.updatedAt);
            renderTarifsDateBanner(tariffsLabel, false, freshness);
            setTariffsStatus(`${tariffsLabel} · ${offline ? 'cache local' : 'source en ligne'}`, freshness);
            console.log(`✓ Tarifs chargés depuis ${result.source}`);
            updateCalculations();
            return { ok: true, source: result.source, offline };
        } catch (error) {
            console.warn('⚠️ Aucun tarif exploitable', error.message);
            renderTarifsDateBanner(null, true);
            setTariffsStatus('Indisponibles — derniers calculs conservés', { state: 'unknown', label: 'Fraîcheur inconnue' });
            updateCalculations();
            return { ok: false, error };
        } finally {
            tariffsRequest = null;
        }
    })();

    return tariffsRequest;
}



function formatVerifiedDate(value) {
    if (!value) return 'Date inconnue';
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function formulaPricingLabel(formula) {
    if (formula.pricingType === 'range' || formula.pricingType === 'discount') {
        const range = `${formula.rateMin.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} à ${formula.rateMax.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/kWh`;
        return formula.pricingType === 'discount' && Number.isFinite(formula.discountPerKwh)
            ? `Remise de ${formula.discountPerKwh.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €/kWh · ${range}`
            : range;
    }
    if (formula.pricingType === 'station') return `Tarif variable · estimation ${formula.rate.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} €/kWh`;
    return `${formula.rate.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} €/kWh`;
}

function displayFormulaName(value) {
    return String(value || '').replace(/\s*[—–]\s*/g, ' – ');
}

function formulaTypeLabel(formula) {
    if (formula.pricingType === 'discount') return 'Remise officielle';
    if (formula.pricingType === 'range') return 'Plage tarifaire';
    if (formula.pricingType === 'station') return 'Tarif variable';
    return 'Tarif fixe';
}

function detailIcon(type) {
    const icons = {
        energy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>',
        subscription: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18v12H3z"/><path d="M3 10h18M16 15h2"/></svg>',
        cost: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h2m2 0h2m2 0h2M8 15h2m2 0h2m2 0h2M8 19h2m2 0h2m2 0h2"/></svg>',
        threshold: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10m5 10V4m5 16v-7m5 7V7"/><path d="m3 8 5-5 5 5 7-7"/></svg>'
    };
    return icons[type] || '';
}

function detailElement(tagName, className = '', text = null) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== null) element.textContent = text;
    return element;
}

function appendDetailBadge(container, className, text) {
    container.appendChild(detailElement('span', `detail-badge ${className}`, text));
}

function appendDetailStat(container, type, label, value) {
    const item = detailElement('div', `detail-stat detail-stat--${type}`);
    const icon = detailElement('span', 'detail-stat-icon');
    icon.innerHTML = detailIcon(type);
    const content = document.createElement('span');
    content.append(
        detailElement('dt', '', label),
        detailElement('dd', '', value)
    );
    item.append(icon, content);
    container.appendChild(item);
}

function createDetailExternalLink(url, className, leadingText, trailingText) {
    const link = detailElement('a', className);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    if (leadingText) {
        const leading = detailElement('span', '', leadingText);
        leading.setAttribute('aria-hidden', 'true');
        link.append(leading, document.createTextNode(' '));
    }
    link.appendChild(document.createTextNode(trailingText));
    const arrow = detailElement('span', '', leadingText ? '›' : '↗');
    arrow.setAttribute('aria-hidden', 'true');
    link.append(document.createTextNode(' '), arrow);
    return link;
}

function openFormulaDetail(formula, trigger) {
    const body = document.getElementById('formula-detail-body');
    const title = document.getElementById('formula-detail-title');
    if (!body || !title || !formula) return;
    const subscription = formula.cost > 0
        ? `${formula.cost.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/${formula.period === 'monthly' ? 'mois' : 'an'}`
        : 'Sans abonnement';
    const historyEntries = getFormulaHistory(tariffHistory, `${formula.opKey}::${formula.name}`);
    const evolution = describeTariffChange(historyEntries);
    const rateDelta = evolution.deltaRate
        ? `${evolution.deltaRate > 0 ? '+' : ''}${evolution.deltaRate.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} €/kWh`
        : 'Aucune variation';

    title.textContent = `${formula.operator} - ${displayFormulaName(formula.name)}`;
    body.replaceChildren();

    const header = detailElement('header', 'formula-detail-header');
    if (LOGOS[formula.opKey]) {
        const logo = detailElement('img', 'formula-detail-logo');
        logo.src = LOGOS[formula.opKey];
        logo.alt = '';
        header.appendChild(logo);
    }
    const heading = detailElement('div', 'formula-detail-heading');
    heading.append(
        detailElement('p', 'formula-detail-operator', formula.operator),
        detailElement('p', 'formula-detail-name', displayFormulaName(formula.name))
    );
    const badges = detailElement('div', 'formula-detail-badges');
    appendDetailBadge(badges, 'detail-badge--type', formulaTypeLabel(formula));
    if (formula.verifiedAt) appendDetailBadge(badges, 'detail-badge--verified', `Vérifié le ${formatVerifiedDate(formula.verifiedAt)}`);
    if (formula.chargebackRate !== null) appendDetailBadge(badges, 'detail-badge--chargeback', 'ChargeBack');
    heading.appendChild(badges);
    header.appendChild(heading);
    body.appendChild(header);

    if (formula.badge) body.appendChild(detailElement('p', 'formula-detail-power', `Réseau : ${formula.badge}`));

    const grid = detailElement('dl', 'formula-detail-grid');
    appendDetailStat(grid, 'energy', 'Prix de l’énergie', formulaPricingLabel(formula));
    appendDetailStat(grid, 'subscription', 'Abonnement', subscription);
    appendDetailStat(grid, 'cost', 'Coût estimé', `${formula.costPer100km.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/100 km`);
    appendDetailStat(
        grid,
        'threshold',
        'Seuil de rentabilité',
        formula.km === 0
            ? 'Sans seuil'
            : formula.km === Infinity
                ? 'Non rentable'
                : `${Math.round(formula.km).toLocaleString('fr-FR')} km/mois`
    );
    body.appendChild(grid);

    const history = detailElement('section', 'formula-history');
    history.dataset.state = evolution.state;
    const historyHeading = detailElement('div', 'formula-history-heading');
    historyHeading.append(
        detailElement('h3', '', 'Historique tarifaire'),
        detailElement('span', '', rateDelta)
    );
    history.append(historyHeading, detailElement('p', '', evolution.label));
    if (historyEntries.length) {
        const list = document.createElement('ul');
        historyEntries.slice(-4).reverse().forEach(entry => {
            const date = entry.updatedAt || entry.capturedAt;
            const parsedDate = date ? new Date(date) : null;
            const dateLabel = parsedDate && !Number.isNaN(parsedDate.getTime())
                ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsedDate)
                : (entry.updatedAt || 'Date inconnue');
            const item = document.createElement('li');
            item.append(
                detailElement('time', '', dateLabel),
                detailElement('strong', '', `${Number(entry.rate).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} €/kWh`)
            );
            list.appendChild(item);
        });
        history.appendChild(list);
    }
    body.appendChild(history);

    const source = detailElement('section', 'formula-source');
    const type = document.createElement('p');
    type.appendChild(detailElement('strong', '', formulaTypeLabel(formula)));
    source.append(
        type,
        detailElement('p', '', `Vérifié le ${formatVerifiedDate(formula.verifiedAt)}`)
    );
    if (formula.validUntil) source.appendChild(detailElement('p', '', `Conditions valables jusqu’au ${formatVerifiedDate(formula.validUntil)}`));
    if (formula.calculationBasis !== 'official') source.appendChild(detailElement('p', '', 'Le classement utilise une estimation, pas un prix garanti.'));
    if (formula.sourceUrl) source.appendChild(createDetailExternalLink(formula.sourceUrl, '', '', 'Consulter la source officielle'));
    body.appendChild(source);

    if (formula.note) body.appendChild(detailElement('p', 'formula-detail-note', formula.note));
    if (formula.mapUrl) {
        body.appendChild(createDetailExternalLink(
            formula.mapUrl,
            'formula-detail-link',
            '⌖',
            'Voir les bornes de l’opérateur'
        ));
    }

    openModal('formula-detail-overlay', trigger);
}

// ── 3. Calcul et orchestration des vues ────────────────────────────────

function updateCalculations() {
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
                validUntil:     formula.validUntil || null
            });
        }
    }
    currentSort = renderComparisonTable(allFormulasData, currentSort.column, currentSort.direction, { logos: LOGOS, onModal: openInfoModal, onDetail: openFormulaDetail });
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
    renderAtlanteChargebackInfo(OPERATORS);
}


function handleToggleFavorite(id) {
    favorites = toggleFavorite(favorites, id);
    saveFavorites(FAVORITES_KEY, favorites);
    updateCalculations();
}

function openInfoModal(name) {
    if (name === 'cb') openCbModal();
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
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('visible')));
}

function applyInstallOsDetection() {
    const userAgent = navigator.userAgent || '';
    const isIos = /iPhone|iPad|iPod/i.test(userAgent);
    const isAndroid = /Android/i.test(userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
    const installBlock = document.getElementById('landing-install');
    const iosBlock = document.getElementById('install-ios');
    const androidBlock = document.getElementById('install-android');
    if (!installBlock) return;
    installBlock.hidden = isStandalone;
    if (isIos && androidBlock) androidBlock.hidden = true;
    if (isAndroid && iosBlock) iosBlock.hidden = true;
}

function hideLanding() {
    const overlay = document.getElementById('landing-overlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    overlay.classList.add('hidden');
    localStorage.setItem(LANDING_KEY, '1');
}

function openCbModal(trigger) { openModal('cb-overlay', trigger); }
function openIziviaModal(trigger) { openModal('izivia-overlay', trigger); }
function openIonityRewardsModal(trigger) { openModal('ionity-rewards-overlay', trigger); }

// ── 5. Initialisation DOM ───────────────────────────────────────────────

function initApp() {
    initModalManager([
        { overlayId: 'izivia-overlay', closeId: 'izivia-close' },
        { overlayId: 'cb-overlay', closeId: 'cb-close' },
        { overlayId: 'ionity-rewards-overlay', closeId: 'ionity-rewards-close' },
        { overlayId: 'formula-detail-overlay', closeId: 'formula-detail-close' }
    ]);

    consumptionController = initConsumptionController({
        initialValue: 18,
        onChange: updateCalculations
    });

    profileControls = initProfileControls({
        initialFastPercentage: fastPct,
        storageKey: FAST_PCT_KEY,
        onChange: renderProfile
    });

    navigation = initNavigation({
        initialView: 'profile',
        onViewChange: view => { if (view === 'profile') renderProfile(); },
        onRefresh: loadTarifs,
        onToggleTheme: toggleTheme,
        onShowLanding: showLanding
    });

    on('install-native-btn', 'click', triggerNativeInstall);
    on('about-check-update', 'click', checkStatusFromAbout);
    initDataBackup({ storageKeys: STORAGE_KEYS });
    initHelpFaq();

    if (navigator.onLine) {
        setApplicationStatus('current', 'Version installée prête à être vérifiée');
    } else {
        setApplicationStatus('offline', 'Version installée utilisable hors ligne');
    }

    const viewMode = document.getElementById('view-mode');
    viewMode?.addEventListener('change', event => {
        document.getElementById('operators-compact').hidden = event.target.checked;
        document.getElementById('operators-detailed').hidden = !event.target.checked;
    });

    document.querySelectorAll('.compare-sort-btn').forEach(button => {
        button.addEventListener('click', () => {
            const column = button.dataset.sort;
            const direction = currentSort.column === column && currentSort.direction === 'asc' ? 'desc' : 'asc';
            const query = document.getElementById('compare-search')?.value || '';
            currentSort = renderComparisonTable(allFormulasData, column, direction, { logos: LOGOS, onModal: openInfoModal, onDetail: openFormulaDetail, query });
        });
    });

    document.getElementById('compare-search')?.addEventListener('input', event => {
        currentSort = renderComparisonTable(allFormulasData, currentSort.column, currentSort.direction, {
            logos: LOGOS,
            onModal: openInfoModal,
            onDetail: openFormulaDetail,
            query: event.target.value
        });
    });

    initNetworkStatus({ onReconnect: loadTarifs });

    document.getElementById('landing-start')?.addEventListener('click', hideLanding);
    document.getElementById('landing-about-link')?.addEventListener('click', event => {
        event.preventDefault();
        hideLanding();
        window.setTimeout(() => {
            navigation?.closeAllPages();
            document.getElementById('page-about')?.classList.add('open');
        }, 420);
    });

    initPullToRefresh({ onRefresh: refreshApplicationAndTariffs });

    applyInstallOsDetection();
    if (!localStorage.getItem(LANDING_KEY)) showLanding();
}

document.addEventListener('DOMContentLoaded', initApp);


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

// Chargement initial des tarifs + ping de présence
loadTarifs();
fetch(CONFIG.pingUrl, { method: 'GET', mode: 'no-cors' }).catch(() => {});
