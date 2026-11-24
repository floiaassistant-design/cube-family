# Titan zombie de siège — Cube Family

**Statut : modèle 3D de bibliothèque. L’intégration au jeu reste à faire.**

Boss voxel original conçu pour les grandes vagues de la Forteresse des Cinq Bastions.

## Modèle V2

- `titan_zombie_siege_v2.glb` (glTF 2.0) contient les couleurs, normales, matériaux et animations. Le modèle se charge localement avec `GLTFLoader`.
- Poing droit en pierre, plaques de fer rouillé, tabard bordeaux, yeux verts et cœur rouge émissif.
- Silhouette d’environ 14 m, axe Y vertical, avant vers +Z et pieds près de Y=0.
- 178 volumes décoratifs, 23 nœuds et 19 meshes. Les neuf pièces articulées et les cinq clips `Idle`, `Walk`, `Smash`, `Roar` et `Death` de la V1 sont conservés.
- Repères conservés : `ImpactAnchor` pour la frappe, `HeadTarget` pour la visée et `HealthBarAnchor` pour la barre de vie.
- [Plan de construction](PLAN_V2.md) et [projection de face et de trois quarts](apercu_v2.svg).

## Reproduire le modèle

Le générateur lit le fichier `titan_zombie_siege_v1.glb` conservé dans ce dossier. Il écrit la V2 et requiert seulement Node.js.

```bash
node assets/3d/titan-zombie-siege/generer_titan_v2.mjs
```

## Intégration au jeu

1. Charger le GLB localement et piloter les clips via `AnimationMixer`.
2. Développer le comportement dans un module dédié de `src/game/siege/`, avec apparition lors des grosses vagues en mode Libre.
3. Télégraphier les attaques sur les portes du front de la forteresse. Synchroniser les dégâts sur `ImpactAnchor` et utiliser `Core_WeakPoint` pour la zone sensible.
4. Définir les collisions, les sons et le rendu CPU. Vérifier les commandes tactiles, les sauvegardes et les performances pendant un siège.
