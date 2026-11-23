# Titan zombie de siège — Cube Family

**Statut : modèle 3D prêt dans la bibliothèque, NON intégré au jeu.**

Boss original voxel pour les grandes vagues de la forteresse : silhouette d'environ 14 mètres, plaques rouillées, œil lumineux, armure de pierre au poing droit et point faible au torse. Aucun élément provenant d'un autre jeu.

## Modèle

- `titan_zombie_siege_v1.glb` : véritable GLB glTF 2.0, couleurs et normales embarquées. Aucun fichier externe.
- Axes : **Y vers le haut**, **Z positif vers l'avant**, pieds autour de Y=0.
- 9 pièces articulées : `Body`, `Head`, `Jaw`, `Arm_Left`, `Arm_Right`, `Leg_Left`, `Leg_Right`, `Back_Spines`, `Core_WeakPoint`.
- Repères : `ImpactAnchor` (effet d'impact), `HeadTarget` (visée), `HealthBarAnchor` (barre de vie).
- Animations GLB : `Idle`, `Walk`, `Smash`, `Roar`, `Death`.
- Matières et couleurs embarquées, sans dépendance réseau, utilisables par `THREE.GLTFLoader`.

## Proposition d'intégration ultérieure par Work

1. Lire `AGENTS.md` et ne modifier aucun moteur partagé hors d'une PR dédiée.
2. Charger le fichier GLB localement; piloter les clips avec `THREE.AnimationMixer`.
3. Créer un contrôleur de boss indépendant dans `src/game/siege/`, lié aux grosses vagues de l'événement des Cinq Bastions.
4. Attaquer les **portes** depuis **une seule face** de la forteresse : télégraphier `Smash`, déclencher le dégât au moment de l'impact, puis permettre la destruction progressive. Respecter les protections de sauvegarde et les règles du mode Libre.
5. Ajouter une collision simplifiée (sans envelopper les bras étendus), la cible de combat, l'échelle, les sons et la prise en charge du rendu CPU.
6. Tester PC, mobile et tablette, performances en présence de nombreux zombies, sauvegardes et non-régression avant fusion et publication.

Le modèle seul ne crée **ni IA, ni destruction des portes, ni apparition dans le jeu**. Il ne faut pas le présenter comme déjà jouable ou publié.
