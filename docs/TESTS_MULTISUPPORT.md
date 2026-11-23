# Cube Family — Matrice de vérification PC, téléphone et tablette

## Principe

Un seul moteur de jeu est partagé entre les versions navigateur PC, téléphone et tablette. **Aucune tablette physique n'est nécessaire pour continuer le développement** : la CI utilise Chromium et des profils de viewport avec la saisie tactile émulée.

La simulation **ne remplace pas** les essais sur un vrai appareil : GPU/WebGL, Safari iOS/iPadOS, clavier virtuel, barres système, encoche, mémoire, performances, sensations tactiles et modèles de tablettes différents restent hors de portée d'une simple émulation.

## Vérifications automatiques

Le scénario `scripts/visual-check.mjs` conserve les tests clavier/souris PC, rendu, inventaire, contrôle tactile téléphone, animaux, dragon, forteresse et sauvegardes. Il appelle désormais `scripts/device-layout-check.mjs` dans le **même contexte de jeu tactile** pour vérifier que les menus et le HUD restent accessibles aux dimensions suivantes :

| Profil émulé | Dimensions CSS | Orientation | Interaction vérifiée |
| --- | --- | --- | --- |
| Téléphone | 390 × 844 | Portrait | Mondes/import, réglages, jeu, boutons tactiles, pause |
| Téléphone | 844 × 390 | Paysage | Idem, défilement des menus courts en hauteur |
| Tablette | 768 × 1024 | Portrait | Idem, largeur des commandes et des menus |
| Tablette | 1024 × 768 | Paysage | Idem, HUD et barre d'inventaire |

Chaque test contrôle les éléments non coupés horizontalement, les possibilités de défilement, les actions accessibles sans clavier et le retour en jeu. Ces tests partagent les règles métier : **aucune duplication des systèmes de jeu**.

## État des plateformes

- **Web PC** : suite navigateur Chromium et tests clavier/souris en CI. Essais matériels multiples à compléter.
- **Web téléphone** : Chromium en émulation tactile, modes portrait/paysage ; test sur vrai Android et Safari iOS encore à réaliser.
- **Web tablette** : Chromium en émulation tactile, modes portrait/paysage ; test sur vraie tablette non réalisé.
- **Paquets Windows/macOS/Linux et Android/iOS** : enveloppes expérimentales non certifiées ; ce chantier ne les publie pas.

Cibles de performance proposées à confirmer sur appareils physiques : 60 FPS PC et 30 FPS mobile/tablette. Aucune mesure de CI exécutée sur GPU logiciel ne valide ces cibles.

## Procédure pour les prochaines PR

1. Pour tout changement visuel ou tactile, lancer `npm run check`, `npm run build`, `npm run build:e2e` et `bash scripts/run-browser-check.sh`.
2. Documenter les quatre formats et la saisie tactile, ainsi que les erreurs de navigation/import/inventaire constatées.
3. Garder séparés l'état « testé en émulation », « testé sur appareil réel » et « publié et vérifié sur site ».
4. Reporter les problèmes matériels observés par les joueurs dans Notion, sans bloquer inutilement le développement lorsque le matériel n'est pas disponible.

Voir [plan directeur V1.0](https://app.notion.com/p/4216633072a8818980defc41fe28c114), [architecture](ARCHITECTURE.md) et [procédures](PROCESSUS_GITHUB_NOTION.md).
