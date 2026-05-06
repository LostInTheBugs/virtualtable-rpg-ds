# VirtualTable RPG

Table de jeu de rôle virtuelle en ligne — clone de Roll20, auto-hébergé.

**Stack** : Node.js · Express · Socket.io · PostgreSQL · Docker · nginx

## Fonctionnalités

- Cartes interactives avec tokens, brouillard de guerre, murs et éclairage dynamique
- Fiches de personnage D&D 5e complètes (stats, sorts, inventaire, sous-classes)
- Chat avec jets de dés, messages privés, macros
- Musique d'ambiance et effets météo
- Journal de campagne Markdown, handouts partagés, tables aléatoires
- Montée de niveau avec approbation MJ (règles D&D 5e)
- Système de vision par personnage
- Import de cartes UVTT

## Installation

### Prérequis

- Un serveur Linux (Ubuntu 22.04 / Debian 12 recommandé)
- Docker >= 20.10 avec le plugin Compose
- Un nom de domaine pointant vers le serveur (enregistrement A)
- Ports 80 et 443 ouverts

### Installation en une commande

```bash
git clone https://github.com/VOTRE_COMPTE/virtualtable-rpg.git
cd virtualtable-rpg
sudo ./install.sh
```

Le script :
1. Vous demande votre domaine et email
2. Génère automatiquement les secrets (JWT, mot de passe DB)
3. Obtient un certificat SSL Let's Encrypt
4. Lance l'application en HTTPS
5. Configure le renouvellement automatique du certificat

### Configuration manuelle

Si vous préférez configurer avant de lancer :

```bash
cp .env.example .env
nano .env          # Renseigner DOMAIN, CERTBOT_EMAIL, et les secrets
sudo ./install.sh
```

## Mise à jour

```bash
git pull
docker compose up -d --build rpg
# Pour le frontend (pas de rebuild nécessaire) :
# git pull suffit — nginx sert les fichiers directement depuis ./frontend/
```

## Commandes utiles

```bash
# Logs en direct
docker compose logs -f rpg

# Redémarrer un service
docker compose restart rpg

# Sauvegarder la base de données
docker exec rpg-db pg_dump -U rpg rpg > backup_$(date +%Y%m%d).sql

# Restaurer une sauvegarde
cat backup.sql | docker exec -i rpg-db psql -U rpg rpg
```

## Structure du projet

```
├── backend/          — API REST + Socket.io (Node.js)
│   ├── routes/       — Endpoints REST
│   ├── socket/       — Handlers temps réel
│   ├── middleware/   — Auth JWT
│   └── schema.sql    — Schéma PostgreSQL
├── frontend/         — Interface HTML/CSS/JS
├── nginx/            — Configuration nginx (templates)
├── docker-compose.yml
├── .env.example
└── install.sh        — Script d'installation
```

## Sécurité

- `.env` n'est **jamais** commité (exclu par `.gitignore`)
- Tous les secrets sont générés aléatoirement à l'installation
- HTTPS obligatoire via Let's Encrypt
- JWT pour l'authentification

## Licence

Usage personnel / auto-hébergement.
