# Dragon rouge montable

Le modèle v0.3 reprend le dragon voxel rouge et or de l’illustration. Les ailes ont un poignet surélevé, quatre doigts, des bords festonnés et des pointes dorées. Le museau est raccourci, le poitrail et les pattes sont plus larges et la queue se recourbe plus haut.

## Jouer

Un dragon apparaît dans une clairière à proximité du point de départ de chaque monde, en Créatif comme en Aventure, avec WebGL2.

| Action                            | Clavier                   | Tactile               | Manette standard  |
| --------------------------------- | ------------------------- | --------------------- | ----------------- |
| Monter ou quitter la selle        | R                         | Bouton dédié          | X                 |
| Se déplacer et tourner            | ZQSD, WASD ou les flèches | Joystick gauche       | Stick gauche      |
| Regarder                          | Souris                    | Glisser à droite      | Stick droit       |
| Décoller et prendre de l’altitude | Espace                    | Flèche vers le haut   | A                 |
| Descendre et se poser             | C ou Ctrl gauche          | Flèche vers le bas    | B                 |
| Accélérer                         | Maj                       | Joystick vers le bord | Clic stick gauche |

Garder une direction en relâchant la montée déclenche le vol plané. La descente de selle demande un emplacement sec et dégagé. Si la partie est fermée en selle, le personnage et le dragon reviennent au dernier emplacement sûr. Le jeu enregistre cette position par monde avec l’inventaire existant.

## Modifier le modèle

`python3 assets/3d/dragon-rouge/generer_dragon.py` régénère le fichier `dragon_voxel_rouge_v03.glb.gz` avec la bibliothèque standard de Python.

Pour l’ouvrir dans une visionneuse glTF, décompresser le fichier avec `gzip -dc dragon_voxel_rouge_v03.glb.gz > dragon_voxel_rouge_v03.glb`. Le modèle utilise Z vertical et -X vers l’avant. Le jeu oriente et met à l’échelle les nœuds, anime les ailes, les pattes et la queue, et place le cavalier sur `SeatAnchor`. Le volume de collision couvre le tronc et le cavalier. Les ailes et la queue utilisent leurs propres formes visuelles.
