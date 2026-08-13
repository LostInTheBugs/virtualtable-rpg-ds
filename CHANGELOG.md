# Changelog

## 2026.08.008 (2026-08-13)

### Ajouts
- **Animations vidéo (I2V) pour les 108 races** : chaque race des 15 systèmes a maintenant son animation générée (LTX 0.9.5, ~2 s, 512×512) — le lien « Animation » apparaît automatiquement au choix de la race, en complément des 7 races Cats déjà animées (115 races animées au total).
- ComfyUI du lab stabilisé : mise à jour 0.32.0 + `--disable-cuda-malloc` + watchdog RAM + swap 11 GB (plus de segfaults sous charge, 108 jobs d'affilée sans incident).

## 2026.08.006 (2026-08-13)

### Ajouts
- **Portraits automatiques pour toutes les classes** : 142 portraits IA générés (RealVisXL) couvrant les 15 systèmes (Barbare, Magicien, Jedi, Decker, Nosferatu Ancilla…). À la création de personnage, sélectionner une classe remplit aussi automatiquement le portrait (dernier choix gagnant). Nouvelle map `SYSTEM_CLASS_PORTRAITS` (lobby.html) ; 3 classes réutilisent leur portrait de race (Vagabond Cats, Mentat et Bene Gesserit Dune).

### Technique
- Génération IA en lots résilients (le lab a subi 2 segfaults ComfyUI sous charge — reprise automatique par lots de 20 avec vérification des fichiers).

## 2026.08.004 (2026-08-13)

### Ajouts
- **Portraits automatiques pour toutes les races** : 108 portraits IA générés (RealVisXL) couvrant les 15 systèmes (D&D 5e, Pathfinder 2e, Warhammer Fantasy, Call of Cthulhu, Starfinder, Shadowrun, Vampire : La Mascarade, Cyberpunk Red, Savage Worlds, Dune, Star Wars, Le Seigneur des Anneaux, Paranoia, Tomorrow City). À la création de personnage, sélectionner une race remplit automatiquement le portrait. Nouvelle map `SYSTEM_RACE_PORTRAITS` (lobby.html) remplaçant la map Cats locale.
- **Vidéos d'intro par système** : 15 cinématiques LTX générées (château fantasy, mégapole cyberpunk, désert d'Arrakis, nefs spatiales…) affichées au premier lancement de campagne via `SYSTEM_INTRO_VIDEOS`.

## 2026.08.002-c1 (2026-08-13)

### Ajouts
- **Animations I2V pour toutes les races de Cats! La Mascarade** : vidéos LTX 0.9.5 générées depuis les portraits pour Persan, Maine Coon, Bengal, Sphynx et Européen (le lien « 🎬 Animation (LTX) » de création de personnage fonctionne désormais pour les 7 races).

## 2026.08.002 (2026-08-13)

### Corrections
- **Animation des portraits de races (Cats! La Mascarade)** : l'animation proposée pour « Chat de gouttière » ne correspondait pas au portrait (mauvais asset I2V : chat roux cartoon à écharpe violette). Priorité des animations inversée en `Grok > I2V > GIF` (le code contredisait son propre commentaire qui annonçait déjà le MP4 Grok en premier), et vidéo I2V du Vagabond **régénérée depuis le portrait** (LTX 0.9.5) — l'animation montre désormais le même chat tigré brun aventurier que le portrait.

## 2026.08.001-c1 (2026-08-12)

Fusion des travaux en attente + durcissement sécurité. Port par défaut : **8007** (`RPG_PORT` surchargeable — la prod utilise `PORT=3001`).

### Sécurité
- **Quota d'upload persistant en base** : remplacement du quota mémoire par la table `uploads` (SUM par utilisateur, 500 Mo), avec routes `DELETE /rpg/api/upload/:filename` et `GET /rpg/api/upload/quota`, et script `scripts/purge-orphans.js` (liste + `--delete`)
- **Vérification magic bytes** à l'upload (contenu réel vs extension), limites 10 Mo images / 30 Mo audio
- **Socket scoped** : tous les handlers temps réel sont désormais scopés à la campagne rejointe par le socket (`scoped()`), le `campaign_id` du client est ignoré ; handlers MJ protégés par `gmOnly`
- **Anti-DoS dés** : `rollDice` limité à 100 dés / 1000 faces, expressions invalides ignorées
- **`combat_hp` ownership** : un joueur ne peut modifier les PV que de son propre personnage (PNJ et autres → MJ uniquement)
- **JWT_SECRET fail-fast** : démarrage refusé si le secret est absent ou vaut `change-me-in-production`
- **Rate limit `/campaigns/join`** : 10 tentatives / 15 min par IP (anti brute-force des codes)
- **Codes d'invitation cryptographiques** : `crypto.randomBytes` au lieu de `Math.random()`

### CI / Docs
- Workflow GitHub Actions : création automatique des releases sur push de tag
- `VERSION` + `CHANGELOG.md`, `TOKENS.md` (suivi des coûts LLM)
- README : URL de clone corrigée (`virtualtable-rpg-ds`)

### Corrections
- Message d'erreur upload cohérent avec la limite réelle (30 Mo)

## 2026.08.001 (2026-08-01)

### Changed
- **Version** : adoption du format `ANNEE.MM.NNN` (2026.08.001). Fichier `VERSION` créé à la racine, `backend/package.json` mis à jour.
- **Port par défaut** : le backend écoute désormais sur le port **8007** (au lieu de 3001). La variable `RPG_PORT` permet de surcharger ce port dans `.env`.
- **Docker** : `docker-compose.yml` et `Dockerfile` utilisent `RPG_PORT` (défaut 8007) pour le mapping de port, la variable `PORT` du conteneur et le healthcheck.
- **Scripts** : `install.sh`, `update.sh`, `deploy.sh` utilisent `${RPG_PORT}` au lieu du port 3001 codé en dur pour les healthchecks.
- **Nginx** : tous les exemples de configuration et le template par défaut pointent vers le port 8007.
- **Documentation** : `README.md` enrichi avec la section configuration (variables d'environnement, port 8007, dépendances), version courante et lien vers les releases GitHub.

### Fixed
- Suppression de tous les ports 3001 codés en dur au profit de `RPG_PORT`.
