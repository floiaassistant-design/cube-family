# Feuille de route Cube Family

**Plan directeur V1.0 et liste des tâches complète :** [Notion — Cube Family, plan directeur](https://app.notion.com/p/4216633072a8818980defc41fe28c114) et [vue GitHub](PLAN_VERSION_1_0.md). Les statuts de publication sont différents des statuts de code.


Le mode Créatif et le mode Aventure de Cube Family restent disponibles pendant le développement. L’Aventure offre déjà collecte, fabrication limitée et journal. Les étapes ci-dessous décrivent les ajouts futurs.

| Étape                                | Travail prévu                                                                                                | Validation attendue                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 1. Socle                             | Mesurer la fluidité sur de vrais appareils, protéger `main` et rendre les tests CI obligatoires              | Génération, sauvegarde locale, tactile et réseau validés avant publication                          |
| 2. Identité originale                | Définir le nom public, les textures, l’interface, le son et les créatures à partir d’une direction originale | Actifs et traces de licence vérifiés                                                                |
| 3. Survie                            | Concevoir santé, dégâts, réapparition et progression distincte de l’Aventure                                 | Sauvegarde compatible et boucle jouable du premier jour à la première nuit                          |
| 4. Monstres nocturnes                | Faire dépendre les nouvelles apparitions de la nuit et limiter leur densité                                  | Aucune nouvelle apparition le jour, tests aux transitions et budget CPU respecté                    |
| 5. Animaux et chatons                | Ajouter comportements simples, interactions et apparitions contrôlées                                        | Bon fonctionnement de jour comme de nuit et persistance vérifiée                                    |
| 6. Diamants et cuivre                | Attribuer des identifiants stables, définir profondeur, rareté et recettes                                   | Génération reproductible et aucun changement rétroactif des blocs sauvegardés                       |
| 7. Fabrication et inventaire tactile | Étendre les recettes héritées et concevoir une interface lisible à une main, en portrait et paysage          | Fonctionnement souris et tactile, prise en compte des petits écrans et conservation des inventaires |

## Gestion des mondes — étape locale (23 novembre 2026)

- Registre local versionné : nom, graine, mode, création et dernière ouverture ; liste sur ordinateur et tactile.
- Découverte des anciennes sauvegardes par lecture des clés existantes sans les réécrire.
- Création par nom avec graine aléatoire inutilisée, choix Créatif/Aventure, reprise, renommage et suppression confirmée d'un monde inactif. Une graine ne peut identifier qu'une seule sauvegarde locale dans ce format.
- La graine partagée ne synchronise **pas** les modifications, personnages ou inventaires. Ne pas présenter « Rejoindre un monde » comme actif avant serveur sécurisé et tests à cinq joueurs.
- À venir : sauvegardes exportables/restaurables, monde partagé persistant avec invitation par code, contrôle d'accès, autorité serveur et vérification mobile réelle.
