#!/usr/bin/env bash
# ============================================================
# Sale360 — Deploy Script (server-side)
# Uso: deploy.sh [--api] [--web] [--db] [--all] [--check]
# Sem flags: detecta automaticamente o que mudou
# ============================================================
set -euo pipefail

ROOT="/home/opc/sale360"
LOG="/tmp/deploy-$(date +%Y%m%d-%H%M%S).log"
FORCE_API=false; FORCE_WEB=false; FORCE_DB=false; CHECK_ONLY=false

for arg in "$@"; do
  case $arg in
    --api) FORCE_API=true ;;
    --web) FORCE_WEB=true ;;
    --db) FORCE_DB=true ;;
    --all) FORCE_API=true; FORCE_WEB=true; FORCE_DB=true ;;
    --check) CHECK_ONLY=true ;;
  esac
done

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }
ok() { log "✅ $*"; }
fail() { log "❌ $*"; exit 1; }

# ---- Progress keepalive for silent commands ----
# Prints a dot every second so SSH doesn't look dead during long builds
keepalive_run() {
  local msg="$1"; shift
  local pid start elapsed

  "$@" > /tmp/keepalive-out.$$ 2>&1 &
  pid=$!
  start=$(date +%s)

  printf "[$(date '+%H:%M:%S')] %s" "$msg"
  while kill -0 $pid 2>/dev/null; do
    elapsed=$(( $(date +%s) - start ))
    printf "."
    sleep 1
  done
  wait $pid
  local rc=$?

  if [ $rc -eq 0 ]; then
    echo " OK (${elapsed}s)"
  else
    echo " FAIL (exit $rc)"
  fi

  cat /tmp/keepalive-out.$$ >> "$LOG"
  rm -f /tmp/keepalive-out.$$
  return $rc
}

# ---- Hash tracking ----
HASH_DIR="$ROOT/.deploy-hashes"
mkdir -p "$HASH_DIR"

changed_files() {
  local src label hashfile tmp
  src="$1"
  label="$2"
  hashfile="$HASH_DIR/$label.sha256"
  if [ ! -f "$hashfile" ]; then
    echo "FIRST_DEPLOY"
    return
  fi
  tmp=$(mktemp)
  find "$src" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.prisma' -o -name '*.json' -o -name '*.css' \) \
    -exec sha256sum {} \; 2>/dev/null | sort > "$tmp" || true
  if ! diff -q "$hashfile" "$tmp" > /dev/null 2>&1; then
    echo "CHANGED"
    cp "$tmp" "$hashfile"
  fi
  rm -f "$tmp"
}

save_hashes() {
  local src label hashfile
  src="$1"
  label="$2"
  hashfile="$HASH_DIR/$label.sha256"
  find "$src" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.prisma' -o -name '*.json' -o -name '*.css' \) \
    -exec sha256sum {} \; 2>/dev/null | sort > "$hashfile" || true
}

# ---- Health checks ----
health_api() { curl -sf http://localhost:3001/api/health > /dev/null 2>&1; }
health_web() { curl -sf -o /dev/null http://localhost:3000; }

wait_health() {
  local label="$1" check_fn="$2" max=30
  log "Aguardando $label ficar saudável..."
  for i in $(seq 1 $max); do
    if $check_fn; then ok "$label saudável (${i}s)"; return 0; fi
    sleep 1
  done
  fail "$label não respondeu após ${max}s"
}

# ---- Detect changes ----
log "🔍 Detectando mudanças..."

CHANGED_API="$FORCE_API"
CHANGED_WEB="$FORCE_WEB"
CHANGED_DB="$FORCE_DB"
NEED_INSTALL=false

# Check each package's source files
if ! $FORCE_API && [ "$(changed_files "$ROOT/packages/api/src" "api-src")" != "" ]; then
  CHANGED_API=true
fi

if ! $FORCE_DB && [ "$(changed_files "$ROOT/packages/db/prisma" "db-prisma")" != "" ]; then
  CHANGED_DB=true
  CHANGED_API=true  # DB changes require API rebuild (Prisma client)
fi

if ! $FORCE_DB && [ "$(changed_files "$ROOT/packages/db/src" "db-src")" != "" ]; then
  CHANGED_DB=true
  CHANGED_API=true
fi

if ! $FORCE_WEB && [ "$(changed_files "$ROOT/apps/web/src" "web-src")" != "" ]; then
  CHANGED_WEB=true
fi

# Check if package.json or lockfile changed (needs npm install)
if [ "$(changed_files "$ROOT/packages/api/package.json" "api-pkg")" != "" ] || \
   [ "$(changed_files "$ROOT/pnpm-lock.yaml" "lockfile")" != "" ]; then
  CHANGED_API=true
  NEED_INSTALL=true
fi

if [ "$(changed_files "$ROOT/apps/web/package.json" "web-pkg")" != "" ]; then
  CHANGED_WEB=true
  NEED_INSTALL=true
fi

# Check nginx config changes
CHANGED_NGINX=false
if [ "$(changed_files "$ROOT/nginx-sale360.conf" "nginx")" != "" ]; then
  CHANGED_NGINX=true
fi

log "API: ${CHANGED_API:-false} | Web: ${CHANGED_WEB:-false} | DB: ${CHANGED_DB:-false} | Nginx: $CHANGED_NGINX | Install: ${NEED_INSTALL:-false}"

if [ "$CHECK_ONLY" = true ]; then
  exit 0
fi

if ! ${CHANGED_API:-false} && ! ${CHANGED_WEB:-false} && ! ${CHANGED_DB:-false} && ! ${CHANGED_NGINX:-false}; then
  log "Nada mudou. Nenhum deploy necessário."
  exit 0
fi

# ---- Build phase (while services are still running) ----
log "🔨 Iniciando build..."

# Install dependencies if needed (while services are running)
if [ "${NEED_INSTALL:-false}" = true ]; then
  log "Instalando dependências..."
  cd "$ROOT" && pnpm install --frozen-lockfile 2>&1 | tail -3 || fail "pnpm install falhou"
  ok "Dependências instaladas"
fi

BUILD_FAILED=false

# Build DB (if changed) — no service restart needed, just regenerate client
if ${CHANGED_DB:-false}; then
  cd "$ROOT/packages/db"
  keepalive_run "DB: prisma generate" pnpm exec prisma generate || true
  if [ -f "$ROOT/packages/db/generated/index.js" ]; then
    keepalive_run "DB: tsc" npx tsc src/index.ts src/client.ts --outDir dist --module ESNext --moduleResolution bundler --target ES2022 --esModuleInterop --skipLibCheck
    save_hashes "$ROOT/packages/db/prisma" "db-prisma"
    save_hashes "$ROOT/packages/db/src" "db-src"
  fi
fi

# Build API (if changed) — build while old version is still running
if ${CHANGED_API:-false}; then
  cd "$ROOT/packages/api"
  if keepalive_run "API: tsc" npx tsc; then
    save_hashes "$ROOT/packages/api/src" "api-src"
  else
    log "⚠️  API build falhou — serviço antigo continua rodando"
    BUILD_FAILED=true
  fi
fi

# Build Web (if changed) — build while old version is still running
if ${CHANGED_WEB:-false}; then
  cd "$ROOT/apps/web"
  if keepalive_run "Web: next build" npx next build; then
    save_hashes "$ROOT/apps/web/src" "web-src"
  else
    log "⚠️  Web build falhou — serviço antigo continua rodando"
    BUILD_FAILED=true
  fi
fi

if [ "$BUILD_FAILED" = true ]; then
  log "⚠️  Alguns builds falharam. Serviços antigos mantidos."
  log "Verifique o log: $LOG"
  exit 1
fi

# ---- Restart phase (brief downtime) ----
log "🔄 Reiniciando serviços..."

# Restart API (fast — ~2s downtime)
if ${CHANGED_API:-false}; then
  log "Restart: API..."
  sudo systemctl restart sale360-api
  wait_health "API" health_api
fi

# Restart Web (fast — ~3s downtime, the build already happened)
if ${CHANGED_WEB:-false}; then
  log "Restart: Web..."
  sudo systemctl restart sale360-web
  wait_health "Web" health_web
fi

# Reload nginx if config changed
if [ "$CHANGED_NGINX" = true ]; then
  log "Recarregando nginx..."
  sudo cp "$ROOT/nginx-sale360.conf" /etc/nginx/conf.d/sale360.conf
  if sudo nginx -t 2>/dev/null; then
    sudo systemctl reload nginx
    save_hashes "$ROOT/nginx-sale360.conf" "nginx"
    ok "Nginx recarregado"
  else
    fail "Nginx config inválida — abortando reload"
  fi
fi

# ---- Update lockfile hash ----
save_hashes "$ROOT/pnpm-lock.yaml" "lockfile" 2>/dev/null || true
save_hashes "$ROOT/packages/api/package.json" "api-pkg" 2>/dev/null || true
save_hashes "$ROOT/apps/web/package.json" "web-pkg" 2>/dev/null || true

# ---- Final status ----
echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🚀 Deploy concluído com sucesso!"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  API:  http://137.131.193.203:3001/api/health"
echo "  Web:  http://137.131.193.203"
echo "  Log:  $LOG"
