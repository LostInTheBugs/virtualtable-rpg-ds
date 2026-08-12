# VirtualTable RPG

Self-hosted online tabletop RPG (VTT).

**Stack**: Node.js · Express · Socket.io · PostgreSQL · Docker · nginx

## Features

- Interactive maps with tokens, fog of war, walls and dynamic lighting
- Full D&D 5e character sheets (stats, spells, inventory, subclasses)
- Chat with dice rolls, private messages, macros
- Ambient music and weather effects
- Markdown campaign journal, shared handouts, random tables
- Leveling with GM approval (D&D 5e rules)
- Per-character vision system
- UVTT map import

## Installation

### Prerequisites

- A Linux server (Ubuntu 22.04 / Debian 12 recommended)
- Docker >= 20.10 with the Compose plugin
- Git

### Install

```bash
git clone https://github.com/LostInTheBugs/virtualtable-rpg-ds.git
cd virtualtable-rpg-ds
sudo ./install.sh
```

The script asks three questions at startup:

**Web server** — three options:
- Built-in Nginx (Docker) with automatic Let's Encrypt SSL — recommended for a fresh server
- Nginx or Apache already installed — the script prints the directives to add to your vhost
- No proxy — the backend is exposed directly on port 8007

**Database** — two options:
- Built-in PostgreSQL (Docker) — no configuration required
- Existing PostgreSQL (local or remote) — you provide the connection URL; the schema is applied automatically if `psql` is available

The script then automatically generates the secrets (JWT, DB password) and starts the application.

## Configuration

Copy the example file and edit the variables:

```bash
cp .env.example .env
nano .env
```

**Main environment variables:**

| Variable | Default | Description |
|---|---|---|
| `RPG_PORT` | `8007` | Backend listen port |
| `RPG_BIND` | `127.0.0.1` | Binding interface |
| `DATABASE_URL` | — | PostgreSQL connection URL |
| `JWT_SECRET` | — | JWT secret key (auto-generated) |
| `ALLOWED_ORIGIN` | — | Public URL for CORS |
| `DOMAIN` | — | Domain name |
| `COMPOSE_PROFILES` | `db,nginx` | Docker profiles: `db`, `nginx` |

**Dependencies:** Docker >= 20.10 with the Compose plugin, Git.

## Usage

```bash
# Install
sudo ./install.sh

# Update
sudo ./update.sh

# Logs
docker compose logs -f rpg

# Backup
docker exec rpg-db pg_dump -U rpg rpg > backup_$(date +%Y%m%d).sql
```

## Version

Current version: **2026.08.001**

[Release notes and GitHub releases](https://github.com/LostInTheBugs/virtualtable-rpg-ds/releases)

## Project structure

```
├── backend/          — REST API + Socket.io (Node.js)
│   ├── routes/       — REST endpoints
│   ├── socket/       — Real-time handlers
│   ├── middleware/   — JWT auth
│   └── schema.sql    — PostgreSQL schema
├── frontend/         — HTML/CSS/JS interface
├── nginx/            — nginx configuration (templates)
├── docker-compose.yml
├── .env.example
└── install.sh        — Installation script
```

## Security

- `.env` is **never** committed (excluded by `.gitignore`)
- All secrets are randomly generated at installation
- HTTPS mandatory via Let's Encrypt
- JWT for authentication

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

## License

Personal use / self-hosting.
