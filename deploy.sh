#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  VirtualTable RPG — Script de mise à jour (sans sudo)
#  Usage : ./deploy.sh
#
#  Adapté pour un serveur où l'utilisateur est dans le groupe
#  docker (pas de sudo) et le frontend est copié vers le DocumentRoot.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERREUR]${NC} $*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── 0. Vérifications ──────────────────────────────────────────
command -v docker &>/dev/null || error "Docker n'est pas installé."
command -v git    &>/dev/null || error "Git n'est pas installé."
docker compose version &>/dev/null || error "docker compose (v2) est requis."

[[ ! -d .git ]] && error "Ce dossier n'est pas un dépôt git."
[[ ! -f .env  ]] && error "Fichier .env introuvable."

set -a; source .env; set +a

# ── 1. Constantes ──────────────────────────────────────────────
COMPOSE_FILE="docker-compose.deploy.yml"
# Project name FORCÉ : compose v2 dériverait un hash différent du nom du
# dossier et perdrait le volume de données (app_rpg-db) au recreate.
COMPOSE_PROJECT="app"
APACHE_DOCROOT="/home/website-vtt/html"
FRONTEND_SRC="frontend"

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   VirtualTable RPG — Mise à jour           ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"
echo ""

# ── 2. Sauvegarder le commit actuel ────────────────────────────
COMMIT_BEFORE=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
info "Version actuelle : ${COMMIT_BEFORE:0:8}"

# ── 3. Préserver les modifications locales ─────────────────────
# Elles sont stashées AVANT le merge et réappliquées après (pop),
# au lieu d'être écrasées. En cas de conflit au pop, le stash est
# conservé (git stash list) et le déploiement continue.
STASH_LABEL="deploy-$(date +%Y%m%d-%H%M%S)"
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  warn "Des modifications locales sont présentes, elles seront stashées :"
  git status --short
  git stash push -m "$STASH_LABEL" 2>&1 || error "Impossible de stasher les modifications locales."
  success "Modifications locales stashées (\"$STASH_LABEL\")."
fi

# ── 4. Télécharger les mises à jour ────────────────────────────
info "Récupération des mises à jour depuis GitHub..."
git fetch origin main 2>&1 || error "Impossible de contacter GitHub."

COMMIT_REMOTE=$(git rev-parse origin/main 2>/dev/null || echo "")

if [[ "$COMMIT_BEFORE" == "$COMMIT_REMOTE" ]]; then
  success "Déjà à jour (version ${COMMIT_BEFORE:0:8})."
  # Sécurité : si le backend est arrêté, on le relance quand même
  if ! docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" ps rpg 2>/dev/null | grep -q "Up"; then
    warn "Backend arrêté — relance..."
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" up -d rpg
  fi
  echo ""
  exit 0
fi

# ── 5. Afficher le changelog ───────────────────────────────────
echo ""
echo -e "${BOLD}Nouveautés disponibles :${NC}"
git log --oneline "${COMMIT_BEFORE}..origin/main" | sed 's/^/  /'
echo ""

# ── 6. Identifier ce qui change ────────────────────────────────
CHANGED=$(git diff --name-only "${COMMIT_BEFORE}..origin/main" 2>/dev/null || echo "")

BACKEND_CHANGED=false
FRONTEND_CHANGED=false
SCHEMA_CHANGED=false
MAPS_CHANGED=false

echo "$CHANGED" | grep -q "^backend/"      && BACKEND_CHANGED=true
echo "$CHANGED" | grep -q "^frontend/"     && FRONTEND_CHANGED=true
echo "$CHANGED" | grep -q "^backend/schema.sql" && SCHEMA_CHANGED=true
echo "$CHANGED" | grep -q "^frontend/maps/" && MAPS_CHANGED=true

echo -e "  Backend  : $($BACKEND_CHANGED  && echo "${YELLOW}modifié${NC}" || echo "inchangé")"
echo -e "  Frontend : $($FRONTEND_CHANGED && echo "${YELLOW}modifié${NC}" || echo "inchangé")"
echo -e "  Schéma DB: $($SCHEMA_CHANGED   && echo "${YELLOW}modifié${NC}" || echo "inchangé")"
echo ""

# ── 7. Appliquer les mises à jour git ──────────────────────────
info "Application des mises à jour..."
git merge --ff-only origin/main 2>&1 || {
  warn "Fast-forward impossible, tentative de rebase..."
  git rebase origin/main 2>&1 || {
    error "Conflit lors de la mise à jour. Résolvez manuellement puis relancez."
  }
}
success "Code mis à jour vers $(git rev-parse --short HEAD)."

# Réapplique les modifications locales stashées
if git stash list 2>/dev/null | grep -q "$STASH_LABEL"; then
  info "Réapplication des modifications locales stashées..."
  if git stash pop 2>&1; then
    success "Modifications locales réappliquées."
  else
    warn "Conflit au pop du stash — il est conservé : git stash list"
    warn "Les fichiers du dépôt sont à jour (le déploiement continue)."
  fi
fi

# ── 8. Nouvelles cartes par défaut ────────────────────────────
if $MAPS_CHANGED && [[ -d frontend/maps ]]; then
  COPIED=0
  for f in frontend/maps/*.jpg frontend/maps/*.png; do
    [[ -f "$f" ]] || continue
    DEST="frontend/uploads/$(basename "$f")"
    [[ ! -f "$DEST" ]] && cp "$f" "$DEST" && COPIED=$((COPIED+1))
  done
  [[ $COPIED -gt 0 ]] && success "${COPIED} nouvelle(s) carte(s) par défaut ajoutée(s)."
fi

# ── 9. Migration du schéma DB ─────────────────────────────────
if $SCHEMA_CHANGED; then
  info "Migration du schéma de base de données..."
  if [[ "${COMPOSE_PROFILES:-}" == *db* ]] || docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" ps -q rpg-db &>/dev/null; then
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" exec -T rpg-db psql -U rpg rpg < backend/schema.sql 2>/dev/null \
      && success "Schéma migré." \
      || warn "Migration partielle — vérifiez les logs."
  elif command -v psql &>/dev/null && [[ -n "${DATABASE_URL:-}" ]]; then
    PGCONNECT_TIMEOUT=5 psql "$DATABASE_URL" -f backend/schema.sql 2>/dev/null \
      && success "Schéma migré." \
      || warn "Migration impossible. Appliquez backend/schema.sql manuellement."
  else
    warn "psql non disponible. Appliquez backend/schema.sql manuellement."
  fi
fi

# ── 10. Copier le frontend vers Apache ─────────────────────────
if $FRONTEND_CHANGED || $MAPS_CHANGED; then
  info "Copie du frontend vers Apache (${APACHE_DOCROOT})..."
  # rsync si dispo (n'exclut JAMAIS uploads/ : les fichiers des utilisateurs
  # vivent dans le DocumentRoot et ne doivent pas être écrasés) ; sinon cp.
  if command -v rsync &>/dev/null; then
    rsync -a --exclude 'uploads/' "${FRONTEND_SRC}/" "${APACHE_DOCROOT}/"
  else
    cp -r "${FRONTEND_SRC}/"* "${APACHE_DOCROOT}/"
  fi
  success "Frontend copié."
fi

# ── 11. Redémarrage du backend ────────────────────────────────
if $BACKEND_CHANGED; then
  info "Rebuild et redémarrage du backend..."
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" up -d --build rpg
  # Attendre que le backend soit prêt
  MAX=20; i=0
  until docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" exec -T rpg wget -qO- "http://localhost:${RPG_PORT:-8007}/rpg/api/health" &>/dev/null; do
    sleep 2; i=$((i+1))
    [[ $i -ge $MAX ]] && error "Le backend ne répond pas. Vérifiez : docker compose -p $COMPOSE_PROJECT -f $COMPOSE_FILE logs rpg"
  done
  success "Backend redémarré."
elif ! docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" ps rpg 2>/dev/null | grep -q "Up"; then
  warn "Backend arrêté — redémarrage..."
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" up -d rpg
fi

# ── 12. Résumé ─────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅  Mise à jour terminée !                         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Version : ${CYAN}${COMMIT_BEFORE:0:8}${NC} → ${GREEN}$(git rev-parse --short HEAD)${NC}"
echo -e "  Backend : ${CYAN}docker compose -p ${COMPOSE_PROJECT} -f ${COMPOSE_FILE} logs -f rpg${NC}"
echo ""
