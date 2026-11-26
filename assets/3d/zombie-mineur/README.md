# Zombie mineur — modèle 3D Cube Family

**État en jeu** — Variante nocturne du rôdeur en mode Aventure. Le modèle et ses trois animations existent dans les deux rendus. Voir [la fiche des créatures intégrées](../../../docs/CREATURES_VOXEL.md).

Monstre voxel original et familial, peau vert mousse, veste bleu ardoise, écharpe ocre, cheveux en cubes, yeux asymétriques et dents irrégulières. Modèle réalisé spécialement pour Cube Family ; aucune ressource extraite du jeu Minecraft.

## Fichier principal

- `zombie_mineur_v1.glb.gz.b64` : archive **sans perte** du véritable GLB glTF 2.0, conservée sous cette forme textuelle dans GitHub.
- **SHA-256 du GLB restauré :** `6fcbccb73551f11ce9e26e8ef4c4a2ad03b002285d3f382fefdb207f483612ab`.
- **Taille du GLB :** 42 040 octets.
- **6 parties nommées :** `Body`, `Head`, `Arm_Left`, `Arm_Right`, `Leg_Left`, `Leg_Right`.
- **1 536 triangles**, couleurs intégrées aux sommets, aucune texture distante.
- **3 animations glTF intégrées :** `Idle` (repos), `Walk` (marche), `Attack` (attaque).
- Axes : Y vertical, Z positif vers l'avant, sol proche de Y=0. Dimensions 1,60 × 2,52 × 0,98 unités.

## Restauration locale

Depuis la racine du dépôt :

```bash
python assets/3d/restore_glb.py assets/3d/zombie-mineur/zombie_mineur_v1.glb.gz.b64 assets/3d/zombie-mineur/zombie_mineur_v1.glb
```

Le script contrôle la taille et le SHA-256, puis crée un vrai fichier `.glb`, chargeable dans Three.js avec `GLTFLoader`.

## Mise à jour du modèle

1. Lire `AGENTS.md` et inspecter le moteur Three.js existant sans remplacer son architecture.
2. Restaurer puis charger le zombie comme une ressource locale (copie possible dans `public/models/zombie_mineur_v1.glb` après validation).
3. Conserver les matériaux et couleurs de sommets. Piloter `Idle`, `Walk` et `Attack` au moyen d’un `THREE.AnimationMixer`; vérifier le comportement de chaque clip.
4. Créer les collisions et l’IA du monstre en **respectant l’apparition nocturne** demandée pour Cube Family. Aucun monstre agressif le jour, sauf règle existante explicite.
5. Vérifier les performances sur PC et tablette, les sauvegardes, les contrôles et le jeu hors ligne.
6. Faire une PR avec tests ; ne pas déployer le site sans validation.

Le modèle cohabite avec les chats, la vache et les rôdeurs de schiste.
