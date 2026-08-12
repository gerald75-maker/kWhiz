export function tariffSources(operators) {
    return Object.entries(operators || {})
        .filter(([key, operator]) => key !== 'statione' && operator?.name && operator?.sourceUrl)
        .map(([, operator]) => ({ name: operator.name, url: operator.sourceUrl }))
        .sort((left, right) => left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' }));
}

export function renderTariffSources(operators, list = document.getElementById('tariffs-source-list')) {
    if (!list) return;
    list.replaceChildren(...tariffSources(operators).map(source => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = source.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = source.name;
        item.append(link);
        return item;
    }));
}
