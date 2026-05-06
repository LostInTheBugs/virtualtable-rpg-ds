#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  VirtualTable RPG — Script d'installation
#  Usage : sudo ./install.sh
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERREUR]${NC} $*"; exit 1; }

# ── 0. Vérifications ──────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "Ce script doit être exécuté en root ou avec sudo."

command -v docker  &>/dev/null || error "Docker n'est pas installé. Installez Docker d'abord : https://docs.docker.com/engine/install/"
command -v git     &>/dev/null || error "Git n'est pas installé. Installez-le avec : apt-get install -y git"

# Vérifier docker compose (plugin v2)
docker compose version &>/dev/null || error "Le plugin 'docker compose' est requis (Docker >= 20.10)."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     VirtualTable RPG — Installation   ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════╝${NC}"
echo ""

# ── 1. Fichier .env ───────────────────────────────────────────
if [[ ! -f .env ]]; then
  cp .env.example .env
  info "Fichier .env créé depuis .env.example."
fi

# Charger .env
set -a; source .env; set +a

# ── 2. Demander les valeurs manquantes ────────────────────────
if [[ -z "${DOMAIN:-}" ]]; then
  read -rp "$(echo -e "${YELLOW}Domaine${NC} (ex: virtualtable.example.com) : ")" DOMAIN
  [[ -z "$DOMAIN" ]] && error "Le domaine est obligatoire."
  sed -i "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" .env
fi

if [[ -z "${CERTBOT_EMAIL:-}" ]]; then
  read -rp "$(echo -e "${YELLOW}Email Let's Encrypt${NC} (notifications SSL) : ")" CERTBOT_EMAIL
  [[ -z "$CERTBOT_EMAIL" ]] && error "L'email est obligatoire pour Let's Encrypt."
  sed -i "s|^CERTBOT_EMAIL=.*|CERTBOT_EMAIL=${CERTBOT_EMAIL}|" .env
fi

# ── 3. Générer les secrets manquants ─────────────────────────
generate_secret() {
  openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | head -c 64
}

if [[ -z "${RPG_DB_PASSWORD:-}" ]]; then
  RPG_DB_PASSWORD="$(generate_secret)"
  sed -i "s|^RPG_DB_PASSWORD=.*|RPG_DB_PASSWORD=${RPG_DB_PASSWORD}|" .env
  success "Mot de passe PostgreSQL généré."
fi

if [[ -z "${JWT_SECRET:-}" ]]; then
  JWT_SECRET="$(generate_secret)"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" .env
  success "Clé JWT générée."
fi

# Recharger .env avec les nouvelles valeurs
set -a; source .env; set +a

info "Domaine : ${DOMAIN}"
info "Email   : ${CERTBOT_EMAIL}"

# ── 4. Préparer les dossiers ──────────────────────────────────
mkdir -p certbot/www certbot/conf frontend/uploads nginx
chmod 755 frontend/uploads

# ── 5. Config nginx HTTP-only (pour certbot) ──────────────────
info "Configuration nginx (HTTP temporaire pour Let's Encrypt)..."
sed "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" nginx/default.conf.http-only > nginx/default.conf

# ── 6. Démarrer nginx seul (pour le challenge ACME) ──────────
info "Démarrage nginx (mode HTTP)..."
docker compose up -d nginx
sleep 3

# ── 7. Obtenir le certificat SSL ──────────────────────────────
info "Obtention du certificat SSL via Let's Encrypt..."
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "${CERTBOT_EMAIL}" \
  --agree-tos \
  --no-eff-email \
  -d "${DOMAIN}" \
  || error "Échec de l'obtention du certificat. Vérifiez que ${DOMAIN} pointe bien vers ce serveur (port 80 ouvert)."

success "Certificat SSL obtenu pour ${DOMAIN}."

# ── 8. Config nginx HTTPS ─────────────────────────────────────
info "Application de la configuration HTTPS..."
sed "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" nginx/default.conf.template > nginx/default.conf

# ── 9. Démarrer tous les services ─────────────────────────────
info "Build et démarrage de l'application..."
docker compose up -d --build

# ── 10. Attendre que le backend soit prêt ─────────────────────
info "Attente du démarrage du backend..."
MAX=30; i=0
until docker compose exec -T rpg wget -qO- http://localhost:3001/rpg/api/health &>/dev/null; do
  sleep 2; i=$((i+1))
  [[ $i -ge $MAX ]] && error "Le backend ne répond pas après ${MAX} tentatives. Vérifiez : docker compose logs rpg"
done

# ── 11. Renouvellement automatique du certificat ──────────────
info "Configuration du renouvellement automatique SSL..."
CRON_FILE="/etc/cron.d/virtualtable-certbot"
if [[ ! -f "$CRON_FILE" ]]; then
  cat > "$CRON_FILE" << EOF
# Renouvellement Let's Encrypt — VirtualTable RPG
0 3,15 * * * root cd ${SCRIPT_DIR} && docker compose run --rm certbot renew --quiet && docker compose exec nginx nginx -s reload >> /var/log/certbot-renew.log 2>&1
EOF
  chmod 644 "$CRON_FILE"
  success "Renouvellement automatique configuré (2x/jour)."
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅  Installation terminée avec succès !         ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  🌐 Application : ${CYAN}https://${DOMAIN}${NC}"
echo -e "  📋 Logs backend : ${CYAN}docker compose logs -f rpg${NC}"
echo -e "  🔄 Mise à jour  : ${CYAN}git pull && docker compose up -d --build rpg${NC}"
echo ""
echo -e "${YELLOW}⚠️  Sauvegardez le fichier .env — il contient vos secrets.${NC}"
echo -e "${YELLOW}   Ne le commitez jamais dans git (.gitignore l'exclut déjà).${NC}"
echo ""
