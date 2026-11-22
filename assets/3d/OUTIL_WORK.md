# Mode d’emploi — ChatGPT Work, Minecraft Family

Ce dossier centralise les créations destinées au jeu. Chaque ajout doit posséder son propre sous-dossier.

## Reprise du travail

1. Ouvrir `assets/3d/INDEX.json` pour repérer les nouveaux fichiers.
2. Lire la fiche `README.md` du modèle visé, notamment son statut.
3. Si `model_source` est `.glb.gz.b64`, exécuter :

```bash
python assets/3d/restore_glb.py SOURCE.glb.gz.b64 CIBLE.glb
```

4. Vérifier le SHA-256 annoncé et charger le GLB localement dans Three.js ; ne pas utiliser les éventuels aperçus HTML comme dépendance du jeu.
5. Préserver les couleurs de sommets, les axes et les clips d’animation glTF. Adapter échelle, collisions et déplacements à l’architecture existante.
6. Tester PC, tactile, hors ligne, sauvegardes et règles du monde. Lancer `npm run check`, `npm run build` et les tests prescrits par `AGENTS.md`.
7. Faire une PR et attendre validation avant publication.

## Distinction essentielle

- **Asset disponible** : fichier dans GitHub, Work peut l’employer.
- **Asset intégré** : code du jeu modifié et vérifié, après PR.
- **Site publié** : opération distincte, jamais automatique.

Conserver les versions antérieures et ne pas introduire de collecte ou de ressources réseau nouvelles.
