# Plan de construction V2 — Titan zombie de siege

## Statut et references

Modele original voxel de **Cube Family**, cree pour les assauts contre une forteresse.
L'illustration et la fiche d'intention ont ete produites lors de la conception; elles servent d'inspiration visuelle et **ne sont pas des cotes techniques garanties**.
**Correction importante : la fiche illustree indiquait 24 m par erreur. La hauteur canonique de ce modele est d'environ 14 m.**

La version V1 est preservee. La V2 enrichit le meme rig et les memes animations, sans changer le moteur ou les fichiers de sauvegarde.

## Plan cote (unite du monde en metres)

| Zone | Repere pratique | Forme et composants |
| --- | --- | --- |
| Pieds et semelles | Y = 0 a 1,5 m | bottes en pierre/metal, plaques de tibia et rivets |
| Jambes | Y = 1,5 a 5,3 m | deux articulations independantes `Leg_Left` et `Leg_Right` |
| Bassin et tabard | Y = 4 a 6,5 m | ceinture, pans de tissu bordeaux, insigne de forteresse |
| Torse et coeur | Y = 6,5 a 10,5 m | plaques rouillees, cotes brisees, point faible rouge vers Y = 8 m |
| Epaules | Y = 9,6 a 11,1 m | epaulettes asymetriques, boucles et chaines |
| Bras de siege | poing droit vers Y = 3,5 a 7 m | enormes blocs de pierre, cerclages oxydes et fissures |
| Tete / machoire | Y = 10 a 14 m | crane voxel, yeux verts luminescents, mandibule mobile |
| Dos | Y = 8 a 13 m | piques osseuses, armature et plaques de metal |

- **Axe Y** : vertical, pieds au niveau 0.
- **Axe +Z** : avant du monstre.
- **Echelle V1** : 0,24 m par voxel dans le generateur de base.
- **Envergure** : asymetrique; le poing droit est nettement plus large que la main gauche.
- **Focalisation visuelle** : le poing fracasseur, les yeux verts et le noyau rouge.
- **Collisions en jeu** : a definir plus tard par un controleur de boss (ne pas utiliser toute la largeur des poings).

## Palette et materiaux

| Surface | Couleurs indicatives | Traitement |
| --- | --- | --- |
| Peau de zombie | #65795D / #829777 / #465D49 | vert grise, usure mousse |
| Tissu | #6A2734 / #8E3942 | bordeaux fonce, bords dechires |
| Plaques rouillees | #995031 / #D27B42 | oxydation et rivets |
| Roche du poing | #706A6C / #9B9291 | brique fissuree, pans decales |
| Os et cotes | #C7BEB0 / #B8AD9E | dents, piques, armature |
| Yeux | #D4FD4A | surface emissive verte |
| Noyau du torse | #F23D57 / #FF8090 | gemme rouge emissive |

Les couleurs sont integrees au GLB ; pas de texture distante ni de reseau.

## Hierarchie et articulation

Conserver les noeuds historiques :
`TitanRoot`, `Body`, `Head`, `Jaw`, `Arm_Left`,
`Arm_Right`, `Leg_Left`, `Leg_Right`, `Back_Spines`,
`Core_WeakPoint`, `ImpactAnchor`, `HeadTarget`,
`HealthBarAnchor`.

Les details de la V2 sont attaches comme noeuds enfants a ces articulations.
Le point `ImpactAnchor` reste rattache au bras de frappe pour synchroniser la destruction des portes **quand le gameplay existera**.

Cinq animations conservees dans le GLB : `Idle`, `Walk`, `Smash`, `Roar`, `Death`.

## Fichiers et reproduction

- `titan_zombie_siege_v1.glb` : base originale, inchangee.
- `generer_titan_v2.mjs` : script de transformation **sans dependance externe**.
- `titan_zombie_siege_v2.glb` : sortie GLB 2.0 generee et cataloguee.

Depuis la racine du depot :

```bash
node assets/3d/titan-zombie-siege/generer_titan_v2.mjs
```

Ouvrir ensuite le fichier GLB avec un visualiseur glTF ou via `THREE.GLTFLoader`. Verifier les poses et la projection du poing a l'impact.

## Integration future par Work (non realisee)

1. Inspecter `AGENTS.md`, les catalogues, l'architecture du moteur et les regles de sauvegarde.
2. Charger localement la V2 **a la place de V1** uniquement apres validation, sans renommer son identifiant de creature.
3. Creer un module autonome de boss pour l'evenement de siege : progression vers les portes, attaque `Smash` sur une face, telegraphie, degats et phase de recul.
4. Gerer le point faible du coeur, la barre de vie, les collisions simplifiees et les effets visuels; maintenir le rendu CPU de secours.
5. Tester web, PC, tactile, performances, hors ligne, sauvegardes et non-regression en mode Libre.
6. Suivre les etats separement : asset disponible, integre au code, teste, publie.

**La presence de la V2 dans GitHub ne signifie pas qu'elle est jouable ni publiee.**
