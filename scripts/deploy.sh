#!/usr/bin/env bash
# ============================================================
# Sale360 — Deploy → OCI (via SCP + build remoto)
# Uso: bash scripts/deploy.sh [--web|--api|--db|--all]
# ============================================================
set -euo pipefail

SERVER_IP="137.131.193.203"
SERVER_USER="opc"
SSH_KEY="C:/Users/rafac/Documents/GitHub/Sale360/sales360.key"
REMOTE_ROOT="/home/opc/sale360"
SSH_OPTS="-i \"$SSH_KEY\" -o StrictHostKeyChecking=no -o ConnectTimeout=10"

SCOPE="all"
case "${1:-}" in
  --web) SCOPE="web" ;;
  --api) SCOPE="api" ;;
  --db)  SCOPE="db" ;;
  --all) SCOPE="all" ;;
esac

echo "🚀 Deploy Sale360 → $SERVER_IP (scope: $SCOPE)"

# ============================================================
# 1. Empacotar source files localmente
# ============================================================
TMP_TAR="/tmp/sale360-deploy-$(date +%s).tar.gz"
SYNC_DIRS=()

# Packages source code
if [ "$SCOPE" = "all" ] || [ "$SCOPE" = "api" ]; then
  SYNC_DIRS+=("packages/api/src")
  SYNC_DIRS+=("packages/db/prisma")
  SYNC_DIRS+=("packages/db/src")
  SYNC_DIRS+=("packages/core/src")
fi
if [ "$SCOPE" = "all" ] || [ "$SCOPE" = "web" ]; then
  SYNC_DIRS+=("apps/web/src")
  SYNC_DIRS+=("apps/web/public")
fi
if [ "$SCOPE" = "all" ]; then
  SYNC_DIRS+=("apps/catalog/src")
fi

SYNC_FILES=(
  "apps/web/package.json"
  "apps/web/next.config.js"
  "apps/web/tsconfig.json"
  "apps/web/postcss.config.mjs"
  "apps/web/tailwind.config.ts"
  "packages/api/package.json"
  "packages/api/tsconfig.json"
  "packages/db/package.json"
  "packages/core/package.json"
  "pnpm-lock.yaml"
  "pnpm-workspace.yaml"
  "turbo.json"
  "package.json"
)

echo "📦 Empacotando source files..."
tar -czf "$TMP_TAR" \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='dist' \
  --exclude='.turbo' \
  --exclude='*.log' \
  --exclude='generated' \
  --exclude='.expo' \
  --exclude='.git' \
  "${SYNC_DIRS[@]}" \
  "${SYNC_FILES[@]}" 2>/dev/null || {
    # Fallback: use git ls-files (only existing files) if tar --exclude fails (Windows tar)
    echo "⚠️  tar com --exclude falhou, tentando git ls-files..."
    git ls-files "${SYNC_DIRS[@]}" "${SYNC_FILES[@]}" | \
      while IFS= read -r f; do [ -f "$f" ] && echo "$f"; done | \
      tar -czf "$TMP_TAR" -T - 2>/dev/null || {
        echo "❌ Falha ao criar tarball"
        exit 1
      }
  }

TAR_SIZE=$(du -h "$TMP_TAR" | cut -f1)
echo "   Tarball: $TMP_TAR ($TAR_SIZE)"

# ============================================================
# 2. Enviar para o servidor
# ============================================================
echo "📤 Enviando para $SERVER_IP..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$TMP_TAR" "$SERVER_USER@$SERVER_IP:/tmp/sale360-deploy.tar.gz"

# ============================================================
# 3. Extrair no servidor e rodar deploy.sh
# ============================================================
echo "🔧 Extraindo e buildando no servidor..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "
  cd $REMOTE_ROOT
  sudo tar -xzf /tmp/sale360-deploy.tar.gz --overwrite
  sudo rm /tmp/sale360-deploy.tar.gz
  echo '✅ Source files sync''d'
  bash scripts/server-deploy.sh --$SCOPE
"

# Cleanup local tarball
rm -f "$TMP_TAR"

echo "🎉 Deploy concluído!"
