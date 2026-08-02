# VirtualTable RPG

Table de jeu de rôle virtuelle en ligne, auto-hébergée.

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
- Git

### Installation

```bash
git clone https://github.com/LostInTheBugs/virtualtable-rpg.git
cd virtualtable-rpg
sudo ./install.sh
```

Le script pose trois questions au démarrage :

**Serveur web** — trois options :
- Nginx intégré (Docker) avec SSL automatique Let's Encrypt — recommandé pour un serveur vierge
- Nginx ou Apache déjà installé — le script affiche les directives à ajouter à votre vhost
- Aucun proxy — le backend est exposé directement sur le port 8007

**Base de données** — deux options :
- PostgreSQL intégré (Docker) — aucune configuration requise
- PostgreSQL existant (local ou distant) — vous fournissez l'URL de connexion ; le schéma est appliqué automatiquement si `psql` est disponible

Le script génère ensuite automatiquement les secrets (JWT, mot de passe DB) et démarre l'application.

## Configuration

Copiez le fichier d'exemple et éditez les variables :

```bash
cp .env.example .env
nano .env
```

**Variables d'environnement principales :**

| Variable | Défaut | Description |
|---|---|---|
| `RPG_PORT` | `8007` | Port d'écoute du backend |
| `RPG_BIND` | `127.0.0.1` | Interface de binding |
| `DATABASE_URL` | — | URL de connexion PostgreSQL |
| `JWT_SECRET` | — | Clé secrète JWT (générée automatiquement) |
| `ALLOWED_ORIGIN` | — | URL publique pour CORS |
| `DOMAIN` | — | Nom de domaine |
| `COMPOSE_PROFILES` | `db,nginx` | Profils Docker : `db`, `nginx` |

**Dépendances :** Docker >= 20.10 avec le plugin Compose, Git.

## Utilisation

```bash
# Installation
sudo ./install.sh

# Mise à jour
sudo ./update.sh

# Logs
docker compose logs -f rpg

# Sauvegarde
docker exec rpg-db pg_dump -U rpg rpg > backup_$(date +%Y%m%d).sql
```

## Version

Version courante : **2026.08.001**

[Notes de version et releases GitHub](https://github.com/LostInTheBugs/virtualtable-rpg-ds/releases)

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

## Development cost (LLM)

This project was built entirely through AI-assisted sessions (Hermes Agent, deepseek-v4-pro / deepseek-v4-flash). Usage so far (cumulative as of 2026-08-02):

| Metric | Value |
|---|---|
| Input tokens | 354 369 |
| Output tokens | 214 754 |
| **Total (input + output)** | **569 123** |
| Cache read (reused at reduced price) | 17 685 120 |
| API calls | 299 |
| **Estimated cost** | **≈ 0.41 USD** |

Full breakdown: [TOKENS.md](TOKENS.md).

## Licence

Usage personnel / auto-hébergement.
