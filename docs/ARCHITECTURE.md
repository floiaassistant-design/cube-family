# Architecture de Cube Family

## Principe

Le dépôt GitHub contient le **code de référence**. Notion contient les
décisions, demandes, priorités et comptes rendus. La publication du site
est une opération distincte d'une fusion GitHub.

L'objectif est de faire évoluer **un moteur partagé** pour navigateur,
PC et mobile, plutôt que de maintenir des versions du gameplay divergentes.

## Découpage du code

- `src/main.ts` : démarrage et coordination, sans y concentrer toute
  la logique métier des nouveautés.
- `src/world/` : génération, blocs, chunks, sauvegardes et formats stables.
- `src/player/` et `src/input/` : déplacements, physiques et commandes.
- `src/game/` : règles des créatures, montures, équipement, recettes et combats.
  Le module `equipment.ts` isole les nouveaux effets d'armes et de défense.
- `src/render/` : modèles 3D, WebGL et solution de repli CPU.
  `equipment-models.ts` charge localement les GLB d'équipements à la demande.
- `src/ui/`, `src/i18n.ts` : HUD, menus, accès tactile et traductions.
- `src/audio/` : sons.
- `assets/3d/` : fichiers de modèles, fiches, scripts et `INDEX.json`.
- `docs/catalogues/` : listes descriptives des créatures et équipements.
- `desktop/` et `mobile/` : emballages natifs, pas des forks du moteur.
- `scripts/` et `.github/workflows/` : vérifications et contrôle qualité.

## Règles de conception

1. Étudier l'existant et localiser les responsabilités avant de coder.
2. Une règle de jeu doit résider dans son module métier, pas dans un
   composant visuel ou un nouveau fichier géant.
3. Ne dupliquer ni les règles ni les données. Extraire des fonctions
   testables et réutiliser les types et constantes existants.
4. Ajouter un test ciblé pour toute nouvelle mécanique ou correction.
   Faire des tests de non-régression sur les fonctions partagées.
5. Préserver les modes Créatif et Aventure, les sauvegardes, le rendu CPU,
   la génération déterministe et le fonctionnement hors ligne.
6. Éviter les chargements réseau non essentiels et le travail lourd sur
   le fil principal, surtout sur téléphone.
7. Conserver les licences et crédits du moteur amont ; n'intégrer que
   des modèles et des ressources pour lesquels les droits sont établis.
8. Un identifiant enregistré dans une sauvegarde ne se renomme pas sans
   migration explicite et testée.

## Ajouter une créature

1. Créer ou mettre à jour la fiche Notion et spécifier le comportement :
   passif/hostile, apparition, vie, dégâts, butin, animations, interactions.
2. Préparer un sous-dossier `assets/3d/<id>/` avec fiche, modèle et
   provenance, puis enregistrer l'asset dans `assets/3d/INDEX.json`.
3. Répertorier la créature dans `docs/catalogues/creatures.json`,
   état `asset_only` avant l'intégration.
4. Ajouter comportement, collisions, IA et logique dans `src/game/` ;
   créer un modèle compatible dans `src/render/`.
5. Ajouter contrôles, animation, audio et rendu adapté PC/mobile si besoin.
6. Vérifier jour/nuit, sauvegardes, performances, WebGL et rendu de secours.
7. Passer à `integrated_in_code` **seulement après preuve dans le dépôt**.
8. Lier la PR et les tests à Notion ; après publication vérifiée, noter
   séparément l'URL et la version effectivement déployée.

## Ajouter un équipement

1. Définir son usage, sa recette, son comportement et son rendu en main.
2. Étendre `src/game/items.ts` sans altérer les identifiants existants.
3. Adapter `src/ui/inventory.ts`, la hotbar, les commandes et la traduction.
4. Intégrer un modèle dans `assets/3d/` et `src/render/` si nécessaire.
5. Mettre à jour `docs/catalogues/equipements.json` et les tests.
6. Tester l'objet équipé, déséquipé, changé, sauvegardé et rechargé
   sur ordinateur et écran tactile.
7. Ne pas confondre « item codé », « visible en main » et « publié ».

## Références

- [Instructions des agents](../AGENTS.md)
- [Processus GitHub ↔ Notion](PROCESSUS_GITHUB_NOTION.md)
- [Catalogues](catalogues/README.md)
- [Bibliothèque 3D](../assets/3d/README.md)
