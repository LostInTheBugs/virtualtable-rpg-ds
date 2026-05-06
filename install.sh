#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  VirtualTable RPG — Script d'installation
#  Usage : sudo ./install.sh
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERREUR]${NC} $*"; exit 1; }
title()   { echo -e "\n${BOLD}${CYAN}$*${NC}"; }

# ── 0. Vérifications ──────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "Ce script doit être exécuté en root ou avec sudo."
command -v docker &>/dev/null || error "Docker n'est pas installé. https://docs.docker.com/engine/install/"
docker compose version &>/dev/null || error "Le plugin 'docker compose' est requis (Docker >= 20.10)."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     VirtualTable RPG — Installation        ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"

# ── 1. Lire .env existant ou créer depuis .env.example ────────
[[ ! -f .env ]] && cp .env.example .env && info "Fichier .env créé."
set -a; source .env; set +a

# ── 2. Choisir le serveur web ─────────────────────────────────
title "── Serveur web ──────────────────────────────────────────"
if [[ -z "${COMPOSE_PROFILES:-}" ]]; then
  echo "  1) Nginx intégré (Docker) + certificat SSL automatique"
  echo "     → Recommandé pour un nouveau serveur vierge"
  echo "  2) Nginx ou Apache déjà installé sur ce serveur"
  echo "     → Le script affichera la config à ajouter"
  echo "  3) Aucun proxy — le backend sera directement accessible"
  echo "     → Pour dev local ou si vous gérez le TLS ailleurs"
  echo ""
  read -rp "Votre choix [1/2/3] : " WEB_CHOICE
else
  [[ "$COMPOSE_PROFILES" == *nginx* ]] && WEB_CHOICE=1 || WEB_CHOICE=2
  info "Profil existant détecté : COMPOSE_PROFILES=${COMPOSE_PROFILES}"
fi

USE_BUNDLED_NGINX=false
case "${WEB_CHOICE:-1}" in
  1) USE_BUNDLED_NGINX=true ;;
  2) USE_BUNDLED_NGINX=false ;;
  3) USE_BUNDLED_NGINX=false; RPG_BIND=0.0.0.0 ;;
esac

# ── 3. Choisir la base de données ─────────────────────────────
title "── Base de données ───────────────────────────────────────"
if [[ -z "${COMPOSE_PROFILES:-}" ]]; then
  echo "  1) PostgreSQL intégré (Docker)"
  echo "     → Recommandé, aucune configuration requise"
  echo "  2) PostgreSQL déjà installé sur ce serveur ou distant"
  echo "     → Vous fournirez l'URL de connexion"
  echo ""
  read -rp "Votre choix [1/2] : " DB_CHOICE
else
  [[ "$COMPOSE_PROFILES" == *db* ]] && DB_CHOICE=1 || DB_CHOICE=2
fi

USE_BUNDLED_DB=false
[[ "${DB_CHOICE:-1}" == "1" ]] && USE_BUNDLED_DB=true

# ── 4. Construire COMPOSE_PROFILES ────────────────────────────
PROFILES=""
$USE_BUNDLED_DB    && PROFILES="db"
$USE_BUNDLED_NGINX && PROFILES="${PROFILES:+$PROFILES,}nginx"
sed -i "s|^COMPOSE_PROFILES=.*|COMPOSE_PROFILES=${PROFILES}|" .env
export COMPOSE_PROFILES="$PROFILES"

# ── 5. Paramètres selon les choix ─────────────────────────────
generate_secret() { openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | head -c 64; }

# Domaine / ALLOWED_ORIGIN
if $USE_BUNDLED_NGINX || [[ "${WEB_CHOICE:-1}" == "2" ]]; then
  if [[ -z "${DOMAIN:-}" ]]; then
    read -rp "Domaine de l'application (ex: virtualtable.example.com) : " DOMAIN
    [[ -z "$DOMAIN" ]] && error "Le domaine est obligatoire."
    sed -i "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" .env
  fi
  if [[ -z "${ALLOWED_ORIGIN:-}" || "$ALLOWED_ORIGIN" == "https://virtualtable.example.com" ]]; then
    ALLOWED_ORIGIN="https://${DOMAIN}"
    sed -i "s|^ALLOWED_ORIGIN=.*|ALLOWED_ORIGIN=${ALLOWED_ORIGIN}|" .env
  fi
else
  # Accès direct sans proxy
  [[ -z "${ALLOWED_ORIGIN:-}" ]] && ALLOWED_ORIGIN="*"
  sed -i "s|^ALLOWED_ORIGIN=.*|ALLOWED_ORIGIN=${ALLOWED_ORIGIN}|" .env
fi

# Email certbot
if $USE_BUNDLED_NGINX && [[ -z "${CERTBOT_EMAIL:-}" ]]; then
  read -rp "Email pour Let's Encrypt (notifications SSL) : " CERTBOT_EMAIL
  [[ -z "$CERTBOT_EMAIL" ]] && error "L'email est obligatoire pour Let's Encrypt."
  sed -i "s|^CERTBOT_EMAIL=.*|CERTBOT_EMAIL=${CERTBOT_EMAIL}|" .env
fi

# Port et binding
[[ -z "${RPG_PORT:-}" ]] && RPG_PORT=3001
[[ -z "${RPG_BIND:-}" ]] && RPG_BIND="127.0.0.1"
sed -i "s|^RPG_PORT=.*|RPG_PORT=${RPG_PORT}|" .env
sed -i "s|^RPG_BIND=.*|RPG_BIND=${RPG_BIND}|" .env

# Base de données
if $USE_BUNDLED_DB; then
  if [[ -z "${RPG_DB_PASSWORD:-}" ]]; then
    RPG_DB_PASSWORD="$(generate_secret)"
    sed -i "s|^RPG_DB_PASSWORD=.*|RPG_DB_PASSWORD=${RPG_DB_PASSWORD}|" .env
    success "Mot de passe PostgreSQL généré."
  fi
  DATABASE_URL="postgresql://rpg:${RPG_DB_PASSWORD}@rpg-db:5432/rpg"
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" .env
else
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo ""
    echo "Format : postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
    read -rp "DATABASE_URL : " DATABASE_URL
    [[ -z "$DATABASE_URL" ]] && error "DATABASE_URL est obligatoire."
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" .env
  fi
  # Tester la connexion
  info "Test de connexion à la base de données..."
  if command -v psql &>/dev/null; then
    PGCONNECT_TIMEOUT=5 psql "$DATABASE_URL" -c '\q' 2>/dev/null \
      && success "Connexion OK." \
      || warn "Connexion impossible. Vérifiez DATABASE_URL si le démarrage échoue."
    # Appliquer le schéma
    info "Application du schéma SQL..."
    PGCONNECT_TIMEOUT=5 psql "$DATABASE_URL" -f backend/schema.sql 2>/dev/null \
      && success "Schéma appliqué." \
      || warn "Schéma non appliqué automatiquement. Appliquez backend/schema.sql manuellement."
  else
    warn "psql non disponible — appliquez le schéma manuellement :"
    warn "  psql \"\$DATABASE_URL\" -f $(pwd)/backend/schema.sql"
  fi
fi

# JWT
if [[ -z "${JWT_SECRET:-}" ]]; then
  JWT_SECRET="$(generate_secret)"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" .env
  success "Clé JWT générée."
fi

# Recharger .env
set -a; source .env; set +a

# ── 6. Récapitulatif ──────────────────────────────────────────
title "── Récapitulatif ────────────────────────────────────────"
echo -e "  Serveur web     : $($USE_BUNDLED_NGINX && echo 'nginx intégré (Docker)' || echo 'proxy externe (nginx/apache)')"
echo -e "  Base de données : $($USE_BUNDLED_DB && echo 'PostgreSQL intégré (Docker)' || echo 'PostgreSQL externe')"
[[ -n "${DOMAIN:-}" ]] && echo -e "  Domaine         : ${DOMAIN}"
echo -e "  Backend         : ${RPG_BIND}:${RPG_PORT}"
echo ""

# ── 7. Préparer les dossiers ──────────────────────────────────
mkdir -p certbot/www certbot/conf frontend/uploads nginx
chmod 755 frontend/uploads

# Copier les cartes par défaut si pas encore présentes
if [[ -d frontend/maps ]]; then
  COPIED=0
  for f in frontend/maps/*.jpg frontend/maps/*.png 2>/dev/null; do
    [[ -f "$f" ]] || continue
    DEST="frontend/uploads/$(basename "$f")"
    [[ ! -f "$DEST" ]] && cp "$f" "$DEST" && COPIED=$((COPIED+1))
  done
  [[ $COPIED -gt 0 ]] && success "${COPIED} carte(s) par défaut copiées dans uploads/."
fi

# ── 8. nginx intégré — SSL ────────────────────────────────────
if $USE_BUNDLED_NGINX; then
  info "Configuration nginx temporaire (HTTP pour Let's Encrypt)..."
  sed "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" nginx/default.conf.http-only > nginx/default.conf

  info "Démarrage nginx en mode HTTP..."
  COMPOSE_PROFILES=nginx docker compose up -d nginx
  sleep 3

  info "Obtention du certificat SSL..."
  COMPOSE_PROFILES=nginx docker compose run --rm certbot certonly \
    --webroot --webroot-path=/var/www/certbot \
    --email "${CERTBOT_EMAIL}" --agree-tos --no-eff-email \
    -d "${DOMAIN}" \
    || error "Échec SSL. Vérifiez que ${DOMAIN} pointe vers ce serveur (port 80 accessible)."
  success "Certificat SSL obtenu."

  info "Application de la configuration HTTPS..."
  sed "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" nginx/default.conf.template > nginx/default.conf

  # Renouvellement auto
  CRON_FILE="/etc/cron.d/virtualtable-certbot"
  if [[ ! -f "$CRON_FILE" ]]; then
    cat > "$CRON_FILE" << EOF
# Renouvellement Let's Encrypt — VirtualTable RPG
0 3,15 * * * root cd ${SCRIPT_DIR} && COMPOSE_PROFILES=nginx docker compose run --rm certbot renew --quiet && docker compose exec nginx-rpg nginx -s reload >> /var/log/certbot-renew.log 2>&1
EOF
    chmod 644 "$CRON_FILE"
    success "Renouvellement automatique SSL configuré."
  fi
fi

# ── 9. Démarrer tous les services ─────────────────────────────
info "Build et démarrage de l'application..."
docker compose up -d --build

# ── 10. Attendre que le backend soit prêt ─────────────────────
info "Attente du démarrage du backend..."
MAX=30; i=0
until docker compose exec -T rpg wget -qO- http://localhost:3001/rpg/api/health &>/dev/null; do
  sleep 2; i=$((i+1))
  [[ $i -ge $MAX ]] && error "Le backend ne répond pas. Vérifiez : docker compose logs rpg"
done
success "Backend opérationnel."

# ── 11. Instructions proxy externe ────────────────────────────
if ! $USE_BUNDLED_NGINX; then
  echo ""
  echo -e "${YELLOW}┌──────────────────────────────────────────────────────────┐${NC}"
  echo -e "${YELLOW}│  Configurez votre proxy pour pointer vers le backend     │${NC}"
  echo -e "${YELLOW}└──────────────────────────────────────────────────────────┘${NC}"
  echo ""
  echo -e "  Backend disponible sur : ${CYAN}http://127.0.0.1:${RPG_PORT}${NC}"
  echo ""
  echo -e "  ${BOLD}nginx${NC} — ajoutez dans votre vhost :"
  echo "    location /rpg/ {"
  echo "        proxy_pass         http://127.0.0.1:${RPG_PORT}/rpg/;"
  echo "        proxy_http_version 1.1;"
  echo "        proxy_set_header   Upgrade \$http_upgrade;"
  echo "        proxy_set_header   Connection \"upgrade\";"
  echo "        proxy_set_header   Host \$host;"
  echo "        proxy_read_timeout 3600;"
  echo "    }"
  echo ""
  echo -e "  ${BOLD}apache${NC} — ajoutez dans votre vhost (mod_proxy_wstunnel requis) :"
  echo "    ProxyPass        /rpg/ http://127.0.0.1:${RPG_PORT}/rpg/"
  echo "    ProxyPassReverse /rpg/ http://127.0.0.1:${RPG_PORT}/rpg/"
  echo "    RewriteCond %{HTTP:Upgrade} websocket [NC]"
  echo "    RewriteRule ^/rpg/socket.io/(.*) ws://127.0.0.1:${RPG_PORT}/rpg/socket.io/\$1 [P,L]"
  echo ""
  echo -e "  ${BOLD}Frontend${NC} (HTML/JS/musiques) : ${CYAN}$(pwd)/frontend/${NC}"
  echo "    Pointez la DocumentRoot / root de votre vhost vers ce dossier."
  echo ""
  echo "  Exemples complets :"
  echo "    nginx/virtualtable-rpg.conf.example"
  echo "    nginx/virtualtable-rpg-apache.conf.example"
fi

# ── 12. Fin ───────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅  Installation terminée avec succès !            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
if $USE_BUNDLED_NGINX; then
  echo -e "  🌐 Application : ${CYAN}https://${DOMAIN}${NC}"
fi
echo -e "  📋 Logs        : ${CYAN}docker compose logs -f rpg${NC}"
echo -e "  🔄 Mise à jour : ${CYAN}git pull && docker compose up -d --build rpg${NC}"
echo ""
echo -e "${YELLOW}⚠️  Sauvegardez le fichier .env (secrets). Ne le commitez jamais.${NC}"
echo ""
