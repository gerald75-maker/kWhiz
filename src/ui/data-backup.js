const BACKUP_FORMAT = 'kwhiz-user-data';
const BACKUP_VERSION = 1;

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
        throw new Error('Sauvegarde invalide');
    }
    if (value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION) {
        throw new Error('Format de sauvegarde non reconnu');
    }
    if (!value.data || typeof value.data !== 'object' || Array.isArray(value.data)) {
        throw new Error('Données de sauvegarde absentes');
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

    document.getElementById('about-export-data')?.addEventListener('click', () => {
        const now = new Date();
        const backup = createUserDataBackup(localStorage, keys, now);
        const date = now.toISOString().slice(0, 10);
        downloadJson(`kwhiz-backup-${date}.json`, backup);
        if (status) status.textContent = getLanguage() === 'en' ? 'Backup downloaded' : 'Sauvegarde téléchargée';
    });

    document.getElementById('about-import-data')?.addEventListener('click', () => input?.click());

    input?.addEventListener('change', async () => {
        const [file] = input.files || [];
        if (!file) return;
        try {
            const backup = JSON.parse(await file.text());
            const restored = restoreUserDataBackup(localStorage, backup, keys);
            if (status) status.textContent = getLanguage() === 'en'
                ? `${restored} setting${restored === 1 ? '' : 's'} restored. Reloading…`
                : `${restored} réglage${restored > 1 ? 's' : ''} restauré${restored > 1 ? 's' : ''}. Rechargement…`;
            window.setTimeout(() => window.location.reload(), 500);
        } catch (error) {
            if (status) status.textContent = error?.message || (getLanguage() === 'en' ? 'Unable to import backup' : 'Import impossible');
            input.value = '';
        }
    });
}
import { getLanguage, plural } from '../i18n/i18n.js';
