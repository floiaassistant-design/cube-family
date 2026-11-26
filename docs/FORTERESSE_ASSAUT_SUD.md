# Assaut massif de la face sud — Forteresse des Cinq Bastions

## Forteresse des Hautes Gorges

Dans un monde Libre sans forteresse, le bouton Construire place ce nouveau plan sur un terrain vierge. Deux falaises encadrent un passage en pente. Les zombies attaquent dans l'ordre le premier rempart, le bastion médian et le dernier refuge. Le cristal devient vulnérable après la troisième brèche. Le siège se déroule au crépuscule et des lanternes éclairent le passage. Les escaliers de chaque côté des remparts donnent accès aux chemins de ronde pendant que les portes sont fermées.

| Position        | Porte  | Repli après la brèche |
| --------------- | ------ | --------------------- |
| Premier rempart | 320 PV | Bastion médian        |
| Bastion médian  | 240 PV | Dernier refuge        |
| Dernier refuge  | 200 PV | Cour du cristal       |

Une nouvelle partie remet les trois portes en place pour la préparation. Les parties les retirent au terme du siège sans toucher aux blocs enregistrés. Les mondes contenant les Cinq Bastions gardent leur disposition à deux portes, sans reconstruction.

## Disposition historique des Cinq Bastions

## Objectif et scénario

La forteresse reste dans le **même monde Libre** de Cube Family et conserve ses
bastions, ses accès et toutes les modifications existantes. Pendant le
mini-jeu de siège, les zombies viennent **uniquement de la face sud** :

1. Ils se forment sur plusieurs rangées devant la grande porte.
2. Ils convergent vers la porte extérieure en bois, la frappent et la détruisent.
3. Ils avancent jusqu'à la seconde porte intérieure et doivent la briser.
4. Ils envahissent la cour et attaquent le cristal du donjon.
5. Le joueur les repousse à l'épée ou à l'arc, depuis la cour ou les remparts.

Les autres murs et bastions ne subissent pas de dégâts permanents et les
monstres ne traversent pas les murs : ils passent par les ouvertures sud,
uniquement après la rupture de leurs portes.

## Ampleur et performances

- **Vague normale 1 : 28 zombies** ; vague normale 10 : **136 zombies** au
  total, présentés progressivement.
- Le nombre de zombies **simultanément actifs** est strictement borné :
  44 maximum sur ordinateur WebGL, 24 sur appareils tactiles WebGL et
  14 avec le rendu de secours CPU ; le moteur possède un plafond absolu de 48.
- La première porte a 320 PV, la seconde 240 PV. Zombies blindés et boss
  infligent davantage de dégâts aux portes.
- Après un siège, une nouvelle partie reconstruit les portes temporaires
  et remet leurs points de vie à zéro.
- Les groupes apparaissent en plusieurs rangées et sept couloirs convergents,
  sans calculs de pathfinding coûteux. Les zombies avancent par le corridor
  des deux portes de la face sud.

Ces valeurs initiales sont à équilibrer après les premiers essais réels.
Les tests automatisés sous Chromium avec rendu logiciel ne prouvent **pas**
que les effets resteront fluides sur un téléphone réel.

## Portes destructibles et sauvegardes

Les portes sont un **overlay voxel temporaire** sur des ouvertures déjà
présentes dans la forteresse. Les blocs de planches apparaissent au démarrage
du siège et disparaissent après leur destruction ; les joueurs les voient
dans WebGL **et** dans le moteur CPU, et ils ont une collision réelle.

- `src/game/siege/assault.ts` : formations, portes et itinéraire sud.
- `src/game/siege/session.ts` : arrivée des hordes, points de vie, attaques
  des portes, assauts du cristal.
- `src/game/siege/gate-overlay.ts` : apparition/destruction voxel en mémoire,
  synchronisée avec les chunks chargés, sans appel à `EditStore.record`.
- `src/main.ts` : raccordement au streaming de chunks, son et débris des
  deux portes, adaptation du nombre d'ennemis au périphérique.
- `src/render/creature-view.ts` : apparition plus lointaine des groupes sur
  le front sud ; le rendu CPU conserve une distance réduite.
- `src/ui/siege-panel.ts` : indication « Assaut sud » et vie des deux portes.

**Aucun changement des clés ou formats de sauvegarde.** Le siège n'écrit
aucune destruction de portes dans la sauvegarde du monde. À la fin, l'overlay
est retiré et le passage d'origine est retrouvé. Le code reste compatible
avec les forteresses déjà construites sous la PR #9.

## Coordination des PR

Cette évolution est développée sur une **PR empilée sur la PR #11**
(armurerie) afin que les modifications de `session.ts` et du panneau
restent cohérentes sans conflit. Elle ne doit pas être fusionnée directement
dans `main` avant la PR #11 et les vérifications correspondantes.

Le site public, la progression de l'armurerie et le multijoueur à cinq
font l'objet d'étapes distinctes. Work assure les publications.

## Contrôles

- Tests unitaires : front sud unique, budgets et plafonds, passages obligés
  dans l'ordre, destruction des deux portes, arrivée au cristal, reprise
  du siège, overlay après rechargement/unload de chunk, conservation des
  autres blocs et absence de mutations des sauvegardes.
- Test navigateur : apparition des deux portes après le lancement du mini-jeu,
  porte extérieure/intérieure en planches, disparition temporaire des portes
  à l'arrêt et restauration du monde.
- Vérifications manuelles à faire ensuite : choix des cadences, lisibilité
  des hordes et FPS en WebGL PC, Android, iOS et tablettes physiques.
