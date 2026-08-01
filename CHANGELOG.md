# Changelog

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
