const ROUTE_ERROR_KEYS = {
  ADDRESS_NOT_FOUND_START: 'map.route.startNotFound',
  ADDRESS_NOT_FOUND_DESTINATION: 'map.route.destinationNotFound',
  ROUTE_NOT_FOUND: 'map.route.notFound',
  ROUTE_SERVICE_UNAVAILABLE: 'map.route.unavailable',
  NETWORK_ERROR: 'map.route.networkError',
  INVALID_RESPONSE: 'map.route.invalidResponse',
  INVALID_REQUEST: 'map.route.unavailable'
};

/**
 * Convertit exclusivement un code sémantique en clé d’interface.
 * Les réponses d’un ancien route.php, dépourvues de code, restent traitées
 * par le repli générique afin de rester compatibles pendant un déploiement FTP progressif.
 */
export function routeErrorKey({ code = '', networkError = false, responseValid = true } = {}) {
  if (networkError) return ROUTE_ERROR_KEYS.NETWORK_ERROR;
  if (!responseValid) return ROUTE_ERROR_KEYS.INVALID_RESPONSE;
  return ROUTE_ERROR_KEYS[code] || ROUTE_ERROR_KEYS.ROUTE_SERVICE_UNAVAILABLE;
}

export function locationErrorKey(error = {}) {
  if (error.code === 1) return 'map.location.denied';
  if (error.code === 2) return 'map.location.unavailable';
  if (error.code === 3) return 'map.location.timeout';
  return 'map.location.notFound';
}
