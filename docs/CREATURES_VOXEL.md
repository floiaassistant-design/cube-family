# Créatures des modèles voxel

Les modèles sont issus de la bibliothèque originale de Cube Family. Les volumes, couleurs de sommets et pistes d’animation sont copiés des GLB dans `src/render/voxel-creature-assets.ts`. Le rendu WebGL et le rendu logiciel utilisent les mêmes volumes articulés. Le jeu peut donc afficher ces créatures hors ligne.

- **Vache brune** — Apparaît de jour dans les prairies et les clairières propices, en Libre et en Aventure. Alterne entre repos, marche et broutage. Son volume de collision évite les obstacles et les blocs placés à travers son corps. L’action Poser ou le clic droit sert à la caresser. Une vache sauvage est régénérée près du joueur, sur la base de la graine et de la zone.
- **Zombie mineur** — Partage l’apparition et les règles de combat des rôdeurs nocturnes en Aventure. Alterne avec le rôdeur de schiste. Peut attaquer à travers une ligne de vue dégagée, laisse du charbon et disparaît à l’aube. Son GLB fournit les trois animations.
- **Titan zombie** — Apparaît dans le rôle du boss existant aux vagues 5 et finale de la forteresse. Mesure environ 4,25 blocs et passe par les portes de 6 blocs. Marche vers l’enceinte et frappe les portes puis le cristal. Les clips Idle, Walk et Smash sont utilisés en jeu. Les clips Roar et Death sont conservés dans la source.
- **Chaton orange** — Le chat orange et le chaton utilisent déjà les volumes du modèle V2. Le moteur adapte l’échelle à l’âge et anime le modèle selon le déplacement.

Pour régénérer la conversion de la vache, du mineur et du Titan, exécuter `node scripts/generate-voxel-creature-assets.mjs` à la racine. Le contrôle du catalogue vérifie ensuite l’empreinte des originaux et la reproductibilité du fichier généré.
