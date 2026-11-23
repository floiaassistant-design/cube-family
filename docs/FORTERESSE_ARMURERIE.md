# Forteresse des Cinq Bastions — armurerie de siège

## Portée

Cette première armurerie est une boutique **du mini-jeu**, pas une modification
de l'inventaire général de Cube Family. Elle s'ouvre dans le panneau de la
forteresse, accessible près du cristal dans le **monde Libre**. Sur PC, presser
**M** pour libérer le curseur avant d'utiliser les boutons. Les boutons
fonctionnent aussi au toucher.

Le joueur reçoit 100 pièces en début de partie. Les éliminations rapportent
20 pièces (zombie normal), 25 (coureur), 30 (blindé) ou 80 (boss). Chaque
vague terminée rapporte 40 pièces supplémentaires. Aucun paiement réel,
aucune publicité ni aucun accès à un service extérieur.

| Offre             |            Prix | Effet                             |
| ----------------- | --------------: | --------------------------------- |
| Épée renforcée    |             100 | Dégâts de siège 4 → 6             |
| Épée, niveaux 2–4 |  75 / 125 / 175 | 8 / 10 / 12 dégâts                |
| Arc renforcé      |             150 | Dégâts 4 → 6 ; tir plus rapide    |
| Arc, niveaux 2–4  | 100 / 150 / 200 | 7 / 8 / 9 dégâts ; cadence accrue |
| 32 flèches        |              30 | Stock maximal 128                 |

Les pièces et les achats sont limités à **la partie de siège en cours**. Tout
revient à l'état initial lorsqu'une nouvelle partie démarre. Les sauvegardes,
les recettes, les blocs et les objets du monde Libre restent inchangés.

Les achats sont autorisés **pendant les 20 secondes de préparation initiale**
et **les 25 secondes entre les vagues**, uniquement si le joueur est près de
la forteresse. Il est impossible d'acheter pendant les attaques, depuis
une monture ou en utilisant l'inventaire. Les offres épuisées, inaccessibles
ou trop chères restent visibles mais désactivées.

## Implémentation modulaire

- `src/game/siege/armory.ts` : monnaie, prix, progression et transactions.
- `src/game/siege/session.ts` : attribution des récompenses, autorisation
  selon la phase, dégâts et cadence réellement améliorés.
- `src/ui/siege-armory-panel.ts` : boutons localisés et accessibilité.
- `src/ui/siege-panel.ts` : bouton d'accès à l'armurerie.
- `src/main.ts` : seul raccordement à la proximité du joueur et au HUD.

Une arme achetée **ne crée pas un objet permanent** dans le sac, n'a pas
encore de nouveau modèle 3D, n'est pas une recette et ne peut pas être
utilisée hors des vagues. Un vrai système général d'armes et armures
nécessitera des IDs, modèles, recettes, sauvegardes et tests indépendants.

## Contrôles avant fusion et publication

- Tests unitaires : tarifs, fonds insuffisants, doublons, limite de rang,
  limite des flèches, récompenses, dégâts, phases et remise à zéro.
- Test navigateur : ouvrir l'armurerie, acheter une épée, vérifier la
  déduction et la remise à zéro ; non-régression des 70 tests existants.
- Tests PC, téléphone et tablette physiques non couverts par GitHub CI.
- La branche principale et la publication de la forteresse de base par
  Work ne doivent pas être modifiées pendant ce développement.
