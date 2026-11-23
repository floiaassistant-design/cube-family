# Cube Family

**Nom public officiel : Cube Family.** Toujours employer ce nom dans l’interface, les métadonnées et les nouvelles publications. Conserver les crédits du moteur libre Lumenwild, la licence MIT, les sauvegardes et les identifiants techniques stables tant qu’une migration n’est pas validée.

Cette base reprend le moteur libre de Lumenwild, © Vincent Plessy. La licence [MIT](LICENSE), les crédits et les fonctionnalités héritées sont à conserver. Le jeu web autonome est la cible prise en charge. Electron et Capacitor sont conservés pour un chantier distinct.

## Architecture

| Chemin                                 | Responsabilité                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/main.ts`                          | Amorçage, orchestration des systèmes, boucle de jeu et cycle de sauvegarde                         |
| `src/world/`                           | Monde déterministe par graine, chunks, génération en workers, modifications et sauvegardes locales |
| `src/player/`, `src/input/`            | Contrôleur, collisions, rayon d’interaction, commandes clavier, souris et manette                  |
| `src/render/`                          | Three.js/WebGL2, maillage en workers, qualité adaptative et rendu CPU de secours                   |
| `src/ui/`, `src/i18n.ts`, `src/audio/` | Interface, tactile, textes français et anglais, audio procédural                                   |
| `src/game/`                            | Inventaire, fabrication et découvertes du mode Aventure existant                                   |
| `vite.config.ts`, `public/`            | Compilation statique, métadonnées PWA et service worker généré                                     |
| `desktop/`, `mobile/`                  | Enveloppes Electron et Capacitor conservées à titre expérimental                                   |
| `scripts/`, `.github/workflows/`       | Vérifications du jeu dans Chromium et CI de vérification uniquement                                |

## Développement

- Utiliser la version de Node de `.node-version`, `npm ci --ignore-scripts` et les versions verrouillées. Installer Chromium ou Chrome depuis sa source officielle et fournir `PUPPETEER_EXECUTABLE_PATH` pour les tests fonctionnels.
- Reporter les changements du jeu en commun dans `src/` et les tests concernés sur GitHub et sur le site. Compiler les cibles web et native depuis ce même code.
- Suivre TypeScript strict, ESLint et Prettier. Réutiliser les contrôleurs et types existants. Traduire les éléments visibles en français et en anglais. Garder la génération déterministe et limiter le travail sur le thread de rendu.
- Préserver le mode Créatif, le mode Aventure, les contrôles, la génération, le rendu CPU de secours et le jeu hors ligne. Conserver les clés, identifiants de blocs et formats des sauvegardes existantes. Tester toute migration avec de vraies données d’une version précédente.
- Garder `dist-e2e/` pour les essais locaux et la CI. L’interface de débogage `window.__mc` est réservée au développement et à cette compilation. La compilation de publication est `npm run build` dans `dist/`.

## Sécurité

- Garder le jeu local. Toute nouvelle collecte, permission ou requête vers un hôte extérieur exige une décision explicite. Le serveur statique peut avoir ses propres journaux de connexion, indépendamment du jeu.
- Traiter les valeurs URL, les sauvegardes et les échanges avec les workers comme des données non fiables. Valider avant d’allouer ou d’appliquer les changements et ne pas insérer de saisie utilisateur avec `innerHTML`.
- Interdire clés, jetons, données personnelles et sauvegardes d’utilisateurs dans les commits, la CI, les captures et les rapports publics. Exécuter les contributions et installations non vérifiées dans un environnement isolé, avec un profil navigateur vierge et sans identifiants.
- Auditer les modifications de dépendances, garder les verrous cohérents, utiliser des actions épinglées par SHA et limiter les permissions de la CI à `contents: read`. Les recettes amont sont archivées sous `docs/upstream-workflows/` avec l’extension `.disabled`.
- Garder les recettes de publication manuelles. Aucun workflow ne déploie le site existant. Pour un futur hébergement, vérifier HTTPS, la portée du service worker, l’isolation de l’origine et les en-têtes CSP et Permissions-Policy avec la version de publication.

## Vérifications

1. Lancer `npm run check` puis `npm run build`.
2. Lancer `npm run build:e2e`, puis `bash scripts/run-browser-check.sh` avec Chromium. Le script sert les deux compilations en boucle locale et teste le menu, le monde, les contrôles, la sauvegarde, le hors-ligne et l’absence d’interface de débogage dans la version publique.
3. Lancer `npm audit --package-lock-only --ignore-scripts` à la racine et avec `--prefix desktop` puis `--prefix mobile`. Vérifier les workflows avec `actionlint` et l’historique destiné à être publié avec Gitleaks en mode masqué.
4. Enregistrer les résultats réels, la version de Chromium, la graine, les réglages, les régressions et les cas non testés. Valider la compilation publique en environnement local ou de prévisualisation autorisé, puis attendre la validation de Florian avant tout changement du site existant.

## Performances et tactile

- Utiliser la même graine, la même scène et les mêmes profils de rendu pour comparer deux versions. Suivre les FPS, le 95e percentile du temps d’image, le délai de chargement des chunks et le tas JavaScript. Pour une séance de jeu prolongée sur appareil réel, suivre aussi la mémoire du processus et les pertes de contexte WebGL.
- Cibles de validation proposées sur appareils réels avec le profil adapté. Viser 60 FPS sur ordinateur et au moins 30 FPS sur téléphone ou tablette en jeu actif. Documenter le matériel et vérifier que les déplacements restent fluides lorsque la génération de chunks est en cours. Traiter les mesures du rendu logiciel comme une référence de CI.
- Tester portrait et paysage, écran à encoche, pointeur et tactile combinés, gestes simultanés avec les deux pouces, pression des boutons pendant un geste et récupération après interruption ou rotation. Garder les commandes accessibles sans clavier et éviter les contrôles qui se chevauchent.
- Tester au minimum Chromium sur ordinateur, Chrome sur Android et Safari sur iOS/iPadOS avant publication. Ajouter une session Firefox et une session clavier/souris AZERTY lors de toute modification des entrées ou de l’affichage.
