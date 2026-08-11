# Actualisation hebdomadaire de la Base nationale IRVE

Le workflow `Actualisation hebdomadaire IRVE` s'exécute le mercredi à 04 h 23 UTC et peut être lancé depuis **Actions → Actualisation hebdomadaire IRVE → Run workflow**. Un lancement manuel utilise la branche sélectionnée comme base ; l'exécution planifiée utilise la branche par défaut.

Il télécharge exclusivement la ressource consolidée officielle identifiée sur data.gouv.fr, vérifie que la redirection finale reste sous le chemin officiel `static.data.gouv.fr/resources/base-nationale-des-irve…`, puis exécute le générateur existant. La date est extraite du nom daté de la ressource ; si ce nom n'en contient pas, la date UTC de génération est utilisée. Aucune date IRVE n'est codée en dur.

## Contrôles et seuils

Le validateur refuse les coordonnées hors du périmètre France, les identifiants de station dupliqués, les associations point–station orphelines, un opérateur actif sans règle IRVE ou l'absence complète d'un opérateur actif. Electroverse est la seule exception documentée : c'est un agrégateur d'itinérance sans stations propres.

Par rapport aux fichiers publiés, le workflow échoue si :

- le volume global de stations varie de plus de **15 %** ;
- les identifiants de points ou associations point–station varient de plus de **25 %** ;
- les identifiants associés à plusieurs stations varient de plus de **25 %**, une fois leur métrique amorcée ;
- le volume d'un opérateur baisse de plus de **30 %** ou augmente de plus de **60 %**.

Ces seuils relatifs tolèrent la croissance et les corrections normales de la consolidation sans figer les volumes. Une rupture de publication, une disparition de réseau ou une duplication massive produit un rapport explicite dans le résumé Actions et un artefact `rapport-irve`.

L'ancien `irve-status-index.json` ne contient pas le volume brut des associations. La première exécution affiche donc cette valeur comme indisponible et amorce les métriques sans lui appliquer de seuil ; toutes les exécutions suivantes comparent normalement associations et conflits au fichier publié.

Si les fichiers changent et que tous les contrôles passent, la branche `automation/weekly-irve` et sa pull request sont créées ou actualisées. Seuls `public/irve-fast.json` et `public/irve-status-index.json` peuvent être modifiés. Le workflow ne fusionne jamais la PR, ne change ni tarifs, ni version, et ne déploie rien.
