import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { routeErrorKey } from '../src/ui/map-route-ui.js';

const read = path => readFile(new URL(`../public/${path}`, import.meta.url), 'utf8');

test('le compteur de visites n’enregistre rien qui désigne une personne', async () => {
    const ping = await read('ping.php');
    const code = ping.replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /REMOTE_ADDR|X_FORWARDED_FOR|md5|sha1|hash\(/i);
    assert.match(code, /date\('Y-m-d H:i:s'\) \. " \| \$device\\n"/, 'une ligne = date et type d’appareil');
});

test('le journal de visites et les fichiers internes ne sont pas servis', async () => {
    const htaccess = await read('.htaccess');
    assert.match(htaccess, /<FilesMatch "\\\.\(log\|lock\|tmp\)\$">\s*Require all denied/);
    assert.match(htaccess, /<Files "rate-limit\.php">\s*Require all denied/);
});

test('stats.php exige un mot de passe dont seule l’empreinte est stockée hors de la racine web', async () => {
    const stats = await read('stats.php');
    assert.match(stats, /dirname\(__DIR__\) \. '\/kwhiz-private\.php'/);
    assert.match(stats, /password_verify\(/);
    assert.match(stats, /session_regenerate_id\(true\)/);
    assert.match(stats, /kwhizRateLimit\('stats-login'/);
    assert.match(stats, /hash_equals\(\$_SESSION\['csrf'\]/);
    const firstOutput = stats.indexOf('// ── Lecture du log');
    assert.ok(stats.indexOf("empty($_SESSION['stats_authenticated'])") < firstOutput, 'le contrôle précède la lecture du journal');
    assert.doesNotMatch(stats, /password\s*=\s*['"][^'"]+['"]/i, 'aucun mot de passe en clair');
});

test('route.php protège le quota d’itinéraires', async () => {
    const route = await read('route.php');
    assert.match(route, /kwhizRateLimit\('route', ROUTES_PER_ADDRESS_PER_HOUR, 3600, kwhizClientAddress\(\)\)/);
    assert.match(route, /kwhizRateLimit\('route-day', ROUTES_PER_DAY, 86400\)/);
    assert.match(route, /respondError\(429, 'RATE_LIMITED'/);
    assert.match(route, /HTTP_ORIGIN/);
    assert.ok(route.indexOf("kwhizRateLimit('route'") > route.indexOf('is_file($cacheFile)'), 'une réponse en cache ne consomme pas la limite');
    assert.match(route, /kwhizPurgeTemporaryFiles\('kwhiz-route-\*\.json', 86400\)/);
    assert.equal(routeErrorKey({ code: 'RATE_LIMITED' }), 'map.route.rateLimited');
});

test('la limite de débit ne lit pas un en-tête que l’appelant peut écrire', async () => {
    const limiter = await read('rate-limit.php');
    assert.doesNotMatch(limiter.replace(/\/\/.*$|\/\*\*.*$/gm, ''), /X_FORWARDED_FOR/);
    assert.match(limiter, /\$_SERVER\['REMOTE_ADDR'\]/);
});

test('les données sont compressées et les en-têtes de sécurité envoyés', async () => {
    const htaccess = await read('.htaccess');
    assert.match(htaccess, /AddOutputFilterByType BROTLI_COMPRESS application\/json/);
    assert.match(htaccess, /AddOutputFilterByType DEFLATE application\/json/);
    for (const header of ['X-Content-Type-Options "nosniff"', 'Referrer-Policy', 'Permissions-Policy', 'Strict-Transport-Security']) {
        assert.ok(htaccess.includes(`Header always set ${header}`), header);
    }
    const csp = htaccess.match(/Content-Security-Policy "([^"]+)"/)?.[1] || '';
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /script-src 'self' https:\/\/umami\.aubard\.net(;|$)/, 'pas de script en ligne ni d’autre hôte');
    assert.match(csp, /img-src 'self' data: https:\/\/tile\.openstreetmap\.org/);
    assert.match(csp, /object-src 'none'/);
});
