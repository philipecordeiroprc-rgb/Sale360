#!/usr/bin/env bash
# ============================================================
# Baixa backups do servidor OCI para o PC local
# Uso: bash scripts/pull-backups.sh [--latest]
# ============================================================
set -euo pipefail

SSH_KEY="${SALE360_KEY:-~/.ssh/sales360.key}"
SERVER="opc@137.131.193.203"
REMOTE_DIR="/home/opc/backups"
LOCAL_DIR="$(dirname "$0")/../backups"

mkdir -p "$LOCAL_DIR"

if [ "${1:-}" = "--latest" ]; then
    # Baixa apenas o backup mais recente
    LATEST=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER" "ls -1t ${REMOTE_DIR}/*.tar.gz | head -1")
    echo "Baixando: $(basename "$LATEST")"
    scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER:$LATEST" "$LOCAL_DIR/"
else
    # Baixa todos (rsync: só os novos)
    echo "Sincronizando backups do servidor..."
    rsync -avz --progress -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" "$SERVER:${REMOTE_DIR}/*.tar.gz" "$LOCAL_DIR/"
fi

echo ""
echo "Backups locais:"
ls -lh "$LOCAL_DIR"/*.tar.gz 2>/dev/null
echo ""
echo "Total: $(ls "$LOCAL_DIR"/*.tar.gz 2>/dev/null | wc -l) backups"
