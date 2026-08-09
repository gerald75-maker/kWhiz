import { STORAGE_KEYS } from '../config/app-config.js';

export const LANGUAGES = Object.freeze({ fr: 'fr-FR', en: 'en-GB' });

const messages = {
  fr: {
    'app.title': 'kWhiz — Comparateur de recharge rapide VE',
    'app.description': 'Comparez les tarifs et abonnements des principaux réseaux de recharge rapide présents en France.',
    'manifest.description': 'Comparez les tarifs et abonnements des principaux réseaux de recharge rapide présents en France.',
    'nav.recommendation': 'Mon choix', 'nav.compare': 'Comparer', 'nav.networks': 'Opérateurs', 'nav.map': 'Carte', 'nav.menu': 'Menu',
    'menu.language.title': 'Langue', 'menu.language.french': 'Français', 'menu.language.english': 'English', 'menu.language.changed': 'Langue modifiée.',
    'about.enjoy': '🙏 Bonne utilisation !',
    'about.feedback': 'N’hésitez pas à faire part de vos remarques, suggestions ou compliments à',
    'about.otherApps': 'Mes autres applications',
    'common.close': 'Fermer', 'common.loading': 'Chargement…', 'common.checking': 'Vérification…',
    'theme.light': 'Passer au mode clair', 'theme.dark': 'Passer au mode sombre',
    'period.none': 'Sans abonnement', 'period.monthly': 'Mensuel', 'period.annual': 'Annuel',
    'format.monthly': '/mois', 'format.perKwh': '/kWh', 'format.per100km': '/100 km',
    'count.offer': '{count} offre', 'count.offers': '{count} offres',
    'count.station': '{count} station', 'count.stations': '{count} stations',
    'map.route.success': '{places} · {distance} · {stations} à moins de 15 km du trajet',
    'map.stationCount': '{count} station rapide', 'map.stationCounts': '{count} stations rapides',
    'map.distance': 'à {distance}',
    'map.station.upTo': 'jusqu’à {power} kW',
    'map.station.chargingPoint': '{count} point',
    'map.station.chargingPoints': '{count} points',
    'map.status.justUpdated': 'Statut à l’instant',
    'map.status.oneMinuteAgo': 'il y a 1 min',
    'map.status.minutesAgo': 'il y a {count} min',
    'map.status.oneAvailable': '1 libre sur {total}',
    'map.status.manyAvailable': '{count} libres sur {total}',
    'map.status.available': 'Libre',
    'map.status.occupied': 'Occupée',
    'map.status.occupiedOrReserved': 'Occupée ou réservée',
    'map.status.outOfService': 'Hors service',
    'map.status.unknown': 'Statut inconnu',
    'map.station.showOnMap': 'Afficher {name} sur la carte',
    'map.station.directions': 'Itinéraire',
    'map.station.directionsLabel': 'Itinéraire vers {name}',
    'map.station.startDirections': 'Lancer l’itinéraire',
    'map.station.selected': 'Station sélectionnée',
    'map.list.nearby': 'Stations proches du centre de la carte',
    'map.list.route': 'Stations sur votre trajet',
    'map.list.empty': 'Aucune station ne correspond aux réseaux sélectionnés dans cette zone.',
    'date.verified': 'Tarifs vérifiés le {date}',
    'date.updated': 'mises à jour le {date}',
    'recommendation.savings': 'Vous économisez {amount} par mois',
    'recommendation.monthlyCost': '{amount} par mois',
    'recommendation.noSubscription': 'Sans abonnement',
    'recommendation.subscriptionMonthly': '{amount}/mois d’abonnement',
    'profile.loadingPrices': 'Chargement des tarifs…',
    'profile.enterMileage': 'Indiquez votre kilométrage mensuel pour obtenir une recommandation.',
    'profile.noPlans': 'Aucune formule disponible.',
    'profile.why': 'Pourquoi ce choix ?',
    'profile.mileageAnalysed': 'Kilométrage analysé',
    'profile.fastCharging': 'Recharge rapide',
    'profile.breakEven': 'Seuil de rentabilité',
    'profile.share': 'Partager',
    'profile.estimatedMonthlyCost': 'Coût mensuel estimé',
    'profile.monthlyMileage': '{distance} km/mois',
    'profile.monthlyAmount': '{amount}/mois',
    'profile.annualAmount': '{amount} par an',
    'profile.perKwh': '{amount}/kWh',
    'recommendation.breakEvenImmediate': 'Rentable immédiatement',
    'recommendation.breakEvenUnreachable': 'Seuil non atteignable',
    'recommendation.lowestCostOne': 'Coût total le plus bas parmi {count} formule comparée.',
    'recommendation.lowestCostMany': 'Coût total le plus bas parmi {count} formules comparées.',
    'recommendation.savingsComparedWith': '{amount} économisés par mois face à {operator} {formula}.',
    'recommendation.smallGap': 'Écart très faible avec l’alternative suivante : le choix peut dépendre de la couverture du réseau.',
    'recommendation.subscriptionProfitable': 'Abonnement rentabilisé pour votre kilométrage, seuil : {threshold}.',
    'recommendation.subscriptionNotYetProfitable': 'Abonnement non encore rentabilisé pour votre kilométrage, seuil : {threshold}.',
    'recommendation.noSubscriptionReason': 'Sans abonnement : aucun coût fixe lorsque vous rechargez peu.',
    'recommendation.homeCharging': 'Le calcul inclut {percentage} de recharge à domicile à {rate}.',
    'recommendation.favoriteComparison': 'Comparaison avec votre favori',
    'recommendation.referencePlan': 'offre de référence',
    'recommendation.favoriteGap': '+{amount}',
    'recommendation.annualGap': '{amount} par an de moins',
    'recommendation.comparedWith': 'que {operator} · {formula}',
    'recommendation.lowestCost': 'coût le plus bas',
    'favorites.add': 'Ajouter aux favoris',
    'favorites.remove': 'Retirer des favoris',
    'share.copied': 'Résultat copié dans le presse-papiers.',
    'share.shared': 'Résultat partagé.',
    'share.unavailable': 'Partage impossible sur cet appareil.',
    'operators.subscriptionMonthly': '{amount}/mois',
    'operators.subscriptionAnnual': '{amount}/an',
    'operators.pricing.station': 'Tarif variable selon la station',
    'operators.pricing.range': 'Fourchette tarifaire',
    'operators.pricing.discount': 'Remise sur le tarif public',
    'operators.pricing.estimated': 'Prix estimé',
    'operators.pricing.published': 'Tarif publié',
    'operators.effectiveChargeback': 'Prix effectif avec ChargeBack',
    'operators.officialSource': 'Source officielle',
    'operators.chargers': 'Bornes {power}',
    'pwa.update.title': 'Mise à jour disponible',
    'pwa.update.description': 'Une nouvelle version est disponible. Voulez-vous mettre à jour maintenant ?',
    'pwa.update.refresh': 'Actualiser',
    'offerDetail.title': 'Détail de l’offre',
    'offerDetail.closeLabel': 'Fermer',
    'offerDetail.network': 'Réseau : {power}',
    'offerDetail.energyPrice': 'Prix de l’énergie',
    'offerDetail.subscription': 'Abonnement',
    'offerDetail.noSubscription': 'Sans abonnement',
    'offerDetail.monthlySubscription': '{amount}/mois',
    'offerDetail.annualSubscription': '{amount}/an, soit {monthlyAmount}/mois',
    'offerDetail.estimatedCost': 'Coût estimé',
    'offerDetail.costPer100km': '{amount}/100 km',
    'offerDetail.breakEven': 'Seuil de rentabilité',
    'offerDetail.noBreakEven': 'Sans seuil',
    'offerDetail.notProfitable': 'Non rentable',
    'offerDetail.breakEvenValue': '{distance} km/mois',
    'offerDetail.fixedPrice': 'Tarif fixe',
    'offerDetail.variablePrice': 'Tarif variable',
    'offerDetail.priceRange': 'Plage tarifaire',
    'offerDetail.discount': 'Remise officielle',
    'offerDetail.discountRange': 'Remise de {discount} · {range}',
    'offerDetail.variableEstimate': 'Tarif variable · estimation {rate}',
    'offerDetail.history.title': 'Historique tarifaire',
    'offerDetail.history.unknown': 'Pas encore d’historique',
    'offerDetail.history.stable': 'Tarif stable depuis le relevé précédent',
    'offerDetail.history.up': 'Tarif en hausse depuis le relevé précédent',
    'offerDetail.history.down': 'Tarif en baisse depuis le relevé précédent',
    'offerDetail.noVariation': 'Aucune variation',
    'offerDetail.unknownDate': 'Date inconnue',
    'offerDetail.validUntil': 'Conditions valables jusqu’au {date}',
    'offerDetail.estimateWarning': 'Le classement utilise une estimation, pas un prix garanti.',
    'offerDetail.officialSource': 'Consulter la source officielle',
    'offerDetail.operatorStations': 'Voir les bornes de l’opérateur',
    'tariffs.freshness.today': 'Tarifs vérifiés aujourd’hui',
    'tariffs.freshness.recentOne': 'Tarifs récents (1 jour)',
    'tariffs.freshness.recentMany': 'Tarifs récents ({count} jours)',
    'tariffs.freshness.stale': 'Tarifs à vérifier ({count} jours)',
    'tariffs.freshness.critical': 'Tarifs trop anciens ({count} jours)',
    'tariffs.freshness.unknown': 'Fraîcheur inconnue',
    'tariffs.source.online': 'source en ligne',
    'tariffs.source.localCache': 'cache local',
    'tariffs.source.offline': 'hors ligne',
    'tariffs.status.loading': 'Chargement…',
    'tariffs.status.unavailable': 'Indisponibles — derniers calculs conservés',
    'tariffs.status.unavailableCheckConnection': 'Tarifs indisponibles — vérifiez votre connexion',
    'tariffs.status.offlineEmbedded': 'Tarifs embarqués (hors ligne)',
    'tariffs.status.verifyBeforeChoosing': 'vérifiez avant de choisir',
    'tariffs.status.dateAndSource': '{date} · {source}',
    'tariffs.status.verifiedOn': 'Tarifs vérifiés le {date}',
    'tariffs.verifiedOn': 'Vérifié le {date}',
    'appStatus.badge.current': 'À jour',
    'appStatus.badge.offline': 'Hors ligne',
    'appStatus.badge.error': 'Indisponible',
    'appStatus.badge.checking': 'Vérification…',
    'appStatus.checking': 'Recherche d’une nouvelle version…',
    'appStatus.offline': 'Version installée utilisable hors ligne',
    'appStatus.current': 'Dernière version disponible installée',
    'appStatus.error': 'Vérification impossible',
    'appStatus.ready': 'Version installée prête à être vérifiée',
    'appStatus.initial': 'Vérification en cours',
    'install.openIn': 'Ouvrez kWhiz dans',
    'install.sectionEyebrow': 'Application web',
    'install.sectionTitle': 'Ajouter à l’écran d’accueil',
    'install.nativeButton': '📲 Installer kWhiz',
    'install.tap': 'Appuyez sur',
    'install.openMenu': 'Ouvrez le menu',
    'install.choose': 'Choisissez',
    'install.or': 'ou',
    'install.thenConfirm': 'puis confirmez',
    'install.share': 'Partager',
    'install.ios.addToHomeScreen': 'Sur l’écran d’accueil',
    'install.android.addToHomeScreen': 'Ajouter à l’écran d’accueil',
    'install.installApp': 'Installer l’application'
  },
  en: {
    'app.title': 'kWhiz — Fast EV charging price comparison',
    'app.description': 'Compare prices and subscriptions from major fast-charging networks operating in France.',
    'manifest.description': 'Compare prices and subscriptions from major fast-charging networks operating in France.',
    'nav.recommendation': 'My recommendation', 'nav.compare': 'Compare', 'nav.networks': 'Networks', 'nav.map': 'Map', 'nav.menu': 'Menu',
    'menu.language.title': 'Language', 'menu.language.french': 'Français', 'menu.language.english': 'English', 'menu.language.changed': 'Language updated.',
    'about.enjoy': '🙏 Enjoy using kWhiz!',
    'about.feedback': 'Feel free to send your comments, suggestions or compliments to',
    'about.otherApps': 'My other apps',
    'common.close': 'Close', 'common.loading': 'Loading…', 'common.checking': 'Checking…',
    'theme.light': 'Switch to light mode', 'theme.dark': 'Switch to dark mode',
    'period.none': 'No subscription', 'period.monthly': 'Monthly', 'period.annual': 'Annual',
    'format.monthly': '/month', 'format.perKwh': '/kWh', 'format.per100km': '/100 km',
    'count.offer': '{count} offer', 'count.offers': '{count} offers',
    'count.station': '{count} charger', 'count.stations': '{count} chargers',
    'map.route.success': '{places} · {distance} · {stations} within 15 km of the route',
    'map.stationCount': '{count} fast charger', 'map.stationCounts': '{count} fast chargers',
    'map.distance': '{distance} away',
    'map.station.upTo': 'up to {power} kW',
    'map.station.chargingPoint': '{count} charging point',
    'map.station.chargingPoints': '{count} charging points',
    'map.status.justUpdated': 'Status just updated',
    'map.status.oneMinuteAgo': '1 min ago',
    'map.status.minutesAgo': '{count} min ago',
    'map.status.oneAvailable': '1 available out of {total}',
    'map.status.manyAvailable': '{count} available out of {total}',
    'map.status.available': 'Available',
    'map.status.occupied': 'Occupied',
    'map.status.occupiedOrReserved': 'Occupied or reserved',
    'map.status.outOfService': 'Out of service',
    'map.status.unknown': 'Status unknown',
    'map.station.showOnMap': 'Show {name} on the map',
    'map.station.directions': 'Directions',
    'map.station.directionsLabel': 'Directions to {name}',
    'map.station.startDirections': 'Start directions',
    'map.station.selected': 'Selected charger',
    'map.list.nearby': 'Chargers near the centre of the map',
    'map.list.route': 'Chargers along your route',
    'map.list.empty': 'No charger matches the selected networks in this area.',
    'date.verified': 'Prices checked on {date}',
    'date.updated': 'updated on {date}',
    'recommendation.savings': 'You save {amount} per month',
    'recommendation.monthlyCost': '{amount} per month',
    'recommendation.noSubscription': 'No subscription',
    'recommendation.subscriptionMonthly': '{amount}/month subscription',
    'profile.loadingPrices': 'Loading prices…',
    'profile.enterMileage': 'Enter your monthly mileage to get a recommendation.',
    'profile.noPlans': 'No plans available.',
    'profile.why': 'Why this recommendation?',
    'profile.mileageAnalysed': 'Mileage analysed',
    'profile.fastCharging': 'Fast charging',
    'profile.breakEven': 'Break-even point',
    'profile.share': 'Share',
    'profile.estimatedMonthlyCost': 'Estimated monthly cost',
    'profile.monthlyMileage': '{distance} km/month',
    'profile.monthlyAmount': '{amount}/month',
    'profile.annualAmount': '{amount} per year',
    'profile.perKwh': '{amount}/kWh',
    'recommendation.breakEvenImmediate': 'Breaks even immediately',
    'recommendation.breakEvenUnreachable': 'Break-even cannot be reached',
    'recommendation.lowestCostOne': 'Lowest total cost among {count} plan compared.',
    'recommendation.lowestCostMany': 'Lowest total cost among {count} plans compared.',
    'recommendation.savingsComparedWith': '{amount} saved per month compared with {operator} {formula}.',
    'recommendation.smallGap': 'Very small difference from the next option: network coverage may determine the best choice.',
    'recommendation.subscriptionProfitable': 'The subscription pays for itself at your mileage, break-even: {threshold}.',
    'recommendation.subscriptionNotYetProfitable': 'The subscription does not yet pay for itself at your mileage, break-even: {threshold}.',
    'recommendation.noSubscriptionReason': 'No subscription: no fixed cost when you charge infrequently.',
    'recommendation.homeCharging': 'The calculation includes {percentage} home charging at {rate}.',
    'recommendation.favoriteComparison': 'Comparison with your favourite',
    'recommendation.referencePlan': 'reference plan',
    'recommendation.favoriteGap': '+{amount}',
    'recommendation.annualGap': '{amount} less per year',
    'recommendation.comparedWith': 'than {operator} · {formula}',
    'recommendation.lowestCost': 'lowest cost',
    'favorites.add': 'Add to favourites',
    'favorites.remove': 'Remove from favourites',
    'share.copied': 'Result copied to the clipboard.',
    'share.shared': 'Result shared.',
    'share.unavailable': 'Sharing is unavailable on this device.',
    'operators.subscriptionMonthly': '{amount}/month',
    'operators.subscriptionAnnual': '{amount}/year',
    'operators.pricing.station': 'Variable price depending on the station',
    'operators.pricing.range': 'Price range',
    'operators.pricing.discount': 'Discount on the public price',
    'operators.pricing.estimated': 'Estimated price',
    'operators.pricing.published': 'Published price',
    'operators.effectiveChargeback': 'Effective price with ChargeBack',
    'operators.officialSource': 'Official source',
    'operators.chargers': 'Chargers {power}',
    'pwa.update.title': 'Update available',
    'pwa.update.description': 'A new version is available. Update now?',
    'pwa.update.refresh': 'Update',
    'offerDetail.title': 'Plan details',
    'offerDetail.closeLabel': 'Close',
    'offerDetail.network': 'Network: {power}',
    'offerDetail.energyPrice': 'Energy price',
    'offerDetail.subscription': 'Subscription',
    'offerDetail.noSubscription': 'No subscription',
    'offerDetail.monthlySubscription': '{amount}/month',
    'offerDetail.annualSubscription': '{amount}/year, equivalent to {monthlyAmount}/month',
    'offerDetail.estimatedCost': 'Estimated cost',
    'offerDetail.costPer100km': '{amount}/100 km',
    'offerDetail.breakEven': 'Break-even point',
    'offerDetail.noBreakEven': 'No break-even point',
    'offerDetail.notProfitable': 'Not cost-effective',
    'offerDetail.breakEvenValue': '{distance} km/month',
    'offerDetail.fixedPrice': 'Fixed price',
    'offerDetail.variablePrice': 'Variable price',
    'offerDetail.priceRange': 'Price range',
    'offerDetail.discount': 'Official discount',
    'offerDetail.discountRange': '{discount} discount · {range}',
    'offerDetail.variableEstimate': 'Variable price · estimated {rate}',
    'offerDetail.history.title': 'Price history',
    'offerDetail.history.unknown': 'No price history yet',
    'offerDetail.history.stable': 'Price unchanged since the previous record',
    'offerDetail.history.up': 'Price increased since the previous record',
    'offerDetail.history.down': 'Price decreased since the previous record',
    'offerDetail.noVariation': 'No change',
    'offerDetail.unknownDate': 'Unknown date',
    'offerDetail.validUntil': 'Terms valid until {date}',
    'offerDetail.estimateWarning': 'The ranking uses an estimate, not a guaranteed price.',
    'offerDetail.officialSource': 'View official source',
    'offerDetail.operatorStations': 'View this network’s chargers',
    'tariffs.freshness.today': 'Prices checked today',
    'tariffs.freshness.recentOne': 'Recent prices (1 day)',
    'tariffs.freshness.recentMany': 'Recent prices ({count} days)',
    'tariffs.freshness.stale': 'Prices need checking ({count} days)',
    'tariffs.freshness.critical': 'Prices are too old ({count} days)',
    'tariffs.freshness.unknown': 'Unknown freshness',
    'tariffs.source.online': 'online source',
    'tariffs.source.localCache': 'local cache',
    'tariffs.source.offline': 'offline',
    'tariffs.status.loading': 'Loading…',
    'tariffs.status.unavailable': 'Unavailable — keeping the latest calculations',
    'tariffs.status.unavailableCheckConnection': 'Prices unavailable — check your connection',
    'tariffs.status.offlineEmbedded': 'Bundled prices (offline)',
    'tariffs.status.verifyBeforeChoosing': 'check before choosing',
    'tariffs.status.dateAndSource': '{date} · {source}',
    'tariffs.status.verifiedOn': 'Prices checked on {date}',
    'tariffs.verifiedOn': 'Verified on {date}',
    'appStatus.badge.current': 'Up to date',
    'appStatus.badge.offline': 'Offline',
    'appStatus.badge.error': 'Unavailable',
    'appStatus.badge.checking': 'Checking…',
    'appStatus.checking': 'Checking for a new version…',
    'appStatus.offline': 'Installed version available offline',
    'appStatus.current': 'Latest available version installed',
    'appStatus.error': 'Unable to check',
    'appStatus.ready': 'Installed version ready to check',
    'appStatus.initial': 'Checking',
    'install.openIn': 'Open kWhiz in',
    'install.sectionEyebrow': 'Web app',
    'install.sectionTitle': 'Add to Home Screen',
    'install.nativeButton': '📲 Install kWhiz',
    'install.tap': 'Tap',
    'install.openMenu': 'Open the menu',
    'install.choose': 'Choose',
    'install.or': 'or',
    'install.thenConfirm': 'then confirm',
    'install.share': 'Share',
    'install.ios.addToHomeScreen': 'Add to Home Screen',
    'install.android.addToHomeScreen': 'Add to Home Screen',
    'install.installApp': 'Install app'
  }
};

const phrases = {
  'L’offre la moins chère selon votre usage': 'The lowest-cost plan for your usage',
  'Tirez pour actualiser': 'Pull to refresh', 'Relâchez pour actualiser': 'Release to refresh', 'Actualisation…': 'Refreshing…',
  'Connexion active': 'Online', 'Connexion indisponible — derniers tarifs enregistrés': 'Offline — showing saved prices',
  'Fermer': 'Close', 'Fermer le menu': 'Close menu', 'Rechercher une offre ou un opérateur': 'Search for a plan or network',
  'Consommation du véhicule': 'Vehicle efficiency', 'Consommation en kWh par 100 km': 'Consumption in kWh per 100 km',
  'Citadine': 'City car', 'Berline': 'Saloon', 'Van': 'Van',
  'Recharge rapide DC': 'DC fast charging', 'Comparer': 'Compare', 'Comparer les offres': 'Compare plans',
  'Indiquez votre kilométrage mensuel. kWhiz estime le coût de chaque formule, abonnement compris, selon votre véhicule et votre part de recharge rapide.': 'Enter your monthly mileage. kWhiz estimates each plan’s cost, including the subscription, based on your vehicle and fast-charging share.',
  'Rechercher un opérateur ou une formule': 'Search for a network or plan', 'Kilométrage mensuel': 'Monthly mileage', 'Kilométrage mensuel en km': 'Monthly mileage in kilometres',
  'Modifier mon profil': 'Edit my profile', 'Prix du kWh': 'Price per kWh', 'Opérateur': 'Network', 'Opérateurs': 'Networks',
  'Réseaux de recharge rapide': 'Fast-charging networks', 'Opérateurs et formules': 'Networks and plans',
  'Consultez les prix publiés, les abonnements et leur seuil de rentabilité.': 'View published prices, subscriptions and their break-even point.',
  'Afficher le détail des prix': 'Show price details', 'Bornes rapides en France': 'Fast chargers in France', 'Carte des stations': 'Charger map',
  'Sélectionnez un ou plusieurs opérateurs. Les résultats correspondent à l’un des réseaux choisis.': 'Select one or more networks. Results include chargers from any selected network.',
  'Chargement des stations…': 'Loading chargers…', 'Me localiser': 'Find me', 'Stations sur mon trajet': 'Chargers along my route',
  'Départ': 'Start', 'Arrivée': 'Destination', 'Ville, adresse ou code postal en France': 'Town, address or postcode in France',
  'Ville, adresse ou code postal en France pour le départ': 'Town, address or postcode in France for the start',
  'Ville, adresse ou code postal en France pour l’arrivée': 'Town, address or postcode in France for the destination',
  'Ma position': 'My location', 'Afficher les stations': 'Show chargers', 'Effacer le trajet': 'Clear route',
  'Tous': 'All', 'Aucun': 'None', 'Carte des stations de recharge rapide': 'Fast-charger map',
  'Stations proches du centre de la carte': 'Chargers near the centre of the map',
  'Données : Base nationale IRVE, mises à jour le': 'Data: French national IRVE database, updated on',
  'La présence d’une station ne garantit pas sa disponibilité en temps réel.': 'A listed charger may not be available in real time.',
  'Estimation personnalisée': 'Personal estimate', 'Votre recharge rapide, au juste prix': 'Pay the right price for fast charging',
  'Ajustez votre usage. kWhiz compare le coût total des offres sans masquer les abonnements.': 'Adjust your usage. kWhiz compares total plan costs, including subscriptions.',
  'Mon profil': 'My profile', 'Mon profil de recharge': 'My charging profile', 'Calcul instantané': 'Instant calculation',
  'Kilométrage mensuel': 'Monthly mileage', 'Autre…': 'Other…', 'Kilométrage mensuel en km': 'Monthly mileage in km', 'km/mois': 'km/month',
  'Part rechargée sur bornes rapides': 'Share charged at fast chargers', 'Diminuer le pourcentage': 'Decrease percentage', 'Augmenter le pourcentage': 'Increase percentage',
  'Le reste est calculé au tarif domicile. La consommation du véhicule se règle en haut de l’écran.': 'The remainder uses the home-charging price. Set vehicle efficiency at the top of the screen.',
  'Classement': 'Ranking', 'Les 3 meilleures offres': 'Top 3 plans', 'Coût mensuel estimé': 'Estimated monthly cost',
  'Voir le classement complet': 'View full ranking', 'Formule': 'Plan', '€/mois': '€/month',
  'Trouvez l’offre de recharge rapide adaptée à votre usage': 'Find the right fast-charging plan for your usage',
  'Indiquez la consommation de votre véhicule et votre kilométrage mensuel.': 'Enter your vehicle efficiency and monthly mileage.',
  'Comparez les tarifs et abonnements des principaux réseaux de recharge rapide présents en France.': 'Compare prices and subscriptions from major fast-charging networks operating in France.',
  'Localisez les stations autour de vous ou sur votre trajet.': 'Find chargers near you or along your route.',
  'Commencer': 'Get started', 'Comment fonctionne kWhiz ?': 'How does kWhiz work?',
  'À propos': 'About', 'À propos de kWhiz': 'About kWhiz', 'Projet, version et contact': 'Project, version and contact',
  'kWhiz rend les tarifs de recharge rapide plus faciles à comprendre et à comparer.': 'kWhiz makes fast-charging prices easier to understand and compare.',
  'kWhiz est conçu pour comparer une sélection de réseaux de recharge rapide présents en France. L’application ne prétend pas couvrir tous les opérateurs ni les tarifs proposés dans les autres pays.': 'kWhiz is designed to compare a selection of fast-charging networks operating in France. It does not aim to cover every network or prices available in other countries.',
  'kWhiz est gratuit. Vos préférences et vos données d’usage restent enregistrées localement sur votre appareil.': 'kWhiz is free. Your preferences and usage data remain stored locally on your device.',
  'Données et réglages': 'Data and settings', 'Actualisation, sauvegarde et installation': 'Updates, backup and installation',
  'État de l’application': 'App status', 'Vérification…': 'Checking…', 'Vérification en cours': 'Checking', 'Application': 'Application',
  'Tarifs': 'Prices', 'Chargement…': 'Loading…', 'Fraîcheur': 'Freshness', 'Analyse…': 'Checking…',
  'Actualiser l’application et les tarifs': 'Update app and prices', 'Préférences locales': 'Local preferences',
  'Exporter ou restaurer': 'Export or restore', 'Exportez vos favoris, mode d’affichage et préférences dans un fichier, puis restaurez-les sur un autre appareil.': 'Export your favourites, display mode and preferences to a file, then restore them on another device.',
  'Exporter': 'Export', 'Restaurer': 'Restore',
  'iOS / iPhone': 'iOS / iPhone', 'Android': 'Android', 'Partager': 'Share', 'Ajouter': 'Add', 'Installer': 'Install',
  'Aide et FAQ': 'Help and FAQ', 'Utiliser le comparateur et la carte': 'Using the comparison and map',
  'Bien démarrer': 'Getting started', 'Comprendre les résultats': 'Understanding results', 'Utiliser la carte': 'Using the map', 'Questions fréquentes': 'Frequently asked questions',
  'Besoin d’un véritable planificateur de recharge ?': 'Need a full EV route planner?',
  'Tarifs et sources': 'Prices and sources', 'Méthode, vérification et limites': 'Method, checks and limitations',
  'Formule de calcul': 'Calculation formula', 'Notes importantes': 'Important notes', 'Astuce multi-réseaux': 'Multi-network tip', 'Sources :': 'Sources:',
  'Ouvrir l’itinéraire': 'Open directions', 'Choisir votre GPS': 'Choose your navigation app',
  'Application ou navigateur': 'App or browser', 'L’application GPS s’ouvre si elle est installée. Sinon, le service s’affiche dans le navigateur.': 'The navigation app opens if installed; otherwise the service opens in your browser.',
  'Mon choix': 'My recommendation', 'Mon choix personnalisé': 'My recommendation', 'Carte': 'Map', 'Carte des bornes': 'Charger map',
  'Comparateur de recharge rapide': 'Fast-charging comparison', 'Menu kWhiz': 'kWhiz menu', 'Comprendre': 'Learn',
  'Apparence': 'Appearance', 'Mode clair ou sombre': 'Light or dark mode', 'Données sourcées': 'Sourced data',
  'Recherche d’une nouvelle version…': 'Checking for a new version…', 'Mise à jour de kWhiz…': 'Updating kWhiz…', 'kWhiz a été mis à jour': 'kWhiz has been updated',
  'Tarifs actualisés': 'Prices updated', 'Actualisation impossible': 'Unable to update',
  'Mode hors ligne — derniers tarifs enregistrés': 'Offline — showing saved prices', 'Connexion rétablie — actualisation…': 'Back online — updating…',
  'Connexion rétablie, mais les tarifs restent indisponibles': 'Back online, but prices are still unavailable', 'Connexion rétablie — tarifs actualisés': 'Back online — prices updated',
  'Connexion rétablie, mais l’actualisation a échoué': 'Back online, but the update failed',
  'Aucune formule ne correspond à cette recherche.': 'No plan matches this search.',
  'Ajouter aux favoris': 'Add to favourites', 'Retirer des favoris': 'Remove from favourites', 'Partager': 'Share',
  'Sans seuil': 'No break-even point', 'Non rentable': 'Not cost-effective', 'Rentabilité': 'Break-even', 'Coût': 'Cost', 'Abonnement': 'Subscription',
  'Tarif': 'Price', 'Tarif fixe': 'Fixed price', 'Tarif variable': 'Variable price', 'Plage tarifaire': 'Price range', 'Remise': 'Discount',
  'Source officielle': 'Official source', 'Vérifié le': 'Checked on',
  'Recharge rapide': 'Fast charging', 'Seuil de rentabilité': 'Break-even point',
  'Carte indisponible': 'Map unavailable', 'Les stations n’ont pas pu être chargées. Réessayez lorsque la connexion est disponible.': 'Chargers could not be loaded. Try again when you are online.',
  'Calcul de l’itinéraire…': 'Calculating route…', 'Itinéraire indisponible': 'Route unavailable', 'Stations sur votre trajet': 'Chargers along your route',
  'Service d’itinéraire indisponible. Réessayez dans quelques instants.': 'Route service unavailable. Try again shortly.', 'Recentrer': 'Re-centre',
  'Localisation indisponible': 'Location unavailable', 'Localisation…': 'Locating…', 'Position introuvable': 'Location not found',
  'La position actuelle sera utilisée comme départ.': 'Your current location will be used as the start.', 'La localisation n’est pas disponible sur cet appareil.': 'Location is unavailable on this device.',
  'Localisation refusée ou indisponible. Vérifiez les réglages de localisation de votre navigateur.': 'Location was denied or is unavailable. Check your browser location settings.',
  'Itinéraire': 'Directions', 'Afficher sur la carte': 'Show on map', 'libre': 'available', 'occupé': 'in use', 'hors service': 'out of service', 'statut inconnu': 'status unknown',
  'Comment obtenir une recommandation personnalisée ?': 'How do I get a personalised recommendation?'
  ,'Réglez la consommation du véhicule, indiquez votre kilométrage mensuel et précisez la part de recharge rapide. L’onglet « Mon choix » affiche alors les offres les moins chères pour ce profil.': 'Set your vehicle efficiency, monthly mileage and fast-charging share. “My recommendation” then shows the lowest-cost plans for that profile.'
  ,'Que signifie la part de recharge rapide ?': 'What does the fast-charging share mean?'
  ,'Il s’agit de la proportion de votre énergie rechargée sur des bornes rapides. Le reste est estimé au tarif de recharge à domicile.': 'It is the share of your energy charged at fast chargers. The rest is estimated at the home-charging price.'
  ,'Les abonnements sont-ils pris en compte ?': 'Are subscriptions included?'
  ,'Oui. Leur coût, mensuel ou annualisé, est intégré au calcul du coût total.': 'Yes. Their monthly or annualised cost is included in the total.'
  ,'Qu’est-ce que le seuil de rentabilité ?': 'What is the break-even point?'
  ,'C’est le kilométrage mensuel à partir duquel l’économie réalisée sur le prix du kWh compense le coût de l’abonnement.': 'It is the monthly mileage at which per-kWh savings offset the subscription cost.'
  ,'Pourquoi le classement change-t-il ?': 'Why does the ranking change?'
  ,'Il dépend de la consommation du véhicule, du kilométrage, de la part de recharge rapide, du prix du kWh et du coût des abonnements.': 'It depends on vehicle efficiency, mileage, fast-charging share, the per-kWh price and subscription costs.'
  ,'Pourquoi certains tarifs sont-ils variables ou estimés ?': 'Why are some prices variable or estimated?'
  ,'Certains opérateurs adaptent leurs prix selon la station, l’horaire ou le moyen de paiement. kWhiz utilise alors une valeur représentative, clairement signalée comme une estimation.': 'Some networks vary prices by charger, time or payment method. kWhiz then uses a representative value clearly marked as an estimate.'
  ,'Les tarifs sont-ils garantis ?': 'Are prices guaranteed?'
  ,'Non. Les opérateurs peuvent les modifier sans préavis. Vérifiez toujours le prix affiché par l’opérateur avant de lancer une recharge.': 'No. Networks may change them without notice. Always check the price shown by the network before charging.'
  ,'Pourquoi la carte ne trouve-t-elle pas ma position ?': 'Why can’t the map find my location?'
  ,'Vérifiez que la localisation est autorisée pour Safari ou pour la PWA dans les réglages de l’appareil, puis appuyez de nouveau sur « Me localiser ».': 'Allow location access for Safari or the PWA in your device settings, then tap “Find me” again.'
  ,'Les bornes affichées sont-elles disponibles ?': 'Are the displayed chargers available?'
  ,'Pas nécessairement. La carte recense les stations déclarées dans la Base nationale IRVE ; vérifiez leur disponibilité dans l’application de l’opérateur avant de vous déplacer.': 'Not necessarily. The map lists chargers declared in the French IRVE database; check availability in the network’s app before travelling.'
  ,'Comment interpréter le statut d’une station ?': 'How should I interpret charger status?'
  ,'Seules les informations complètes datant de moins de 15 minutes sont colorées. Le statut est indicatif et peut changer avant votre arrivée ; ne supprimez pas une étape de votre trajet sur cette seule information.': 'Only complete information less than 15 minutes old is colour-coded. Status is indicative and may change before arrival; do not remove a planned stop based on this alone.'
  ,'Comment trouver les stations sur un trajet ?': 'How do I find chargers along a route?'
  ,'Dans l’onglet Carte, sélectionnez d’abord les opérateurs à afficher. Ouvrez ensuite « Stations sur mon trajet », utilisez votre position ou saisissez le départ, indiquez l’arrivée, puis lancez la recherche. kWhiz montre les stations des réseaux choisis situées à moins de 15 km du tracé. « Effacer le trajet » restaure la carte habituelle.': 'On the Map tab, select the networks to display. Open “Chargers along my route”, use your location or enter a start and destination, then search. kWhiz shows selected-network chargers within 15 km of the route. “Clear route” restores the normal map.'
  ,'kWhiz planifie-t-il mes arrêts de recharge ?': 'Does kWhiz plan my charging stops?'
  ,'Non. Le trajet sert uniquement à repérer les stations des opérateurs sélectionnés. kWhiz ne connaît ni votre batterie ni votre autonomie et ne décide pas où vous devez vous arrêter. Après avoir choisi une station, le bouton « Itinéraire » lance simplement votre application GPS vers cette borne.': 'No. The route only locates chargers from selected networks. kWhiz does not know your battery or range and does not decide where to stop. After selecting a charger, “Directions” simply opens your navigation app for that charger.'
  ,'À quoi servent les favoris ?': 'What are favourites for?'
  ,'L’étoile permet de retrouver plus facilement vos formules préférées et de les faire apparaître en priorité dans la liste des opérateurs.': 'The star makes favourite plans easier to find and moves them up the network list.'
  ,'Mes réglages sont-ils sauvegardés ?': 'Are my settings saved?'
  ,'Ils sont conservés localement sur votre appareil. Depuis « Données et réglages » dans le menu, vous pouvez les exporter dans un fichier et les restaurer sur un autre appareil.': 'They are stored locally on your device. From “Data and settings”, you can export them to a file and restore them on another device.'
  ,'L’application fonctionne-t-elle hors ligne ?': 'Does the app work offline?'
  ,'Oui, si elle a déjà été chargée ou installée. Elle utilise alors les derniers tarifs enregistrés et signale que la connexion est indisponible.': 'Yes, after it has been loaded or installed once. It then uses the latest saved prices and indicates that you are offline.'
  ,'Comment actualiser l’application et les tarifs ?': 'How do I update the app and prices?'
  ,'Ouvrez « Données et réglages » puis utilisez le bouton d’actualisation, ou tirez la page vers le bas. Si une nouvelle version est disponible, kWhiz vous proposera de l’installer.': 'Open “Data and settings” and use the update button, or pull the page down. If a new version is available, kWhiz will offer to install it.'
  ,'🕐 Izivia Fast — horaires Happy Hours': '🕐 Izivia Fast — Happy Hours times'
  ,'Les bornes Izivia Fast chez': 'Izivia Fast chargers at'
  ,'appliquent un tarif réduit en dehors des heures de pointe.': 'offer a reduced price outside peak hours.'
  ,'Heures creuses : 0,30 €/kWh': 'Off-peak: €0.30/kWh', 'Heures pleines : 0,35 €/kWh': 'Peak: €0.35/kWh', 'Astuce :': 'Tip:'
  ,'Planifiez votre recharge entre 9 h et 11 h 30 ou entre 15 h et 18 h pour bénéficier du tarif le plus avantageux.': 'Charge between 9:00–11:30 or 15:00–18:00 for the lowest price.'
  ,'Programme lancé en juillet 2026 pour fluidifier les bornes pendant les grands départs : deux façons de gagner des': 'Launched in July 2026 to reduce congestion during busy travel periods, with two ways to earn'
  ,'kWh gratuits': 'free kWh', ', cumulables sur votre compte IONITY.': ', which can be combined in your IONITY account.'
  ,'Débranchez avant 85 % de batterie, pour une recharge démarrée entre 9 h et 17 h.': 'Unplug before 85% after starting a session between 09:00 and 17:00.'
  ,'Rechargez la nuit, entre 22 h et 6 h, quel que soit le niveau de batterie final.': 'Charge overnight between 22:00 and 06:00, regardless of the final battery level.'
  ,'. Le crédit est visible dans l’application IONITY (rubrique « Credits & Rewards ») et déduit automatiquement lors de la recharge suivante. Les conditions peuvent varier selon le marché et la période.': '. Credit appears in the IONITY app under “Credits & Rewards” and is automatically used on your next charge. Terms may vary by market and period.'
  ,'Réglez votre': 'Set your', 'consommation moyenne': 'average consumption', 'en kWh/100 km à l’aide du curseur situé en haut de l’écran.': 'in kWh/100 km using the slider at the top of the screen.'
  ,'affiche immédiatement l’offre la plus avantageuse selon votre consommation et votre kilométrage mensuel.': 'immediately shows the best-value plan for your efficiency and monthly mileage.'
  ,'classe tous les opérateurs du moins cher au plus cher, abonnement compris.': 'ranks all networks from lowest to highest total cost, including subscriptions.'
  ,'présente le détail de chaque offre ainsi que son seuil de rentabilité.': 'shows each plan’s details and break-even point.'
  ,'affiche les stations rapides en France. Sélectionnez un ou plusieurs opérateurs, puis déplacez la carte pour consulter les stations proches du centre affiché.': 'shows fast chargers in France. Select one or more networks, then move the map to view chargers near its centre.'
  ,'Mon choix estime le coût mensuel selon votre consommation, votre kilométrage et votre part de recharge rapide. Comparer classe les offres, abonnement compris, tandis qu’Opérateurs en présente les conditions et le seuil de rentabilité.': 'My recommendation estimates monthly cost from your efficiency, mileage and fast-charging share. Compare ranks plans including subscriptions, while Networks shows their terms and break-even point.'
  ,'Les prix variables restent des estimations : confirmez toujours le tarif dans l’application ou sur le site de l’opérateur avant de recharger.': 'Variable prices remain estimates: always confirm the price in the network’s app or website before charging.'
  ,'📍 La carte utilise la Base nationale IRVE. Elle indique l’emplacement et les caractéristiques déclarées des stations, mais pas leur disponibilité en temps réel.': '📍 The map uses the French national IRVE database. It shows declared locations and specifications, not real-time availability.'
  ,'🟢 Les statuts libre, occupé ou hors service ne sont colorés que si l’information complète date de moins de 15 minutes. Un statut gris est absent, inconnu ou trop ancien et ne doit pas être interprété comme une indisponibilité.': '🟢 Available, in-use or out-of-service statuses are colour-coded only when complete data is under 15 minutes old. Grey means missing, unknown or old data, not necessarily unavailable.'
  ,'Sélectionnez les opérateurs, ouvrez': 'Select the networks, open', ', puis utilisez votre position ou saisissez une ville, une adresse ou un code postal en France. Les lieux sont transmis à OpenRouteService uniquement pour calculer le tracé.': ', then use your location or enter a town, address or French postcode. Places are sent to OpenRouteService only to calculate the route.'
  ,'kWhiz repère les stations sur un trajet, mais ne calcule pas les arrêts selon la batterie.': 'kWhiz finds chargers along a route but does not calculate battery-based stops.'
  ,'Il ne tient compte ni de l’autonomie, ni du niveau de batterie, du relief, de la météo ou du temps de recharge.': 'It does not account for range, battery level, terrain, weather or charging time.'
  ,'Pour calculer les arrêts selon le véhicule, la batterie et l’autonomie, utilisez un outil spécialisé :': 'To calculate stops for your vehicle, battery and range, use a dedicated planner:'
  ,'— itinéraires, bornes et disponibilité.': '— routes, chargers and availability.', '— planification avancée selon le véhicule.': '— advanced vehicle-based planning.', '— trajets et données communautaires.': '— routes and community data.', '— planification et réseau IECharge.': '— planning and the IECharge network.', '— itinéraires adaptés au véhicule.': '— vehicle-adapted routes.'
  ,'Les résultats sont des estimations fondées sur les tarifs publiés et les hypothèses affichées. Ils ne garantissent ni le prix facturé par l’opérateur ni la disponibilité d’une station.': 'Results are estimates based on published prices and displayed assumptions. They do not guarantee the price charged or charger availability.'
  ,'kWh min./mois = coût de l’abonnement ÷ (tarif de référence − tarif abonné)': 'min. kWh/month = subscription cost ÷ (reference price − subscriber price)'
  ,'km min./mois = kWh min. ÷ (consommation / 100)': 'min. km/month = min. kWh ÷ (consumption / 100)'
  ,': tarif fixe de 0,25 €/kWh': ': fixed price of €0.25/kWh', ': super heures creuses de 0,12 à 0,17 €/kWh la nuit': ': overnight super off-peak price of €0.12–€0.17/kWh'
  ,'permet d’accéder à de nombreux réseaux partenaires. Les prix varient selon la borne et doivent être confirmés dans l’application avant la recharge.': 'provides access to many partner networks. Prices vary by charger and must be confirmed in the app before charging.'
};

let currentLanguage = 'fr';
let observer;
const listeners = new Set();
const originalNodes = new WeakMap();
const originalAttrs = new WeakMap();

export function detectInitialLanguage({ storedLanguage, deviceLanguage = '' } = {}) {
  if (storedLanguage === 'fr' || storedLanguage === 'en') return storedLanguage;
  return deviceLanguage.toLowerCase().startsWith('en') ? 'en' : 'fr';
}

export function getLanguage() { return currentLanguage; }
export function getLocale() { return LANGUAGES[currentLanguage]; }

export function t(key, params = {}) {
  const template = messages[currentLanguage][key] ?? messages.fr[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? `{${name}}`);
}

export function formatTariffsFreshness({ state = 'unknown', ageDays = null } = {}) {
  if (state === 'fresh' && ageDays === 0) return t('tariffs.freshness.today');
  if (state === 'fresh' && ageDays === 1) return t('tariffs.freshness.recentOne');
  if (state === 'fresh') return t('tariffs.freshness.recentMany', { count: formatNumber(ageDays) });
  if (state === 'stale') return t('tariffs.freshness.stale', { count: formatNumber(ageDays) });
  if (state === 'critical') return t('tariffs.freshness.critical', { count: formatNumber(ageDays) });
  return t('tariffs.freshness.unknown');
}

export function formatTariffsStatusLine(updatedAt, source = 'online') {
  return t('tariffs.status.dateAndSource', {
    date: formatDate(updatedAt),
    source: t(`tariffs.source.${source}`)
  });
}

export function formatTariffsVerifiedOn(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return t('tariffs.verifiedOn', { date: formatDate(date) });
}

export function formatNumber(value, options) { return new Intl.NumberFormat(getLocale(), options).format(value); }
export function formatCurrency(value, options = {}) { return formatNumber(value, { style: 'currency', currency: 'EUR', ...options }); }
export function formatPercentage(value, options = {}) { return formatNumber(value / 100, { style: 'percent', ...options }); }
export function formatDate(value, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat(getLocale(), options).format(date);
}
export function formatDistance(km) { return new Intl.NumberFormat(getLocale(), { style: 'unit', unit: 'kilometer', unitDisplay: 'short', maximumFractionDigits: 1 }).format(km); }
export function plural(key, count, params = {}) { return t(count === 1 ? key : `${key}s`, { count: formatNumber(count), ...params }); }

function translateText(text) {
  if (currentLanguage === 'fr') return text;
  const leading = text.match(/^\s*/)?.[0] || '';
  const trailing = text.match(/\s*$/)?.[0] || '';
  const clean = text.trim();
  const translated = phrases[clean] || TRANSLATED_TARIFF_TEXT[clean];
  return clean && translated ? `${leading}${translated}${trailing}` : text;
}

function translateNode(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (node.parentElement?.closest('script, style, code, [data-i18n-skip]')) continue;
    if (!originalNodes.has(node)) originalNodes.set(node, node.nodeValue);
    const original = originalNodes.get(node);
    node.nodeValue = currentLanguage === 'fr' ? original : translateText(original);
  }
  const elements = root.nodeType === Node.ELEMENT_NODE ? [root, ...root.querySelectorAll('*')] : [...root.querySelectorAll('*')];
  for (const element of elements) {
    if (element.closest?.('[data-i18n-skip]')) continue;
    if (!originalAttrs.has(element)) originalAttrs.set(element, {});
    const saved = originalAttrs.get(element);
    for (const attr of ['aria-label', 'title', 'placeholder', 'alt']) {
      if (!element.hasAttribute(attr)) continue;
      if (!(attr in saved)) saved[attr] = element.getAttribute(attr);
      element.setAttribute(attr, currentLanguage === 'fr' ? saved[attr] : (phrases[saved[attr]] || saved[attr]));
    }
  }
}

export function translateDocument(root = document) {
  document.documentElement.lang = currentLanguage;
  document.title = t('app.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('app.description'));
  translateNode(root);
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel)));
}

export function setLanguage(language, { persist = true, storage = globalThis.localStorage, translate = true } = {}) {
  if (!LANGUAGES[language]) return false;
  currentLanguage = language;
  if (persist) storage?.setItem(STORAGE_KEYS.language, language);
  if (translate && typeof document !== 'undefined') translateDocument();
  listeners.forEach(listener => listener(language));
  if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('kwhiz:languagechange', { detail: { language, locale: getLocale() } }));
  return true;
}

export function onLanguageChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }

export function initI18n({ storage = localStorage, deviceLanguage = navigator.language } = {}) {
  currentLanguage = detectInitialLanguage({ storedLanguage: storage.getItem(STORAGE_KEYS.language), deviceLanguage });
  translateDocument();
  observer?.disconnect();
  observer = new MutationObserver(records => {
    observer.disconnect();
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (!originalNodes.has(node)) originalNodes.set(node, node.nodeValue);
        node.nodeValue = currentLanguage === 'fr' ? originalNodes.get(node) : translateText(originalNodes.get(node));
      } else if (node.nodeType === Node.ELEMENT_NODE) translateNode(node);
    }));
    observer.observe(document.body, { childList: true, subtree: true });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return currentLanguage;
}

const COMMERCIAL_LABELS = Object.freeze({
  'Tarif unique': 'Standard price',
  'Application Electra - prix variable': 'Electra app — variable price',
  'Electra+ Essential - mensuel': 'Electra+ Essential — monthly',
  'Electra+ Essential - annuel': 'Electra+ Essential — annual',
  'Electra+ Smart - mensuel': 'Electra+ Smart — monthly',
  'Electra+ Smart - annuel': 'Electra+ Smart — annual',
  'Paiement par badge ou carte': 'Charging card or bank card payment',
  'Sans abonnement': 'No subscription',
  'Abonnement mensuel': 'Monthly subscription',
  'Abonnement annuel': 'Annual subscription',
  'Paiement direct': 'Direct payment',
  'Application IONITY': 'IONITY app',
  'IONITY Motion - mensuel': 'IONITY Motion — monthly',
  'IONITY Motion 365 - annuel': 'IONITY Motion 365 — annual',
  'IONITY Power - mensuel': 'IONITY Power — monthly',
  'IONITY Power 365 - annuel': 'IONITY Power 365 — annual',
  'Recharge rapide DC': 'DC fast charging',
  'Sans abonnement - paiement direct': 'No subscription — direct payment',
  'Express-e - DC jusqu’à 24 kW': 'Express-e — DC up to 24 kW',
  'Express-e - DC jusqu’à 50 kW': 'Express-e — DC up to 50 kW',
  'Access-e - DC jusqu’à 24 kW': 'Access-e — DC up to 24 kW',
  'Access-e - DC jusqu’à 50 kW': 'Access-e — DC up to 50 kW',
  'Atlante Go - mensuel': 'Atlante Go — monthly',
  'Happy Hours - heures creuses': 'Happy Hours — off-peak',
  'Tarif standard': 'Standard price',
  'IZIVIA Fast chez McDonald’s': 'IZIVIA Fast at McDonald’s',
  'Application Fastned - remise 10 %': 'Fastned app — 10% discount',
  'Abonnement Gold - remise 30 %': 'Gold subscription — 30% discount',
  'Sans forfait': 'No subscription',
  'Carte bancaire': 'Bank card',
  'Powerdot - AC jusqu’à 22 kW': 'Powerdot — AC up to 22 kW',
  'Powerdot - AC, remise 28 %': 'Powerdot — AC, 28% discount',
  'Powerdot - DC au-delà de 100 kW': 'Powerdot — DC above 100 kW',
  'Powerdot - DC, remise 28 %': 'Powerdot — DC, 28% discount',
  'IONITY via Electroverse - sans abonnement': 'IONITY via Electroverse — no subscription',
  'IONITY via Electroverse - remise annoncée': 'IONITY via Electroverse — advertised discount'
});

export function localizeCommercialLabel(value) {
  if (currentLanguage !== 'en') return value;
  return COMMERCIAL_LABELS[value] ?? value;
}

const NETWORK_DESCRIPTIONS = Object.freeze({
  'jusqu’à 50 kW DC': 'up to 50 kW DC',
  'itinérance multiréseaux': 'multi-network roaming',
  'jusqu’à 320 kW': 'up to 320 kW',
  'jusqu’à 400 kW': 'up to 400 kW',
  'jusqu’à 250 kW (V3) et 500 kW (V4) · puissance selon le site': 'up to 250 kW (V3) and 500 kW (V4) · power varies by site'
});

export function localizeNetworkDescription(value) {
  if (currentLanguage !== 'en') return value;
  return NETWORK_DESCRIPTIONS[value] ?? value;
}

export const TRANSLATED_TARIFF_TEXT = Object.freeze({
  'Sans abonnement': 'No subscription', 'Abonnement mensuel': 'Monthly subscription', 'Abonnement annuel': 'Annual subscription',
  'Paiement direct': 'Direct payment', 'Paiement par badge ou carte': 'RFID card or bank card payment', 'Application IONITY': 'IONITY app',
  'Application Electra - prix variable': 'Electra app — variable price', 'Carte bancaire': 'Bank card', 'Tarif à la borne': 'Pay-as-you-go price',
  'Electra+ Essential - mensuel': 'Electra+ Essential — monthly', 'Electra+ Essential - annuel': 'Electra+ Essential — annual',
  'Electra+ Smart - mensuel': 'Electra+ Smart — monthly', 'Electra+ Smart - annuel': 'Electra+ Smart — annual',
  'IONITY Motion - mensuel': 'IONITY Motion — monthly', 'IONITY Motion 365 - annuel': 'IONITY Motion 365 — annual',
  'IONITY Power - mensuel': 'IONITY Power — monthly', 'IONITY Power 365 - annuel': 'IONITY Power 365 — annual',
  'Recharge rapide DC': 'DC fast charging', 'Sans abonnement - paiement direct': 'No subscription — direct payment',
  'Tarif standard': 'Standard price', 'Sans forfait': 'No plan',
  'Application Fastned - remise 10 %': 'Fastned app — 10% discount',
  'Abonnement Gold - remise 30 %': 'Gold subscription — 30% discount',
  'Powerdot - AC jusqu’à 22 kW': 'Powerdot — AC up to 22 kW', 'Powerdot - AC, remise 28 %': 'Powerdot — AC, 28% discount',
  'Powerdot - DC au-delà de 100 kW': 'Powerdot — DC above 100 kW', 'Powerdot - DC, remise 28 %': 'Powerdot — DC, 28% discount',
  'IONITY via Electroverse - sans abonnement': 'IONITY via Electroverse — no subscription', 'IONITY via Electroverse - remise annoncée': 'IONITY via Electroverse — advertised discount',
  'Tarif national direct confirmé par IECharge.': 'Nationwide direct price confirmed by IECharge.',
  'Prix variable selon la station et l’affluence. Le calcul utilise le milieu de la plage officielle.': 'Price varies by charger and demand. The calculation uses the midpoint of the official range.',
  'Prix dépendant de la station et du moyen de paiement.': 'Price depends on the charger and payment method.',
  'Remise officielle de 0,10 €/kWh sur le tarif Electra variable.': 'Official €0.10/kWh discount on Electra’s variable price.',
  'Remise officielle de 0,20 €/kWh sur le tarif Electra variable.': 'Official €0.20/kWh discount on Electra’s variable price.',
  'Tarif variable selon la station et parfois l’horaire. Valeur utilisée uniquement comme estimation.': 'Price varies by charger and sometimes by time. The value is used as an estimate only.'
  ,'Abonnement annuel avec le même prix du kWh que l’offre mensuelle Motion.': 'Annual subscription with the same per-kWh price as the monthly Motion plan.'
  ,'Abonnement annuel avec le même prix du kWh que l’offre mensuelle Power.': 'Annual subscription with the same per-kWh price as the monthly Power plan.'
  ,'Tarif variable selon la borne ou le réseau partenaire. Valeur indicative pour le calcul.': 'Price varies by charger or partner network. The calculation uses an indicative value.'
  ,'Paiement sans abonnement. Le tarif dépend du type de borne Stations-e.': 'No-subscription payment. The price depends on the Stations-e charger type.'
  ,'Tarif également applicable aux bornes AC jusqu’à 22 kW. kWhiz affiche ici la puissance DC.': 'Also applies to AC chargers up to 22 kW. kWhiz shows the DC power rating here.'
  ,'Tarif applicable aux bornes Stations-e en courant continu jusqu’à 50 kW.': 'Price for Stations-e DC chargers up to 50 kW.'
  ,'Tarif standard dépendant du point de charge et du moyen de paiement.': 'Standard price depending on the charger and payment method.'
  ,'0,29 €/kWh chez Atlante. ChargeBack à 50 %.': '€0.29/kWh at Atlante. 50% ChargeBack.'
  ,'Cumulez des Green Gems à chaque recharge et convertissez-les en crédit pour vos prochaines sessions chez Atlante ou Powerdot.': 'Earn Green Gems with every charge and convert them into credit for your next sessions at Atlante or Powerdot.'
  ,'Abonnement à 5,99 €/mois jusqu’au 31 août 2026.': '€5.99/month subscription until 31 August 2026.'
  ,'1 % du montant de chaque recharge est crédité dans l’application Zunder. Ce crédit n’est pas déduit du tarif affiché.': '1% of each charging payment is credited in the Zunder app. This credit is not deducted from the displayed price.'
  ,'Sans engagement. 3 % du montant de chaque recharge est crédité dans l’application Zunder. Ce crédit n’est pas déduit du tarif affiché.': 'No commitment. 3% of each charging payment is credited in the Zunder app. This credit is not deducted from the displayed price.'
  ,'Sans engagement. 5 % du montant de chaque recharge est crédité dans l’application Zunder. Ce crédit n’est pas déduit du tarif affiché.': 'No commitment. 5% of each charging payment is credited in the Zunder app. This credit is not deducted from the displayed price.'
  ,'Accessible à toutes les marques. Des frais d’occupation de 0,30 €/min s’appliquent au-delà d’une heure de stationnement.': 'Available to all vehicle brands. A €0.30/min occupancy fee applies after one hour.'
  ,'Recharge en courant alternatif, conservée uniquement dans le détail. Le cœur de kWhiz reste la recharge rapide DC.': 'AC charging, shown in details only. kWhiz focuses on DC fast charging.'
  ,'Prix dépendant du point de charge et des conditions Electroverse. Valeur indicative pour le calcul.': 'Price depends on the charger and Electroverse terms. The calculation uses an indicative value.'
});

export function localizeTariffText(value) { return currentLanguage === 'en' ? (TRANSLATED_TARIFF_TEXT[value] || value) : value; }
