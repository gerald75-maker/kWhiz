import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))

// Remplace __VERSION__ dans le HTML généré
function htmlVersion() {
  return {
    name: 'html-version',
    transformIndexHtml(html) {
      return html.replace(/__VERSION__/g, pkg.version)
    },
  }
}

export default defineConfig({
  plugins: [htmlVersion()],
  // Les assets statiques (manifest.json, sw.js, tarifs.json, icons/)
  // sont dans public/ et seront copiés tels quels dans dist/
  publicDir: 'public',

  build: {
    outDir: 'dist',
    emptyOutDir: false,
    // Hashes activés (comportement Vite par défaut) :
    // chaque déploiement produit des URLs uniques (ex: assets/index-a3f9c2.js)
    // → le SW Cache First ne peut jamais servir un ancien fichier pour une nouvelle version
    // → index.html (Network First) référence toujours les bons hashes → mise à jour automatique
  },

  server: {
    port: 5174,
    // Le service worker ne fonctionne pas en dev (normal avec Vite)
    // Pour tester le SW : npm run build && npm run preview
  },
})
