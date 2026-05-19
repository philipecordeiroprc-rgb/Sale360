#!/usr/bin/env bash
# ============================================================
# Sale360 — Sync & Deploy (local → OCI)
# Uso: bash scripts/sync-deploy.sh [--api|--web|--db|--all]
# Sem flags: envia tudo e deixa o servidor detectar mudanças
# ============================================================
set -euo pipefail

# === CONFIG ===
SERVER_IP="137.131.193.203"
SERVER_USER="opc"
SSH_KEY="C:/Users/rafac/Documents/GitHub/Sale360/sales360.key"
REMOTE_ROOT="/home/opc/sale360"
SSH_OPTS="-i \"$SSH_KEY\" -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=4 -o TCPKeepAlive=yes"

FORCE_FLAGS=""
DRY_RUN=false

for arg in "$@"; do
  case $arg in
    --api|--web|--db|--all) FORCE_FLAGS="$FORCE_FLAGS $arg" ;;
    --dry-run) DRY_RUN=true ;;
  esac
done

# === Transfer files ===
echo "📦 Sincronizando arquivos para $SERVER_IP..."

# Packages that should be synced (source code only, no build artifacts)
SYNC_DIRS=(
  "packages/api/src"
  "packages/api/package.json"
  "packages/api/tsconfig.json"
  "packages/api/start.sh"
  "packages/db/prisma"
  "packages/db/src"
  "packages/db/package.json"
  "packages/db/tsconfig.json"
  "packages/core/src"
  "packages/core/package.json"
  "apps/web/src"
  "apps/web/public"
  "apps/web/package.json"
  "apps/web/next.config.*"
  "apps/web/tsconfig.json"
  "apps/web/postcss.config.*"
  "apps/web/tailwind.config.*"
  "nginx-sale360.conf"
  "scripts/deploy.sh"
  "pnpm-lock.yaml"
  "pnpm-workspace.yaml"
  "package.json"
  "turbo.json"
  "tsconfig.base.json"
)

for dir in "${SYNC_DIRS[@]}"; do
  LOCAL_PATH="./$dir"
  REMOTE_PATH="$REMOTE_ROOT/$dir"

  # Skip if local path doesn't exist
  if [ ! -e "$LOCAL_PATH" ]; then
    continue
  fi

  if [ -f "$LOCAL_PATH" ]; then
    # Single file
    scp -i "$SSH_KEY" "$LOCAL_PATH" "${SERVER_USER}@${SERVER_IP}:${REMOTE_PATH}" 2>&1 | grep -v "WARNING:" || true
  elif [ -d "$LOCAL_PATH" ]; then
    # Directory — rsync if available, otherwise scp individual files
    # Only sync source files, not node_modules, dist, .next, etc.
    rsync -avz --delete \
      --exclude='node_modules' --exclude='dist' --exclude='.next' --exclude='.turbo' \
      --exclude='*.log' --exclude='generated' \
      -e "ssh -i $SSH_KEY" \
      "$LOCAL_PATH/" "${SERVER_USER}@${SERVER_IP}:${REMOTE_PATH}/" 2>&1 | grep -v "WARNING:" | tail -3 || {
      echo "⚠️  rsync falhou para $dir, tentando scp..."
      # Fallback: create tar and scp
      tar -czf /tmp/sync-$$.tar.gz -C "$(dirname "$LOCAL_PATH")" "$(basename "$LOCAL_PATH")" \
        --exclude='node_modules' --exclude='dist' --exclude='.next' --exclude='.turbo' --exclude='*.log' --exclude='generated'
      scp -i "$SSH_KEY" /tmp/sync-$$.tar.gz "${SERVER_USER}@${SERVER_IP}":/tmp/
      ssh -i "$SSH_KEY" "${SERVER_USER}@${SERVER_IP}" "tar -xzf /tmp/sync-$$.tar.gz -C \$(dirname $REMOTE_PATH) && rm /tmp/sync-$$.tar.gz"
      rm /tmp/sync-$$.tar.gz
    }
  fi
done

echo "✅ Arquivos sincronizados"

# === Trigger deploy on server ===
if [ "$DRY_RUN" = true ]; then
  echo "🔍 Modo dry-run — verificando o que seria deployado..."
  ssh -i "$SSH_KEY" "${SERVER_USER}@${SERVER_IP}" "bash $REMOTE_ROOT/scripts/deploy.sh --check $FORCE_FLAGS"
else
  echo "🚀 Iniciando deploy no servidor..."
  ssh -i "$SSH_KEY" "${SERVER_USER}@${SERVER_IP}" "bash $REMOTE_ROOT/scripts/deploy.sh $FORCE_FLAGS"
fi
