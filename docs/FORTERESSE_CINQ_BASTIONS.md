# Forteresse des Cinq Bastions — première intégration

La forteresse est une arène voxel temporaire de 96 × 96 blocs, accessible par
**« Forteresse : siège des zombies »** dans le menu principal. Elle comprend
quatre bastions d'angle, un bastion de porte, une enceinte intérieure, un
donjon et un cristal central. L'événement compte dix vagues et une préparation
avant chaque assaut. On peut quitter la carte par **« Retour au monde libre »**.

## Sauvegardes et architecture

- Le monde du siège utilise une graine réservée, un overlay de chunks
  déterministe et un stockage nul : **aucune sauvegarde normale n'est modifiée**.
- Le plan est dans `src/game/fortress-blueprint.ts`, l'overlay dans
  `src/game/fortress-arena.ts`, la simulation des vagues dans
  `src/game/fortress-siege.ts`. Le raccordement se trouve dans
  `src/main.ts`.
- Le mode reste jouable seul ; les cinq joueurs nécessitent la synchronisation
  du nouveau moteur. Le multijoueur historique n'est pas une preuve de
  fonctionnement dans la nouvelle carte.
- La première version affiche temporairement les assaillants avec le rendu
  existant du rôdeur de schiste. Le zombie mineur GLB de la bibliothèque n'a
  pas encore été intégré à l'IA/rendu du jeu.
- Les armes de mêlée existantes sont fournies au défenseur. L'arc, les
  flèches, les réparations, les brèches et les variantes de boss demandent
  encore des modules dédiés.
- L'arène est rejouable : revenir au monde libre puis relancer une partie
  reconstruit les blocs et le cristal.

## À vérifier avant fusion

1. `npm run check`, `npm run build` et `npm run build:e2e`.
2. Entrée et sortie de l'arène, contrôle des sauvegardes du monde normal.
3. Apparition, marche, collision, combat, fin des dix vagues et victoire/défaite.
4. Visibilité des bastions et sécurité des déplacements sur remparts.
5. Performances WebGL et CPU de secours ; appareils Android et iOS réels.
6. Jeu à cinq joueurs uniquement après intégration réseau du nouveau moteur.

Ne pas confondre l'existence du code en PR, la réussite des tests, sa fusion,
et sa publication sur le site public. **Work est chargé de publier une
version approuvée après fusion, puis de vérifier le site.**
