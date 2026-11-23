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
- `src/world/world-registry.ts` : liste locale des mondes nommés, découverte non destructive des anciennes sauvegardes, création à graine unique, renommage et suppression explicite hors monde actif. Les fichiers player/edits/forteresse restent identifiés par graine ; les mondes en ligne exigent un stockage serveur distinct.
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

## Mini-jeu officiel : Forteresse des Cinq Bastions

- `src/game/siege/fortress.ts` définit un plan de forteresse en voxels et les routes d'assaut sans effet de bord.
- `src/game/siege/fortress-store.ts` garde une référence par graine dans une clé indépendante des sauvegardes existantes et sélectionne une zone non modifiée.
- `src/game/siege/session.ts` gère la simulation solo : préparation, vagues, adversaires, dégâts, tirs et réparations. Les autres modes ne dépendent pas de ces règles.
- `src/render/siege-zombie-model.ts` réutilise le modèle de créatures WebGL et le rendu CPU, sans ressource distante.
- `src/ui/siege-panel.ts` fournit les commandes clavier, souris et tactile. `src/main.ts` se limite à raccorder les systèmes.
- `src/world/edit-store.ts` enregistre les plans en une seule sauvegarde et protège les modifications déjà effectuées par le joueur.
- Le tir à l'arc du mini-jeu est une mécanique temporaire de l'événement, indépendante de l'inventaire général ; un objet et des recettes durables seraient un chantier séparé.
- `src/game/siege/armory.ts` gère les pièces temporaires, tarifs et améliorations des armes de siège. `src/ui/siege-armory-panel.ts` affiche les offres localisées. Les achats sont autorisés seulement entre les vagues ; ils ne créent pas d'objets persistants ni de modèles 3D. Voir [la fiche d'armurerie](FORTERESSE_ARMURERIE.md).
- La phase actuelle est solo. Le multijoueur du moteur principal devra disposer d'une autorité serveur et synchroniser joueurs, vagues, zombies, projectiles et dégâts avant toute annonce de mode cinq joueurs.
- `src/game/siege/assault.ts` définit un front unique au sud, les formations de hordes et les portes destructibles. `src/game/siege/gate-overlay.ts` synchronise des blocs temporaires pour les portes avec le streaming, le rendu et les collisions sans enregistrer leur destruction. Voir [Assaut massif au sud](FORTERESSE_ASSAUT_SUD.md).
- Le site public et la version GitHub sont deux états distincts ; Work assurera la publication après validation des tests.
