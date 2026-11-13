// La carte (Leaflet compris) n'est téléchargée qu'à sa première ouverture : Mon offre et
// Offres n'en ont pas besoin. Cet objet a la même interface que initStationsMap et garde
// les prix reçus en attendant que le module soit là.
export function initLazyStationsMap(options = {}, { load = () => import('./stations-map.js') } = {}) {
    let instance = null;
    let pending = null;
    let prices = null;

    function ensure() {
        pending ||= load()
            .then(module => {
                instance = module.initStationsMap(options);
                if (prices) instance.setPrices?.(prices);
                return instance;
            })
            .catch(error => {
                pending = null;
                options.onLoadError?.(error);
                throw error;
            });
        return pending;
    }

    return {
        activate() {
            return ensure().then(map => map.activate()).catch(() => {});
        },
        showOperator(key) {
            return ensure().then(map => map.showOperator?.(key)).catch(() => {});
        },
        setPrices(value) {
            prices = value;
            instance?.setPrices?.(value);
        },
        refreshLanguage() {
            instance?.refreshLanguage?.();
        }
    };
}
