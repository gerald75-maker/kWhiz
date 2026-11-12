export function tariffSources(operators) {
    return Object.entries(operators || {})
        .filter(([key, operator]) => key !== 'statione' && operator?.name && operator?.sourceUrl)
        .map(([key, operator]) => ({ key, name: operator.name, url: operator.sourceUrl }))
        .sort((left, right) => left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' }));
}

// Nom de domaine lisible d'une source officielle (sans « www. »).
export function sourceDomain(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

// Une fiche par source : logo du réseau, nom, domaine et flèche de lien externe.
export function renderTariffSources(operators, { list = document.getElementById('tariffs-source-list'), logos = {} } = {}) {
    if (!list) return;
    list.replaceChildren(...tariffSources(operators).map(source => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.className = 'tariffs-source';
        link.href = source.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const logo = document.createElement('span');
        logo.className = 'tariffs-source-logo';
        logo.setAttribute('aria-hidden', 'true');
        if (logos[source.key]) {
            const image = document.createElement('img');
            image.src = logos[source.key];
            image.alt = '';
            image.loading = 'lazy';
            logo.append(image);
        } else {
            logo.textContent = source.name.slice(0, 1);
        }
        const copy = document.createElement('span');
        copy.className = 'tariffs-source-copy';
        const name = document.createElement('strong');
        name.textContent = source.name;
        const domain = document.createElement('small');
        domain.textContent = sourceDomain(source.url);
        copy.append(name, domain);
        const arrow = document.createElement('span');
        arrow.className = 'tariffs-source-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '↗';
        link.append(logo, copy, arrow);
        item.append(link);
        return item;
    }));
}
