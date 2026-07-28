export function syncHelpFaqState(details) {
    const summary = details?.querySelector('summary');
    if (!summary) return;
    summary.setAttribute('aria-expanded', String(details.open));
}

export async function toggleHelpFaq(details, reducedMotion = false) {
    const answer = details?.querySelector('.help-faq-answer');
    if (!details || !answer || details.dataset.animating === 'true') return;

    const willOpen = !details.open;
    if (reducedMotion || typeof answer.animate !== 'function') {
        details.open = willOpen;
        syncHelpFaqState(details);
        return;
    }

    details.dataset.animating = 'true';
    if (willOpen) details.open = true;
    syncHelpFaqState(details);

    const fullHeight = answer.scrollHeight;
    const frames = willOpen
        ? [
            { height: '0px', opacity: 0 },
            { height: `${fullHeight}px`, opacity: 1 }
        ]
        : [
            { height: `${fullHeight}px`, opacity: 1 },
            { height: '0px', opacity: 0 }
        ];

    try {
        const animation = answer.animate(frames, {
            duration: 180,
            easing: 'ease-out'
        });
        await animation.finished;
    } catch (_) {
        // Une animation annulée ne doit jamais bloquer l’état de l’accordéon.
    } finally {
        if (!willOpen) details.open = false;
        delete details.dataset.animating;
        syncHelpFaqState(details);
    }
}

export function initHelpFaq() {
    document.querySelectorAll('.help-faq-item').forEach(details => {
        const summary = details.querySelector('summary');
        syncHelpFaqState(details);
        details.addEventListener('toggle', () => syncHelpFaqState(details));
        summary?.addEventListener('click', event => {
            event.preventDefault();
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            void toggleHelpFaq(details, reducedMotion);
        });
    });
}
