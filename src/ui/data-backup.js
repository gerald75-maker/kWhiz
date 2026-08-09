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

export function initDataBackup({ storageKeys }) {
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
    const setStatus = (key, params = {}) => {
        currentStatus = { key, ...params };
        renderStatus();
    };

    const exportButton = document.getElementById('about-export-data');
    const importButton = document.getElementById('about-import-data');
    const handleExport = () => {
        const now = new Date();
        const backup = createUserDataBackup(localStorage, keys, now);
        const date = now.toISOString().slice(0, 10);
        downloadJson(`kwhiz-backup-${date}.json`, backup);
        setStatus('backup.downloaded');
    };

    const handleImportClick = () => input?.click();

    const handleImport = async () => {
        const [file] = input.files || [];
        if (!file) return;
        let backup;
        try {
            backup = JSON.parse(await file.text());
        } catch {
            setStatus('backup.importFailed');
            input.value = '';
            return;
        }
        try {
            const restored = restoreUserDataBackup(localStorage, backup, keys);
            setStatus(restored === 1 ? 'backup.restoredOne' : 'backup.restoredMany', { count: restored });
            window.setTimeout(() => window.location.reload(), 500);
        } catch (error) {
            const knownKeys = new Set(['backup.invalid', 'backup.unsupportedFormat', 'backup.missingData']);
            setStatus(knownKeys.has(error?.message) ? error.message : 'backup.restoreFailed');
            input.value = '';
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
            stopLanguageListener();
        }
    };
}
import { getLanguage, plural } from '../i18n/i18n.js';
