const DAY_MS = 24 * 60 * 60 * 1000;

function parseTariffDate(value) {
    if (!value || typeof value !== 'string') return null;

    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnly) {
        const [, year, month, day] = dateOnly;
        return {
            timestamp: Date.UTC(Number(year), Number(month) - 1, Number(day)),
            calendarDate: true
        };
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : { timestamp: date.getTime(), calendarDate: false };
}

export function assessTariffsFreshness(updatedAt, { now = new Date(), warningDays = 30, criticalDays = 90 } = {}) {
    const updatedDate = parseTariffDate(updatedAt);
    if (!updatedDate) {
        return { state: 'unknown', ageDays: null, label: 'Date de mise à jour inconnue' };
    }

    const nowTimestamp = updatedDate.calendarDate
        ? Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
        : now.getTime();
    const ageDays = Math.max(0, Math.floor((nowTimestamp - updatedDate.timestamp) / DAY_MS));

    if (ageDays >= criticalDays) {
        return { state: 'critical', ageDays, label: `Tarifs anciens (${ageDays} jours)` };
    }
    if (ageDays >= warningDays) {
        return { state: 'stale', ageDays, label: `Tarifs à vérifier (${ageDays} jours)` };
    }
    return { state: 'fresh', ageDays, label: ageDays === 0 ? 'Tarifs vérifiés aujourd’hui' : `Tarifs récents (${ageDays} jours)` };
}
