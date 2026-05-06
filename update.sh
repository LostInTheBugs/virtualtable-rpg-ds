#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  VirtualTable RPG — Script de mise à jour
#  Usage : sudo ./update.sh
#
#  Télécharge la dernière version depuis GitHub et applique
#  uniquement les changements nécessaires.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERREUR]${NC} $*"; exit 1; }

# ── 0. Vérifications ──────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "Ce script doit être exécuté en root ou avec sudo."
command -v docker &>/dev/null || error "Docker n'est pas installé."
command -v git    &>/dev/null || error "Git n'est pas installé."
docker compose version &>/dev/null || error "Le plugin 'docker compose' est requis."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

[[ ! -d .git ]] && error "Ce dossier n'est pas un dépôt git. Avez-vous installé via git clone ?"
[[ ! -f .env  ]] && error "Fichier .env introuvable. Lancez d'abord install.sh."

set -a; source .env; set +a

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     VirtualTable RPG — Mise à jour         ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Sauvegarder le commit actuel ───────────────────────────
COMMIT_BEFORE=$(git rev-parse HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
info "Version actuelle : ${COMMIT_BEFORE:0:8} (branche ${BRANCH})"

# ── 2. Vérifier les modifications locales ─────────────────────
if ! git diff --quiet || ! git diff --cached --quiet; then
  warn "Des modifications locales sont présentes :"
  git status --short
  echo ""
  read -rp "$(echo -e "${YELLOW}Continuer et écraser ces modifications ? [o/N] :${NC} ")" CONFIRM
  [[ "${CONFIRM,,}" != "o" ]] && echo "Annulé." && exit 0
fi

# ── 3. Télécharger les mises à jour ───────────────────────────
info "Récupération des mises à jour depuis GitHub..."
git fetch origin "${BRANCH}" 2>&1 || error "Impossible de contacter GitHub. Vérifiez votre connexion."

COMMIT_REMOTE=$(git rev-parse "origin/${BRANCH}")

if [[ "$COMMIT_BEFORE" == "$COMMIT_REMOTE" ]]; then
  success "Déjà à jour (version ${COMMIT_BEFORE:0:8})."
  echo ""
  exit 0
fi

# ── 4. Afficher le changelog ──────────────────────────────────
echo ""
echo -e "${BOLD}Nouveautés disponibles :${NC}"
git log --oneline "${COMMIT_BEFORE}..origin/${BRANCH}" | sed 's/^/  📌 /'
echo ""

# ── 5. Identifier ce qui change ───────────────────────────────
CHANGED=$(git diff --name-only "${COMMIT_BEFORE}..origin/${BRANCH}")

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

# ── 6. Appliquer ──────────────────────────────────────────────
info "Application des mises à jour..."
git reset --hard "origin/${BRANCH}"
success "Code mis à jour vers ${COMMIT_REMOTE:0:8}."

# ── 7. Nouvelles cartes par défaut ────────────────────────────
if $MAPS_CHANGED && [[ -d frontend/maps ]]; then
  COPIED=0
  for f in frontend/maps/*.jpg frontend/maps/*.png; do
    [[ -f "$f" ]] || continue
    DEST="frontend/uploads/$(basename "$f")"
    [[ ! -f "$DEST" ]] && cp "$f" "$DEST" && COPIED=$((COPIED+1))
  done
  [[ $COPIED -gt 0 ]] && success "${COPIED} nouvelle(s) carte(s) par défaut ajoutée(s)."
fi

# ── 8. Migration du schéma DB ─────────────────────────────────
if $SCHEMA_CHANGED; then
  info "Migration du schéma de base de données..."
  if [[ "$COMPOSE_PROFILES" == *db* ]]; then
    # PostgreSQL intégré
    docker compose exec -T rpg-db psql -U rpg rpg < backend/schema.sql 2>/dev/null \
      && success "Schéma migré." \
      || warn "Migration partielle — vérifiez les logs si des erreurs apparaissent."
  else
    # PostgreSQL externe
    if command -v psql &>/dev/null && [[ -n "${DATABASE_URL:-}" ]]; then
      PGCONNECT_TIMEOUT=5 psql "$DATABASE_URL" -f backend/schema.sql 2>/dev/null \
        && success "Schéma migré." \
        || warn "Migration impossible. Appliquez backend/schema.sql manuellement."
    else
      warn "psql non disponible. Appliquez backend/schema.sql manuellement :"
      warn "  psql \"\$DATABASE_URL\" -f $(pwd)/backend/schema.sql"
    fi
  fi
fi

# ── 9. Redémarrage sélectif ───────────────────────────────────
if $BACKEND_CHANGED; then
  info "Rebuild et redémarrage du backend..."
  docker compose up -d --build rpg
  # Attendre que le backend soit prêt
  MAX=20; i=0
  until docker compose exec -T rpg wget -qO- http://localhost:3001/rpg/api/health &>/dev/null; do
    sleep 2; i=$((i+1))
    [[ $i -ge $MAX ]] && error "Le backend ne répond pas. Vérifiez : docker compose logs rpg"
  done
  success "Backend redémarré."
elif ! docker compose ps rpg | grep -q "running\|Up"; then
  # Backend arrêté (cas rare), on le relance
  warn "Backend arrêté — redémarrage..."
  docker compose up -d rpg
fi

if $FRONTEND_CHANGED; then
  # Le frontend est servi directement depuis ./frontend/ — pas de rebuild.
  # Si nginx intégré, recharger la config si elle a changé.
  if [[ "$COMPOSE_PROFILES" == *nginx* ]]; then
    docker compose exec -T nginx-rpg nginx -s reload 2>/dev/null \
      && success "Nginx rechargé." || true
  else
    success "Frontend mis à jour (servi directement depuis ./frontend/)."
    info "Si votre proxy cache les fichiers statiques, videz le cache."
  fi
fi

# ── 10. Résumé ────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅  Mise à jour terminée !                         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Version : ${CYAN}${COMMIT_BEFORE:0:8}${NC} → ${GREEN}${COMMIT_REMOTE:0:8}${NC}"
echo -e "  Logs    : ${CYAN}docker compose logs -f rpg${NC}"
echo ""
