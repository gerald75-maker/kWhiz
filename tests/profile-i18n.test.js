import test from 'node:test';
import assert from 'node:assert/strict';
import { setLanguage } from '../src/i18n/i18n.js';
import { renderProfileShortlist } from '../src/ui/views/profile-view.js';

function render(language) {
    const list = { innerHTML: '', querySelectorAll: () => [] };
    globalThis.document = {
        getElementById: id => id === 'profile-shortlist-list' ? list : null,
        dispatchEvent: () => true
    };
    setLanguage(language, { persist: false, translate: false });
    renderProfileShortlist([
        { name: 'Tarif unique', operator: 'IECharge', opKey: 'iecharge', color: 'iecharge', monthlyCost: 0, profileMonthlyCost: 40 },
        { name: 'Atlante Go - mensuel', operator: 'Atlante', opKey: 'atlante', color: 'atlante', monthlyCost: 9.99, profileMonthlyCost: 45 },
        { name: 'Happy Hours - heures creuses', operator: 'Izivia', opKey: 'izivia', color: 'izivia', monthlyCost: 0, profileMonthlyCost: 50 }
    ], {}, new Set());
    return list.innerHTML;
}

test('localise les sous-titres de Mon choix sans traduire les noms commerciaux', () => {
    const french = render('fr');
    assert.match(french, /Tarif unique · Sans abonnement/);
    assert.match(french, /Atlante Go - mensuel · 9,99(?:&nbsp;|\s)€\/mois d’abonnement/);
    assert.match(french, /Happy Hours - heures creuses · Sans abonnement/);

    const english = render('en');
    assert.match(english, /Tarif unique · No subscription/);
    assert.match(english, /Atlante Go - mensuel · €9\.99\/month subscription/);
    assert.match(english, /Happy Hours - heures creuses · No subscription/);
    assert.doesNotMatch(english, /Sans abonnement|d’abonnement/);
});

test('la bascule FR ↔ EN rerend immédiatement le même classement', () => {
    assert.match(render('fr'), /9,99(?:&nbsp;|\s)€\/mois d’abonnement/);
    assert.match(render('en'), /€9\.99\/month subscription/);
    assert.match(render('fr'), /Sans abonnement/);
});
