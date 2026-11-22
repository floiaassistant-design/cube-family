# Chaton voxel orange — bibliothèque 3D

Personnage original créé pour Minecraft Family. Modèle en volumes 3D réels (gltf 2.0), destiné au moteur Three.js. Conserver l'aspect voxel ; ne jamais remplacer le modèle sans comparaison visuelle.

## État des fichiers

- `chaton_voxel_v2.glb.gz.b64` : **modèle V2** en GLB compressé lossless (gzip) puis encodé en base64 pour faciliter son dépôt GitHub. **Ce n'est pas un fichier `.glb` directement chargeable.**
- `chaton_voxel_v1.glb.gz.b64` : modèle initial V1 pour historique, si présent.

### Reconstruction

Depuis la racine du dépôt :

```bash
python3 assets/3d/restore_glb.py assets/3d/chaton-orange/chaton_voxel_v2.glb.gz.b64 public/assets/models/chaton_voxel_v2.glb
```

Le script vérifie SHA256, décodage, décompression et en-tête GLB avant écriture. Le modèle V2 reconstruit doit peser **42 248 octets** et produire l'empreinte SHA256 `9f0e1479b45d9bef789fce1e183bf21f0251102eb7f859ee887388a339ab8df8`.

## Détails du modèle V2

- 7 parties nommées et indépendantes : Body, Head, Leg_Front_Left, Leg_Front_Right, Leg_Back_Left, Leg_Back_Right, Tail.
- ~1 704 triangles ; +Y vers le haut ; visage vers +Z ; pieds près de Y=0.
- Chaton orange tigré aux yeux verts, museau blanc, oreilles roses, queue relevée avec bout blanc.
- Les parties sont animables, **mais le fichier GLB ne contient pas de clips d'animation**.

## Intégration dans le jeu par Work

1. Lire `AGENTS.md` et `assets/3d/OUTIL_WORK.md`.
2. Reconstruire le GLB V2 ; vérifier hash et dimensions.
3. Importer avec le chargeur glTF de Three.js, ou l'outil déjà utilisé dans le dépôt.
4. Préserver les couleurs de sommets (ne pas imposer un matériau qui neutralise les couleurs).
5. Adapter échelle, collisions, déplacement et animation des différentes parties.
6. Tester sur PC et mobile/tablette sans dégrader performances et sauvegardes.
7. Proposer l'intégration par PR, puis demander validation avant toute publication.

La planche de référence et le rendu statique sont conservés dans la conversation ChatGPT ayant créé le modèle. Ils ne sont pas encore dans ce dossier GitHub. Le GLB V2 est néanmoins présent intégralement, sans modification de la géométrie.
