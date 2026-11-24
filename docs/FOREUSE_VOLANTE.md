# Foreuse volante — mode Libre

**Statut : en développement sur branche GitHub ; non fusionné et non publié.**
Identifiant de catalogue : flying-drill. Modèle voxel original construit dans le code :
src/render/flight-drill-model.ts (pas de GLB ni de téléchargement externe).

## Gameplay

La foreuse est un véhicule indépendant du dragon, disponible exclusivement dans le
mode Libre (Creative). Elle peut être montée à proximité et pilotée avec les commandes
standard des montures : ZQSD/WASD, souris, Espace pour monter, Ctrl pour descendre,
Maj pour accélérer. La caméra suit le personnage installé dans le cockpit.
La foreuse ne consomme pas de carburant. Le joueur ne peut descendre que sur une
zone stable, comme avec le dragon.

- **P** : rejoindre la foreuse depuis le mode Libre, si une zone de débarquement
  sûre est disponible (ne fait pas apparaître une nouvelle machine).
- **R** : monter / descendre si le véhicule est accessible.
- **Clic gauche maintenu** : forer ; **J** : activer / arrêter le forage continu.
- **T** : changer le diamètre entre 1 × 1, 3 × 3 et 5 × 5 blocs.
- **Tactile** : boutons « Forer » et diamètre dans la barre supérieure, en plus
  des boutons de vol et de montée/descente.
- **Manette** : action casser pour basculer le forage et action poser pour le diamètre.

Le foret tourne pendant le forage. Le réacteur arrière et les stabilisateurs latéraux
sont représentés par des volumes luminescents. La silhouette et le pilote sont visibles
en vue externe, y compris dans le rendu CPU de secours lorsqu'il est affiché.

## Règles et sécurité des mondes

Le forage est **progressif et borné à 8 blocs par batch**. La zone de creusement
est une section perpendiculaire à la direction du véhicule et à son inclinaison.
Les blocs modifiés sont enregistrés via l'EditStore existant, sans modifier les IDs
de blocs ni le format historique des sauvegardes.

Les blocs des chunks **non chargés** et les couches hors des limites verticales
ne sont pas creusés par anticipation. L'eau est ignorée pour ne pas engendrer
des incohérences de fluide. La mécanique ne fonctionne pas en Aventure ni pendant
une session de siège active. Le diamètre 1 × 1 est un mode de précision : le
véhicule lui-même ne traverse pas un trou aussi étroit.

La position de parking est enregistrée dans une clé locale indépendante par
graine. Pendant le vol, un retour en partie conserve le dernier parking sûr,
et non la position en plein vol. Le véhicule n'est pas synchronisé en multijoueur ;
la mise en commun devra attendre une autorité serveur.

## Architecture

- src/game/flight-drill.ts — choix du diamètre, planification de creusement,
  budget par intervalle et variante de monture
- src/render/flight-drill-model.ts — géométrie voxel, pilote et animations
- src/ui/touch-controls.ts — boutons tactiles dédiés
- src/main.ts — raccordement aux systèmes existants, sauvegarde, messages et HUD
- src/game/flight-drill.test.ts — tests purs pour les zones de creusement

La collision de monture est désormais paramétrable dans DragonMount pour permettre
une coque plus étroite sans toucher au comportement physique du dragon.

## Validation restante

Exécuter lint, Prettier, TypeScript, Vitest, tests navigateur, et contrôles
de catalogue. Puis vérifier les commandes réelles sur PC, Chrome Android et
Safari iOS/iPadOS avant fusion/publication. Attention à la capacité de stockage
du navigateur en cas de très longues excavations ; garder des sauvegardes exportées.
