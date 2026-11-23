# Processus GitHub, Notion et site public

## Responsabilités

- **GitHub** : code, tests, fichiers 3D, catalogues, PR et historique technique.
- **Notion** : décisions, demandes, ordre des travaux, statut de chaque
  fonctionnalité, compte rendu des tests et versions déployées.
- **Site** : la publication réelle, qui doit être vérifiée séparément.

Le document central Notion est :
[Cube Family — Document de conception](https://app.notion.com/p/41f6633072a8810dabacc0140c05c5a6).

## Workflow obligatoire pour Work ou tout agent

1. Lire `AGENTS.md`, ce processus, la feuille de route et la demande Notion.
2. Vérifier l'état actuel du dépôt et la dernière version du site.
3. Choisir un périmètre limité, un identifiant de tâche et des critères
   d'acceptation avant de modifier les fichiers.
4. Créer une branche puis une PR ; relier sa description à Notion.
5. Mettre à jour les catalogues et fiches 3D si la PR touche des
   créatures, du matériel ou une mécanique existante.
6. Exécuter les tests, compiler, consulter le résultat GitHub Actions
   et préciser les validations manuelles manquantes.
7. Fusionner uniquement les changements validés ; ne jamais publier
   un échec connu sans décision explicite.
8. Mettre à jour Notion avec la PR fusionnée, le commit, les changements,
   les tests et la liste des problèmes restants.
9. Publier le site seulement quand les droits et la validation le
   permettent ; noter la nouvelle URL/version et la date d'observation.
10. Tester la version publique, notamment sur navigateur PC, tactile
    et tablette si la fonction les concerne. Noter toute divergence.

## États suivis dans Notion

- `Idée` : proposition, non encore décidée.
- `Validé` : fonctionnalité acceptée, sans garantie de code.
- `Asset prêt` : fichiers modèles stockés dans GitHub.
- `En développement` : branche ou PR en cours.
- `Codé` : code présent en branche `main`.
- `Testé` : périmètre et appareil des tests explicités.
- `Publié` : URL et version publique vérifiées en conditions réelles.

Ces états ne sont pas interchangeables ; un asset prêt n'est pas
nécessairement codé, et un code fusionné n'est pas nécessairement publié.

## Publication et honnêteté du suivi

Aucun accès GitHub, Notion ou hébergement n'autorise à inventer
une publication ou un test. Si l'un des services est inaccessible,
documenter l'étape bloquée, avec l'URL de la PR, et **ne pas écrire
« synchronisé »**.

Ne jamais ajouter des clés Notion dans GitHub ni considérer le fichier
`AGENTS.md` comme une synchronisation automatique. Pour une vraie
automatisation du suivi, il faudra une intégration autorisée avec
gestion des secrets et vérification des erreurs.

Un changement transverse doit être contrôlé sur web, PC et mobile ;
tout environnement non essayé reste marqué « non testé ».

## Point de contrôle à chaque fin de session

Écrire dans Notion : objectif, décision, PR/commit, fichiers changés,
tests réellement exécutés, résultat observé sur le site, problèmes
restants et prochaine étape.
