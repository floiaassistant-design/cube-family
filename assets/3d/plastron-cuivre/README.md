# Plastron du gardien

- Identifiant stable proposé / existant : `copper-armor`.
- Identifiant du modèle : `plastron-cuivre`.
- Modèle : `plastron-cuivre_v1.glb`, glTF 2.0, Y vertical, unités en mètres.
- Formes : volumes voxel originaux, matériaux colorés, sans ressource externe.
- Pivot suggéré : nœud `GripAnchor` (position à ajuster selon la main ou le buste).
- Rôle : Objet de jeu copper-armor déjà codé; ce modèle GLB n'est pas encore attaché au joueur.
- Statut : Objet existant, modèle visuel non intégré.

## À faire par Work

Conserver le moteur existant. Définir les statistiques et recettes dans Notion avant intégration. Ajouter les règles dans `src/game/`, les commandes dans `src/ui/` / `src/input/` et l'affichage dans `src/render/`. Prévoir tenue en main, changement d'équipement, sauvegardes, collisions, tactile et rendu CPU. Tester PC et mobile. La présence du GLB dans GitHub n'est pas une preuve de publication.
