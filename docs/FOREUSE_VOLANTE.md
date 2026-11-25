# Foreuse volante — mode Libre

Identifiant de catalogue : flying-drill. Modèle voxel original construit dans le code :
src/render/flight-drill-model.ts (pas de GLB ni de téléchargement externe).

## Gameplay

La foreuse est un véhicule indépendant du dragon, disponible exclusivement dans le
mode Libre (Creative). Elle peut être montée à proximité et pilotée avec les commandes
standard des montures : ZQSD/WASD, souris, Espace pour monter, Ctrl pour descendre,
Maj pour accélérer. La caméra suit le pilote en vue trois quarts. Le foret suit la visée, même en
stationnaire. Les commandes arrière et latérales déplacent la machine en gardant
le foret orienté vers la visée.
La foreuse ne consomme pas de carburant. Le joueur ne peut descendre que sur une
zone stable, comme avec le dragon.

- **Y** permet de rejoindre la foreuse et de monter, ou de descendre après avoir atterri.
  **P** permet aussi de la rejoindre à pied depuis le mode Libre.
- **J** active ou arrête le forage continu. Avec la souris verrouillée, un clic gauche
  maintenu fore jusqu’au relâchement, indépendamment du réglage continu.
- **T** change le diamètre entre 1 × 1, 3 × 3 et 5 × 5 blocs.
- **Tactile** : le bouton « Rejoindre la foreuse » reste accessible en mode Libre.
  Une fois à bord, « Forer » et « Arrêter » commandent le foret. Maintenir la
  flèche vers le haut pour décoller et la flèche vers le bas pour atterrir.
- **Manette** : action casser pour basculer le forage et action poser pour le diamètre.

Le modèle reprend la planche validée : mèche étagée à dents, coque cuivre et acier,
pilote avec lunettes et foulard, phares et réacteur bleu. Le foret et les propulseurs
s’animent. Les deux moteurs de rendu utilisent la même géométrie.
Chaque monture est dessinée à sa propre position. Le lissage de la position
s’applique à la monture pilotée.

## Règles et sécurité des mondes

Le forage est **progressif et borné à 8 blocs par batch**. La zone de creusement
suit la visée. Chaque rayon traite d’abord le bloc rencontré sur la paroi.
Les blocs modifiés sont enregistrés via l'EditStore existant, sans modifier les IDs
de blocs ni le format historique des sauvegardes.

Les blocs des chunks **non chargés** et les couches hors des limites verticales
ne sont pas creusés par anticipation. L’eau et la roche mère bloquent le rayon concerné. La mécanique ne fonctionne pas en Aventure ni pendant
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

## Vérifications

Les tests ciblent la traversée d’une paroi, le virage à l’arrêt, le vol stationnaire,
les limites du foret, les commandes clavier et les boutons tactiles dans Chromium.
Tester sur appareils physiques avant de conclure sur le confort tactile et la fluidité.
