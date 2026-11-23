# Catalogues Cube Family

Les fiches JSON servent de **registre de suivi**, pas de moteur de jeu.
La logique exécutable se trouve dans `src/`.

- [Créatures et monstres](creatures.json)
- [Outils et équipements](equipements.json)
- [Modèles 3D disponibles](../../assets/3d/INDEX.json)

## Statuts

- `integrated_in_code` : la fonctionnalité existe dans les sources, mais
  sa publication sur le site ou son fonctionnement mobile ne sont pas
  automatiquement garantis.
- `asset_only` : le modèle 3D existe dans GitHub, mais la fonctionnalité
  correspondante n'est pas intégrée.

Un changement d'état exige un lien vers le code et des tests, puis un état
distinct pour la publication dans Notion. Ne jamais écrire « publié »
à partir de la seule présence du modèle ou d'une PR fusionnée.

Les `id` des objets et des blocs sont persistés dans les sauvegardes :
ne jamais les réattribuer. Chaque modèle GLB conserve son historique
de versions dans `assets/3d/`.

Ajouter les futures idées dans Notion avant de leur attribuer un identifiant
stable et d'écrire du code. Vérifier ces catalogues avec
`npm run check:catalogues`.
