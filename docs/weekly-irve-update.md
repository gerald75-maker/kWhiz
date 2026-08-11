# Actualisation hebdomadaire de la Base nationale IRVE

Le workflow `Actualisation hebdomadaire IRVE` s'exécute le mercredi à 04 h 23 UTC et peut être lancé depuis **Actions → Actualisation hebdomadaire IRVE → Run workflow**. Un lancement manuel utilise la branche sélectionnée comme base ; l'exécution planifiée utilise la branche par défaut.

Il télécharge exclusivement la ressource consolidée officielle identifiée sur data.gouv.fr, vérifie que la redirection finale reste sous le chemin officiel `static.data.gouv.fr/resources/base-nationale-des-irve…`, puis exécute le générateur existant. La date est extraite du nom daté de la ressource ; si ce nom n'en contient pas, la date UTC de génération est utilisée. Aucune date IRVE n'est codée en dur.

Avant tout téléchargement ou toute génération, le workflow affiche la version de PHP, vérifie la syntaxe de `public/status.php` avec `php -l`, puis exécute `tests/irve-status-associations.php`. Ce test charge le relais en mode bibliothèque, sans en-têtes HTTP, accès réseau ni cache, et contrôle la compatibilité de l'ancien index ainsi que les associations multiples et ambiguës du nouveau format. L'absence de PHP ou l'échec d'un de ces contrôles interrompt le workflow.

## Contrôles et seuils

Le validateur refuse les coordonnées hors du périmètre France, les identifiants de station dupliqués, les associations point–station orphelines, un opérateur actif sans règle IRVE ou l'absence complète d'un opérateur actif. Electroverse est la seule exception documentée : c'est un agrégateur d'itinérance sans stations propres.

L'index de statut conserve temporairement `pointToStation` pour les serveurs utilisant encore l'ancien format. Les associations proches et compatibles sont aussi publiées sous `pointToStations`, avec des listes de stations triées. Les identifiants distants ou dont le nom, l'adresse et la commune ne permettent pas d'établir un même site sont exclus de ces deux index et conservés dans `ambiguousPointIds` et `ambiguousPointCandidates`. Aucun conflit n'est résolu selon l'ordre des lignes du CSV.

Par rapport aux fichiers publiés, le workflow échoue si :

- le volume global de stations varie de plus de **15 %** ;
- les identifiants de points ou associations point–station varient de plus de **25 %** ;
- les identifiants associés à plusieurs stations varient de plus de **25 %**, une fois leur métrique amorcée ;
- le volume d'un opérateur baisse de plus de **30 %** ou augmente de plus de **60 %**.

Ces seuils relatifs tolèrent la croissance et les corrections normales de la consolidation sans figer les volumes. Une rupture de publication, une disparition de réseau ou une duplication massive produit un rapport explicite dans le résumé Actions et un artefact `rapport-irve`.

Le déclenchement manuel propose une option exceptionnelle `allow_station_alias_migration`. Elle autorise ponctuellement une baisse dépassant les seuils de stations uniquement si chaque identifiant supprimé possède un alias canonique valide, si la cible existe dans le même réseau et si tous les identifiants de points sont conservés. L'option est désactivée par défaut et n'est jamais active lors des exécutions hebdomadaires planifiées : les seuils habituels de 15 % globalement et de 30 % par opérateur restent alors intégralement appliqués.

Le détail des conflits de métadonnées et une copie de contrôle des alias sont écrits dans `irve-grouping-audit.json`, archivé avec `rapport-irve` mais jamais copié dans `public/` ni ajouté à la PR. `irve-fast.json` ne conserve que les métriques compactes nécessaires au suivi. La table complète `stationAliases` reste uniquement dans `irve-status-index.json` : elle documente la migration des associations de statuts, permet au validateur de prouver la couverture de chaque station supprimée et fournit la table de rollback, sans alourdir les données cartographiques téléchargées par le frontend.

L'ancien `irve-status-index.json` ne contient pas le volume brut des associations. La première exécution affiche donc cette valeur comme indisponible et amorce les métriques sans lui appliquer de seuil ; toutes les exécutions suivantes comparent normalement associations et conflits au fichier publié.

Le rapport distingue également les conflits proches résolus, les conflits ambigus exclus, les conflits dépassant 500 mètres et les associations encore écrasées. Cette dernière métrique doit toujours rester à zéro.

Si les fichiers changent et que tous les contrôles passent, la branche `automation/weekly-irve` et sa pull request sont créées ou actualisées. Seuls `public/irve-fast.json` et `public/irve-status-index.json` peuvent être modifiés. Le workflow ne fusionne jamais la PR, ne change ni tarifs, ni version, et ne déploie rien.

## Ordre de publication FTP compatible

Pour une publication manuelle, transférer d'abord le nouveau `public/status.php`, capable de lire l'ancien comme le nouveau format. Transférer ensuite `public/irve-status-index.json`. Le frontend n'a pas besoin d'être transféré pour ce correctif tant qu'aucun de ses fichiers n'est modifié. Cet ordre évite qu'une ancienne version de `status.php` ignore les associations multiples du nouvel index.
