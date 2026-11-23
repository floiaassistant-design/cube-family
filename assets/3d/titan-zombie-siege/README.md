# Titan zombie de siege — Cube Family

**Statut : asset V2 pret pour revue ; non integre au jeu, site non modifie.**

## Apercu du vrai modele

[Voir la projection face et trois-quarts de la V2](apercu_v2.svg) — image SVG obtenue par projection des triangles du fichier GLB; elle ne remplace pas un test en moteur 3D.

## Version V2 (concept de siege detaille)

- Fichier : `titan_zombie_siege_v2.glb` (GLB 2.0, couleur et animations integrees).
- Source : `generer_titan_v2.mjs`, qui transforme **sans perte de l'original** la V1 presente dans ce dossier. Reproductible avec Node.js et sans paquet externe.
- Plan de construction : [PLAN_V2.md](PLAN_V2.md).
- Esthetique : poing droit gigantesque en pierre, plaques de fer rouille, tissu bordeaux, yeux verts lumineux, noyau rouge emissif, piques et chaines.
- Morphologie : silhouette d'environ **14 metres**, axes Y vertical et +Z vers l'avant.
- Animations : `Idle`, `Walk`, `Smash`, `Roar`, `Death` (pivots de V1 conserves).
- Modifications : 178 volumes decoratifs repartis sur 10 meshes supplementaires; 23 noeuds / 19 meshes au total.

**Reproduire :**

```bash
node assets/3d/titan-zombie-siege/generer_titan_v2.mjs
```

La planche d'illustration initiale indiquait 24 m; **ce chiffre est errone** et ne doit pas servir d'echelle au jeu.

## Version V1 conservee

`titan_zombie_siege_v1.glb` reste disponible pour retour arriere; ses articulations, marqueurs et ses 5 animations glTF sont reutilises dans la V2.

## Integration ulterieure (ChatGPT Work)

1. Lire `AGENTS.md` et `docs/ARCHITECTURE.md`, verifier les regles du mini-jeu de la forteresse.
2. Charger `titan_zombie_siege_v2.glb` comme ressource locale dans Three.js via `GLTFLoader` et piloter les clips par `AnimationMixer`.
3. Integrer le boss a la simulation du siege dans `src/game/siege/`, separe du monde normal.
4. Utiliser `ImpactAnchor` pour synchroniser une attaque telegraphiee sur une porte et `Core_WeakPoint` pour la zone sensible. Rien de cela n'est code par ce modele.
5. Definir des collisions simples, les degats, l'IA, l'apparition, les sons et le fallback de rendu CPU.
6. Tester clavier/souris, tactile, sauvegardes, hors ligne et performances, puis PR et validation avant publication.

Le dossier est une bibliotheque d'assets, **pas une apparition automatique dans le jeu**.
