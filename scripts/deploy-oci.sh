#!/usr/bin/env bash
# ============================================================
# Sale360 — Deploy to OCI (run from LOCAL machine)
# Uso: ./scripts/deploy-oci.sh [--api] [--web] [--all]
# Sem flags: detecta o que mudou e faz deploy seletivo
# ============================================================
set -euo pipefail

OCI_HOST="137.131.193.203"
OCI_USER="opc"
SSH_KEY="$HOME/.ssh/sales360.key"
ROOT="/home/opc/sale360"
PROJECT="$(cd "$(dirname "$0")/.." && pwd)"

FORCE_API=false; FORCE_WEB=false

for arg in "$@"; do
  case $arg in
    --api) FORCE_API=true ;;
    --web) FORCE_WEB=true ;;
    --all) FORCE_API=true; FORCE_WEB=true ;;
  esac
done

SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new"
SCP="scp -i $SSH_KEY -o StrictHostKeyChecking=accept-new"

log() { echo "[$(date '+%H:%M:%S')] $*"; }
ok()  { echo "  ✅ $*"; }
fail() { echo "  ❌ $*"; exit 1; }

# -----------------------------------------------------------
# Check what needs to be deployed
# -----------------------------------------------------------
DEPLOY_API="$FORCE_API"
DEPLOY_WEB="$FORCE_WEB"

CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null || true)
if [ -z "$CHANGED_FILES" ]; then
  CHANGED_FILES=$(git diff --name-only --cached 2>/dev/null || true)
fi

if [ -n "$CHANGED_FILES" ] && ! $FORCE_API && ! $FORCE_WEB; then
  if echo "$CHANGED_FILES" | grep -q 'packages/api/'; then
    DEPLOY_API=true
  fi
  if echo "$CHANGED_FILES" | grep -q 'apps/web/'; then
    DEPLOY_WEB=true
  fi
  if echo "$CHANGED_FILES" | grep -q 'packages/db/'; then
    DEPLOY_API=true  # DB changes require API rebuild
  fi
fi

log "API: ${DEPLOY_API:-false} | Web: ${DEPLOY_WEB:-false}"

if ! ${DEPLOY_API:-false} && ! ${DEPLOY_WEB:-false}; then
  log "Nada para deploy."
  exit 0
fi

# -----------------------------------------------------------
# Build phase (local)
# -----------------------------------------------------------
if ${DEPLOY_API:-false}; then
  log "Build: API..."
  cd "$PROJECT/packages/api"
  pnpm run build || fail "API build falhou"
  ok "API built"
fi

if ${DEPLOY_WEB:-false}; then
  log "Build: Web..."
  cd "$PROJECT/apps/web"
  rm -rf .next  # Clean cache for reliable build
  pnpm run build || fail "Web build falhou"
  ok "Web built"
fi

# -----------------------------------------------------------
# Deploy phase — rsync built files
# -----------------------------------------------------------
if ${DEPLOY_API:-false}; then
  log "Deploy: API dist → OCI..."
  rsync -avz --delete -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new" \
    "$PROJECT/packages/api/dist/" \
    "$OCI_USER@$OCI_HOST:$ROOT/packages/api/dist/" \
    || fail "API rsync falhou"

  # Also sync source files for hash tracking
  rsync -avz -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new" \
    "$PROJECT/packages/api/src/" \
    "$OCI_USER@$OCI_HOST:$ROOT/packages/api/src/" \
    > /dev/null 2>&1 || true

  log "Restart: API..."
  $SSH "$OCI_USER@$OCI_HOST" "sudo systemctl restart sale360-api" || fail "API restart falhou"
  sleep 3

  if $SSH "$OCI_USER@$OCI_HOST" "curl -sf http://localhost:3001/api/health > /dev/null"; then
    ok "API healthy"
  else
    fail "API health check falhou — verifique o servidor"
  fi
fi

if ${DEPLOY_WEB:-false}; then
  log "Deploy: Web .next → OCI..."
  rsync -avz --delete -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new" \
    "$PROJECT/apps/web/.next/" \
    "$OCI_USER@$OCI_HOST:$ROOT/apps/web/.next/" \
    || fail "Web rsync falhou"

  # Also sync source files for hash tracking
  rsync -avz -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new" \
    "$PROJECT/apps/web/src/" \
    "$OCI_USER@$OCI_HOST:$ROOT/apps/web/src/" \
    > /dev/null 2>&1 || true

  log "Restart: Web..."
  $SSH "$OCI_USER@$OCI_HOST" "sudo systemctl restart sale360-web" || fail "Web restart falhou"
  sleep 4

  if $SSH "$OCI_USER@$OCI_HOST" "curl -sf -o /dev/null -w '%{http_code}' http://localhost:3000/login | grep -q 200"; then
    ok "Web healthy"
  else
    fail "Web health check falhou — verifique o servidor"
  fi
fi

# Always reload nginx after deploy
$SSH "$OCI_USER@$OCI_HOST" "sudo systemctl reload nginx" || true

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🚀 Deploy concluído com sucesso!"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  API:  http://$OCI_HOST:3001/api/health"
echo "  Web:  http://$OCI_HOST"
