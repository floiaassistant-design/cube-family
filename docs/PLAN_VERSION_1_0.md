# Cube Family — Plan de développement vers la V1.0

Le document maître, avec l'inventaire complet des tâches, les décisions produit, les états, la priorité, les dépendances et les critères de validation, est sur **[Notion — Plan directeur V1.0 et tâches restantes](https://app.notion.com/p/4216633072a8818980defc41fe28c114)**. Ce fichier est le sommaire technique indexé par GitHub. Notion reste la référence des priorités et décisions, GitHub celle du code et des tests.

## État vérifié au 23 novembre 2026

- **Codé et testé sur main** : mode Créatif et Aventure, monde voxel et biomes, inventaire et recettes, animaux/chats/chatons, rôdeurs nocturnes, dragon montable, équipements, forteresse solo, assaut sud et portes destructibles, bibliothèque locale des mondes. PR #16 fusionnée au commit `e4418c7e` ; 452 tests unitaires et 78 scénarios navigateur sur le commit de fusion PR.
- **Dernière publication documentée** : version 17, commit `899a5d65`, sur [le site Cube Family](https://cube-family.flo-ia-assistant.chatgpt.site/). Les commits fusionnés postérieurement ne sont pas confirmés publiés.
- **Asset uniquement** : Titan zombie V1 en bibliothèque ; Titan V2 en PR #14 ouverte (brouillon et vérifications incomplètes), pas d'IA ni intégration moteur.
- **À faire** : sauvegardes export/import, serveur de mondes partagés, multijoueur du nouveau moteur à cinq, progression Aventure, tests réels mobiles et PC, publication vérifiée.

## Ordre de priorité — jalons et critères

| Priorité | Références Notion | Jalons | Conditions de validation |
| --- | --- | --- | --- |
| P0 | W-01 à W-06 | Protection des mondes | Liste de mondes, sauvegarde/export/import, gestion des erreurs et compatibilité des mondes anciens, site à jour |
| P0 | M-01 à M-09 | Multijoueur familial | Cinq joueurs réels en simultané, invitations privées, monde et inventaires synchronisés, sauvegardes serveur et reconnexion |
| P0 transverse | T-01 à T-06 | Fiabilité | CI verte, migrations testées, mesures PC/mobile, rendu WebGL/CPU, audits et tests navigateur |
| P1 | G-01 à G-09 | Aventure intéressante | Première heure de jeu cohérente, collecte/fabrication, objectifs, combat, créatures et exploration utiles |
| P1 | F-01 à F-06 | Forteresse aboutie | Vagues équilibrées, portes fiables, Titan intégré et animé, coopération future et tests de performances |
| P1 | U-01 à U-05 | Interface et qualité | Interface adaptée tablette/téléphone, commandes, lisibilité, animations/audio cohérents, accessibilité |
| P2 | P-01 à P-03 | Extensions | Mini-jeux, échanges, version native et distribution après stabilisation de la V1.0 |

## Chantier immédiat : W-02 / W-03

Exporter en JSON une copie locale du monde choisi, avec son nom, sa graine, son mode, les constructions sauvegardées, le joueur/inventaire/animaux et la forteresse. Importer dans un navigateur vierge après validation de la taille et des données. Refuser toute graine déjà occupée, sans écraser les sauvegardes existantes. Ne pas importer de paramètres personnels ou de secrets. Fournir tests de fichier corrompu, taille excessive, conflit, espace de stockage plein et compatibilité des formats v2/v1.

**Contraintes** : pas de serveur, pas de compte ni de téléversement distant ; une graine n'est pas un monde synchronisé. Les clés des sauvegardes existantes restent inchangées. Les tests réels sur appareils et la publication du site sont deux étapes séparées.

## Règles de suivi

Chaque tâche est marquée « idée », « validé », « asset prêt », « en développement », « codé », « testé » ou « publié » selon l'étape effectivement vérifiée. Chaque PR renvoie au plan Notion, inclut tests, modules concernés, bugs connus et compatibilité des sauvegardes. Après fusion, mettre à jour Notion. Après publication autorisée, vérifier l'URL et le commit sur le site. Ne jamais confondre modèle 3D stocké, fonctionnalité codée et fonctionnalité publiée.

Voir [AGENTS.md](../AGENTS.md), [architecture](ARCHITECTURE.md), [processus GitHub-Notion](PROCESSUS_GITHUB_NOTION.md) et [feuille de route historique](feuille-de-route.md).
