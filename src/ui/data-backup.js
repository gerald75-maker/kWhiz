import { formatNumber, onLanguageChange, t } from '../i18n/i18n.js';

const BACKUP_FORMAT = 'kwhiz-user-data';
const BACKUP_VERSION = 1;

export function backupStatusLabel(key, count) {
    return t(key, count === undefined ? {} : { count: formatNumber(count) });
}

export function createUserDataBackup(storage, keys, now = new Date()) {
    const data = {};
    for (const key of keys) {
        const value = storage.getItem(key);
        if (value !== null) data[key] = value;
    }
    return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: now.toISOString(),
        data
    };
}

export function validateUserDataBackup(value, allowedKeys) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('backup.invalid');
    }
    if (value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION) {
        throw new Error('backup.unsupportedFormat');
    }
    if (!value.data || typeof value.data !== 'object' || Array.isArray(value.data)) {
        throw new Error('backup.missingData');
    }

    const allowed = new Set(allowedKeys);
    const data = {};
    for (const [key, item] of Object.entries(value.data)) {
        if (allowed.has(key) && typeof item === 'string') data[key] = item;
    }
    return data;
}

export function restoreUserDataBackup(storage, backup, allowedKeys) {
    const data = validateUserDataBackup(backup, allowedKeys);
    const entries = Object.entries(data);
    const initialValues = new Map(entries.map(([key]) => [key, storage.getItem(key)]));

    try {
        for (const [key, value] of entries) storage.setItem(key, value);
    } catch (error) {
        for (const [key, value] of initialValues) {
            if (value === null) storage.removeItem(key);
            else storage.setItem(key, value);
        }
        throw error;
    }

    return entries.length;
}

function downloadJson(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export function initDataBackup({
    storageKeys,
    storage = localStorage,
    download = downloadJson,
    schedule = window.setTimeout.bind(window),
    reload = () => window.location.reload()
}) {
    const keys = [
        storageKeys.landingSeen,
        storageKeys.fastPercentage,
        storageKeys.favorites,
        storageKeys.language,
        storageKeys.theme
    ];
    const status = document.getElementById('about-data-status');
    const input = document.getElementById('about-import-data-file');
    let currentStatus = null;

    const renderStatus = () => {
        if (!status || !currentStatus) return;
        const { key, count } = currentStatus;
        status.textContent = backupStatusLabel(key, count);
    };
    const setStatus = (key, params = {}, state = 'success') => {
        currentStatus = { key, ...params };
        if (status) {
            status.dataset.state = state;
            status.setAttribute('role', state === 'error' ? 'alert' : 'status');
            status.setAttribute('aria-live', state === 'error' ? 'assertive' : 'polite');
        }
        renderStatus();
    };

    const exportButton = document.getElementById('about-export-data');
    const importButton = document.getElementById('about-import-data');
    let exporting = false;
    let importing = false;

    const handleExport = () => {
        if (exporting) return;
        exporting = true;
        if (exportButton) exportButton.disabled = true;
        try {
            const now = new Date();
            const backup = createUserDataBackup(storage, keys, now);
            const date = now.toISOString().slice(0, 10);
            download(`kwhiz-backup-${date}.json`, backup);
            setStatus('backup.downloaded');
        } catch {
            setStatus('backup.saveFailed', {}, 'error');
        } finally {
            schedule(() => {
                exporting = false;
                if (exportButton) exportButton.disabled = false;
            }, 0);
        }
    };

    const finishImport = () => {
        importing = false;
        if (importButton) importButton.disabled = false;
    };

    const handlePickerReturn = () => schedule(() => {
        if (!input?.files?.length) finishImport();
    }, 100);

    const handleImportClick = () => {
        if (importing || !input) return;
        importing = true;
        if (importButton) importButton.disabled = true;
        input.value = '';
        input.click();
        window.addEventListener('focus', handlePickerReturn, { once: true });
    };

    const handleImport = async () => {
        window.removeEventListener('focus', handlePickerReturn);
        const [file] = input.files || [];
        if (!file) {
            finishImport();
            return;
        }
        let backup;
        try {
            backup = JSON.parse(await file.text());
        } catch {
            setStatus('backup.importFailed', {}, 'error');
            input.value = '';
            finishImport();
            return;
        }
        try {
            const restored = restoreUserDataBackup(storage, backup, keys);
            setStatus(restored === 1 ? 'backup.restoredOne' : 'backup.restoredMany', { count: restored });
            schedule(reload, 1600);
        } catch (error) {
            const knownKeys = new Set(['backup.invalid', 'backup.unsupportedFormat', 'backup.missingData']);
            setStatus(knownKeys.has(error?.message) ? error.message : 'backup.restoreFailed', {}, 'error');
        } finally {
            input.value = '';
            finishImport();
        }
    };

    exportButton?.addEventListener('click', handleExport);
    importButton?.addEventListener('click', handleImportClick);
    input?.addEventListener('change', handleImport);
    const stopLanguageListener = onLanguageChange(renderStatus);

    return {
        destroy() {
            exportButton?.removeEventListener('click', handleExport);
            importButton?.removeEventListener('click', handleImportClick);
            input?.removeEventListener('change', handleImport);
            window.removeEventListener('focus', handlePickerReturn);
            stopLanguageListener();
        }
    };
}
import { getLanguage, plural } from '../i18n/i18n.js';
