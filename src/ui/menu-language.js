export function initMenuLanguage({
    documentRoot = document,
    getLanguage,
    setLanguage,
    t
}) {
    const buttons = [...documentRoot.querySelectorAll('[data-language]')];
    const status = documentRoot.getElementById('menu-language-status');
    const update = () => buttons.forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.language === getLanguage()));
    });

    update();
    buttons.forEach(button => button.addEventListener('click', () => {
        setLanguage(button.dataset.language);
        update();
        if (status) status.textContent = t('menu.language.changed');
        button.focus();
    }));

    return { update };
}
