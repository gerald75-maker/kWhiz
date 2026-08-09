export function routeErrorKey({ networkError = false, responseValid = true, message = '', start = '', destination = '' } = {}) {
  if (networkError) return 'map.route.networkError';
  if (!responseValid) return 'map.route.invalidResponse';
  if (message.startsWith('Adresse introuvable')) {
    if (start && message.includes(start)) return 'map.route.startNotFound';
    if (destination && message.includes(destination)) return 'map.route.destinationNotFound';
    return 'map.route.unavailable';
  }
  if (message.startsWith('Aucun itinéraire routier trouvé')) return 'map.route.notFound';
  return 'map.route.unavailable';
}

export function locationErrorKey(error = {}) {
  if (error.code === 1) return 'map.location.denied';
  if (error.code === 2) return 'map.location.unavailable';
  if (error.code === 3) return 'map.location.timeout';
  return 'map.location.notFound';
}
