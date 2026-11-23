# Bibliothèque 3D — Minecraft Family

Dossier de dépôt des créations 3D destinées à Minecraft Family. **Cette bibliothèque n'est pas chargée automatiquement dans le jeu.** Work doit d'abord valider et intégrer les modèles.

## Organisation

- `chaton-orange/` : premières versions du chaton voxel, avec modèle 3D et informations d'intégration.
- [Dragon rouge](dragon-rouge/README.md) — modèle v0.3 et commandes de la monture intégrée au jeu.
- `INDEX.json` : inventaire des modèles, versions et états d'intégration.
- `OUTIL_WORK.md` : marche à suivre pour récupérer un nouvel objet, le tester, et l'intégrer.

## Conventions pour les prochaines créations

Chaque modèle possède son propre répertoire : `assets/3d/<nom>/`.
Les fichiers attendus sont le modèle `.glb` (ou une représentation compressée récupérable sans perte), une image de référence, un éventuel aperçu, une fiche descriptive et, si possible, un script de fabrication.
Ne jamais remplacer silencieusement un modèle déjà utilisé : créer une nouvelle version (`v2`, `v3`, etc.).
Toutes les créations sont originales. Éviter de recopier des ressources protégées d'autres jeux.

Les ressources sont préparées ici pour Work, mais **aucun ajout dans ce dossier ne signifie qu'il est déjà publié dans Minecraft Family**.

## Règles d'intégration Work

1. Vérifier `AGENTS.md` à la racine et l'architecture réelle du jeu.
2. Repérer les nouvelles entrées dans `INDEX.json`.
3. Restaurer un fichier `.glb` lorsqu'il est conservé en `.glb.gz.b64` (voir `OUTIL_WORK.md`).
4. Charger via le moteur Three.js/WebGL existant, en préservant le fonctionnement hors ligne.
5. Ajouter le modèle au monde, dimensionner les collisions et animer les parties prévues.
6. Tester la vitesse, le rendu, PC et tactile ; ne pas supprimer les fonctions existantes.
7. Préparer les changements sur une branche/PR et ne publier le site qu'après validation.
