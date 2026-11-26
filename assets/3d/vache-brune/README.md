# Vache brune voxel 3D — Cube Family

**État en jeu** — Vache passive en mode Aventure et en mode Libre. Le modèle, ses couleurs et ses trois animations sont reproduits dans les deux rendus. Voir [la fiche des créatures intégrées](../../../docs/CREATURES_VOXEL.md).

## Contenu

- `vache_brune_v1.glb.gz.b64` : véritable modèle glTF 2.0 GLB, compressé avec gzip puis encodé en base64 pour le stocker sans perte sur GitHub.
- **SHA-256 du GLB restauré** : `96bf955f02c5c261960be52ff9711478a735453a6abab2033f48f01f3b5b9707`.
- Taille restaurée : **57 788 octets** ; **768 triangles**, **8 parties distinctes**, **9 nœuds**.
- Animations intégrées : `Idle` (repos), `Walk` (marche), `Graze` (broutage).
- Nœuds : `Body`, `Head`, `Leg_Front_Left`, `Leg_Front_Right`, `Leg_Back_Left`, `Leg_Back_Right`, `Tail`, `Udder` (+ racine).
- +Y vers le haut, +Z vers l'avant, pieds au voisinage de Y=0. Matériau PBR et **couleurs de sommets** intégrées, aucune texture distante.
- Création originale et familiale : volumes cubiques, fourrure marron, taches crème, cornes ivoire, museau rose, oreilles et pis.

## Reconstituer le modèle original

Depuis la racine du dépôt, avec Python 3 :

```bash
python assets/3d/restore_glb.py assets/3d/vache-brune/vache_brune_v1.glb.gz.b64 public/assets/models/vache_brune_v1.glb
```

Le script de restauration vérifie la structure GLB, la taille et le SHA-256. Ne pas charger directement le fichier `.b64` dans Three.js.

## Mise à jour du modèle

1. Lire `AGENTS.md` et `assets/3d/OUTIL_WORK.md`. Inspecter le moteur du jeu avant toute modification.
2. Restaurer le GLB. Charger avec `GLTFLoader` et préserver les **vertex colors**.
3. Avec `THREE.AnimationMixer`, animer `Idle`, `Walk` et `Graze`. Associer la marche aux déplacements, le broutage au comportement de pâturage.
4. La vache est un animal **passif** qui apparaît de jour dans des zones appropriées ; ne pas lui donner l'IA de monstre agressif.
5. Ajouter un collider simple, une IA légère avec errance à proximité et interactions adaptées aux règles du jeu.
6. Préserver le chaton et le zombie mineur ; ne pas perturber les sauvegardes, l'équilibrage ni la version publique.
7. Vérifier le chargement, les animations et les performances sur PC/tablette. Intégrer par PR avant une éventuelle publication.

Le fichier d’origine reste la référence. La marche, le repos et le broutage sont déclenchés par le troupeau local dans `src/game/cows.ts`.
