import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('information sur les données', () => {
    it('décrit les stockages locaux réellement utilisés', () => {
        assert.match(html, /thème, l’introduction déjà vue, la part de recharge rapide, les favoris/);
        assert.match(html, /cinq scénarios enregistrés/);
        assert.match(html, /cache des tarifs et jusqu’à douze relevés tarifaires/);
        assert.match(html, /cache des fichiers de l’application, des icônes, des polices et les tarifs/);
    });

    it('décrit séparément Umami et le journal de présence', () => {
        assert.match(html, /Umami mesure sans cookie les pages consultées/);
        assert.match(html, /sans cookie/);
        assert.match(html, /les 80 premiers caractères du User-Agent/);
        assert.match(html, /identifiant de huit caractères calculé à partir de l’adresse IP et du User-Agent/);
        assert.match(html, /L’adresse IP brute n’est pas écrite/);
    });

    it('précise les données non collectées et les limites de conservation', () => {
        assert.match(html, /ni cookie, ni sessionStorage, ni IndexedDB/);
        assert.match(html, /aucune suppression automatique du journal de présence/);
        assert.match(html, /durée de conservation des mesures Umami dépend de la configuration/);
    });
});
