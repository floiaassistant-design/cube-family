# Titan zombie de siège — Cube Family

**État en jeu** — Boss des vagues 5 et finale de la Forteresse des Cinq Bastions.

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

Le modèle est ramené à environ 4,25 blocs de haut pour passer les portes de la forteresse. Le siège pilote les clips `Idle`, `Walk` et `Smash` et applique les dégâts aux portes et au cristal. La [fiche des créatures voxel](../../../docs/CREATURES_VOXEL.md) décrit le rendu et la reconstruction des données.
