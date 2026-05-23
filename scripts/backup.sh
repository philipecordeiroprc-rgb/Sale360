#!/usr/bin/env bash
# ============================================================
# Sale360 — Full System Backup Script
# - Local: /home/opc/backups/ (retém últimos 7)
# - OCI:   Object Storage bucket sale360-backups (retém últimos 7)
# ============================================================
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/home/opc/backups"
BACKUP_NAME="sale360-full-${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
LOG_FILE="${BACKUP_DIR}/backup-${TIMESTAMP}.log"
RETENTION_DAYS=7

# OCI Config
OCI_REGION="sa-saopaulo-1"
OCI_BUCKET="sale360-backups"
OCI_NAMESPACE="grqxj1nvh4zj"
COMPARTMENT_ID=$(curl -s -m 2 http://169.254.169.254/opc/v1/instance/ 2>/dev/null | python3 -c 'import sys,json; print(json.load(sys.stdin)["compartmentId"])' 2>/dev/null || echo "")

# Neon DB connection (extraído do systemd)
DB_URL="${DATABASE_URL:-postgresql://neondb_owner:npg_Xk2TdJrqNx5p@ep-holy-rain-actxoqs3-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require}"
# Extrai partes da URL para pg_dump
DB_HOST=$(echo "$DB_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
DB_PORT=$(echo "$DB_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "$DB_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
DB_USER=$(echo "$DB_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DB_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')

export PGPASSWORD="$DB_PASS"
PG_DUMP="/usr/pgsql-17/bin/pg_dump"
PG_DUMPALL="/usr/pgsql-17/bin/pg_dumpall"

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
ok()  { log "✅ $*"; }
warn(){ log "⚠️  $*"; }
fail(){ log "❌ $*"; }

# ---- Pre-flight ----
mkdir -p "$BACKUP_DIR"
log "🔒 Iniciando backup full: $BACKUP_NAME"
log "   Destino local: $BACKUP_PATH"
log "   Destino OCI:   s3://${OCI_BUCKET}/${BACKUP_NAME}.tar.gz.gpg"

# ---- 1. Database Dump (Neon PostgreSQL) ----
log "💾 [1/9] Dump do banco de dados (Neon)..."
DB_DIR="${BACKUP_PATH}/database"
mkdir -p "$DB_DIR"

# Schema-only dump
if $PG_DUMP \
    -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-acl --schema-only \
    -f "${DB_DIR}/schema.sql" 2>> "$LOG_FILE"; then
    ok "Schema dump (${DB_DIR}/schema.sql)"
else
    fail "Schema dump falhou"
fi

# Full data dump
if $PG_DUMP \
    -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-acl --column-inserts \
    -f "${DB_DIR}/full-data.sql" 2>> "$LOG_FILE"; then
    ok "Full data dump (${DB_DIR}/full-data.sql)"
else
    fail "Full data dump falhou"
fi

# Roles & globals
if $PG_DUMPALL \
    -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" \
    --roles-only --no-role-passwords \
    -f "${DB_DIR}/roles.sql" 2>> "$LOG_FILE"; then
    ok "Roles dump (${DB_DIR}/roles.sql)"
else
    warn "Roles dump falhou (não crítico)"
fi

# ---- 2. Prisma Schema & Migrations ----
log "📐 [2/9] Schema & Migrações Prisma..."

# Schema Prisma (sempre presente)
cp /home/opc/sale360/packages/db/prisma/schema.prisma "${BACKUP_PATH}/schema.prisma" 2>/dev/null && \
    ok "Schema Prisma copiado" || warn "Schema Prisma não encontrado"

# Migrations (se existirem — projeto pode usar db push)
MIGRATIONS_DIR="/home/opc/sale360/packages/db/prisma/migrations"
if [ -d "$MIGRATIONS_DIR" ]; then
    cp -r "$MIGRATIONS_DIR" "${BACKUP_PATH}/prisma-migrations"
    ok "Migrações copiadas ($(find "${BACKUP_PATH}/prisma-migrations" -name '*.sql' 2>/dev/null | wc -l) arquivos SQL)"
else
    log "Sem migrations (projeto usa db push) — schema e dump SQL já bastam"
fi

# ---- 3. Source Code (completo) ----
log "📦 [3/9] Código fonte da aplicação..."
rsync -a --exclude='node_modules' --exclude='.next' --exclude='generated' --exclude='.turbo' --exclude='dist' \
    /home/opc/sale360/ "${BACKUP_PATH}/source-code/" 2>> "$LOG_FILE"
ok "Código fonte copiado"

# ---- 4. Nginx Configuration ----
log "🌐 [4/9] Configurações Nginx..."
mkdir -p "${BACKUP_PATH}/nginx"
cp /etc/nginx/nginx.conf "${BACKUP_PATH}/nginx/nginx.conf" 2>/dev/null || warn "nginx.conf não encontrado"
cp /etc/nginx/conf.d/sale360.conf "${BACKUP_PATH}/nginx/sale360.conf" 2>/dev/null || warn "sale360.conf não encontrado"
cp /home/opc/sale360/nginx-sale360.conf "${BACKUP_PATH}/nginx/nginx-sale360.conf" 2>/dev/null || warn "nginx-sale360.conf local não encontrado"
# Incluir todos os conf.d
cp -r /etc/nginx/conf.d/ "${BACKUP_PATH}/nginx/conf.d/" 2>/dev/null || warn "conf.d não encontrado"
ok "Nginx configs copiados"

# ---- 5. SSL Certificates ----
log "🔑 [5/9] Certificados SSL..."
mkdir -p "${BACKUP_PATH}/ssl"
if [ -d /etc/letsencrypt ]; then
    sudo cp -r /etc/letsencrypt "${BACKUP_PATH}/ssl/letsencrypt" 2>/dev/null && \
        ok "Let's Encrypt copiado" || warn "Falha ao copiar Let's Encrypt"
fi
if [ -d /etc/pki/tls ]; then
    sudo cp -r /etc/pki/tls "${BACKUP_PATH}/ssl/pki-tls" 2>/dev/null && \
        ok "PKI/TLS copiado" || warn "Falha ao copiar PKI/TLS"
fi
# openssl.cnf
cp /etc/pki/tls/openssl.cnf "${BACKUP_PATH}/ssl/openssl.cnf" 2>/dev/null || true
ok "SSL configs copiados"

# ---- 6. Systemd Services ----
log "⚙️  [6/9] Serviços systemd..."
mkdir -p "${BACKUP_PATH}/systemd"
cp /etc/systemd/system/sale360-api.service "${BACKUP_PATH}/systemd/" 2>/dev/null || warn "sale360-api.service"
cp /etc/systemd/system/sale360-web.service "${BACKUP_PATH}/systemd/" 2>/dev/null || warn "sale360-web.service"
cp /etc/systemd/system/nginx.service.d/* "${BACKUP_PATH}/systemd/" 2>/dev/null || true
systemctl list-units --type=service --state=running > "${BACKUP_PATH}/systemd/running-services.txt" 2>/dev/null
ok "Systemd configs copiados"

# ---- 7. Scripts de Deploy & Manutenção ----
log "📜 [7/9] Scripts operacionais..."
mkdir -p "${BACKUP_PATH}/scripts"
cp /home/opc/sale360/scripts/* "${BACKUP_PATH}/scripts/" 2>/dev/null || warn "Scripts não encontrados"
cp /home/opc/sale360/packages/api/start.sh "${BACKUP_PATH}/scripts/api-start.sh" 2>/dev/null || true
ok "Scripts copiados ($(ls "${BACKUP_PATH}/scripts/" | wc -l) arquivos)"

# ---- 8. Configurações do Ambiente ----
log "🔧 [8/9] Configurações de runtime..."
mkdir -p "${BACKUP_PATH}/config"

# Node & Package Manager versions
node --version > "${BACKUP_PATH}/config/node-version.txt" 2>/dev/null || true
/usr/local/bin/pnpm --version > "${BACKUP_PATH}/config/pnpm-version.txt" 2>/dev/null || true
npm --version > "${BACKUP_PATH}/config/npm-version.txt" 2>/dev/null || true

# Package files
cp /home/opc/sale360/package.json "${BACKUP_PATH}/config/root-package.json" 2>/dev/null || true
cp /home/opc/sale360/pnpm-lock.yaml "${BACKUP_PATH}/config/pnpm-lock.yaml" 2>/dev/null || true
cp /home/opc/sale360/pnpm-workspace.yaml "${BACKUP_PATH}/config/pnpm-workspace.yaml" 2>/dev/null || true
cp /home/opc/sale360/turbo.json "${BACKUP_PATH}/config/turbo.json" 2>/dev/null || true
cp /home/opc/sale360/tsconfig.base.json "${BACKUP_PATH}/config/tsconfig.base.json" 2>/dev/null || true

# DB env
cp /home/opc/sale360/packages/db/.env "${BACKUP_PATH}/config/db.env" 2>/dev/null || true

# NODE_ENV e variáveis do sistema
env | sort > "${BACKUP_PATH}/config/environment.txt" 2>/dev/null || true

# Host info
hostnamectl > "${BACKUP_PATH}/config/host-info.txt" 2>/dev/null || true
uname -a > "${BACKUP_PATH}/config/kernel.txt" 2>/dev/null || true

# Lista de pacotes instalados (rpm/dnf)
rpm -qa --queryformat '%{NAME} %{VERSION}-%{RELEASE}\n' 2>/dev/null | sort > "${BACKUP_PATH}/config/rpm-packages.txt" 2>/dev/null || true

ok "Configurações copiadas"

# ---- 9. Docker/Podman (se existir) ----
log "🐳 [9/9] Container images..."
if command -v podman &> /dev/null; then
    podman images --format 'table {{.Repository}} {{.Tag}} {{.ID}}' > "${BACKUP_PATH}/podman-images.txt" 2>/dev/null || true
    ok "Lista de imagens Podman exportada"
elif command -v docker &> /dev/null; then
    docker images --format 'table {{.Repository}} {{.Tag}} {{.ID}}' > "${BACKUP_PATH}/docker-images.txt" 2>/dev/null || true
    ok "Lista de imagens Docker exportada"
else
    log "Nenhum container engine instalado — pulando"
fi

# ---- Empacotar ----
log "📦 Compactando backup..."
cd "$BACKUP_DIR"
tar czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME" 2>> "$LOG_FILE"
BACKUP_SIZE=$(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)
ok "Backup compactado: ${BACKUP_NAME}.tar.gz (${BACKUP_SIZE})"

# ---- Copiar tarball para Backup/ (versionamento GitHub) ----
log "📤 Copiando tarball para Backup/..."
mkdir -p /home/opc/sale360/Backup
cp "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" /home/opc/sale360/Backup/
ok "Tarball copiado para Backup/"

# Manter só os últimos 7 tarballs na pasta Backup/
BACKUP_TARBALLS=$(ls -1t /home/opc/sale360/Backup/sale360-full-*.tar.gz 2>/dev/null)
BACKUP_TAR_COUNT=$(echo "$BACKUP_TARBALLS" | grep -c . || true)
if [ "$BACKUP_TAR_COUNT" -gt "$RETENTION_DAYS" ]; then
    echo "$BACKUP_TARBALLS" | tail -n +$((RETENTION_DAYS + 1)) | while read -r f; do
        log "Removendo Backup antigo: $(basename "$f")"
        rm -f "$f"
    done
fi

# Limpar diretório temporário (sudo necessário para arquivos SSL copiados com sudo)
sudo rm -rf "$BACKUP_PATH" 2>/dev/null || rm -rf "$BACKUP_PATH" 2>/dev/null || true

# ---- 10. Git Push para GitHub ----
log "🔀 Enviando código para GitHub..."
GIT_PUSH_OK=""
if [ -d /home/opc/sale360/.git ]; then
    cd /home/opc/sale360
    git add -A 2>> "$LOG_FILE"
    git commit -m "backup: ${TIMESTAMP}" 2>> "$LOG_FILE" || true
    if git push origin main 2>> "$LOG_FILE"; then
        ok "GitHub push concluído"
        GIT_PUSH_OK=1
    else
        warn "GitHub push falhou (verificar remote/autenticação)"
    fi
else
    warn "Repositório git não inicializado"
fi

# ---- 11. Upload OCI Object Storage ----
log "☁️  Enviando para OCI Object Storage..."
OCI_UPLOAD_OK=""
if oci os object put \
    --profile SALE360-BACKUP \
    --bucket-name "$OCI_BUCKET" \
    --region "$OCI_REGION" \
    --file "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" \
    --name "${BACKUP_NAME}.tar.gz" \
    --force \
    2>> "$LOG_FILE"; then
    ok "Upload OCI concluído"
    OCI_UPLOAD_OK=1
else
    warn "Upload OCI falhou (verificar IAM policy) — backup local preservado"
fi

# ---- Limpeza: reter últimos 7 backups ----
log "🧹 Limpando backups antigos (reter ${RETENTION_DAYS} dias)..."

# Local
LOCAL_COUNT=$(ls -1t "${BACKUP_DIR}"/sale360-full-*.tar.gz 2>/dev/null | wc -l)
if [ "$LOCAL_COUNT" -gt "$RETENTION_DAYS" ]; then
    ls -1t "${BACKUP_DIR}"/sale360-full-*.tar.gz | tail -n +$((RETENTION_DAYS + 1)) | while read -r f; do
        log "Removendo local: $(basename "$f")"
        rm -f "$f"
    done
fi
# Remove logs antigos também
find "${BACKUP_DIR}" -name 'backup-*.log' -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true

ok "Limpeza local concluída (mantidos ${RETENTION_DAYS} backups)"

# OCI: remover objetos antigos
if [ "$OCI_UPLOAD_OK" = "1" ]; then
    OCI_OBJECTS=$(oci os object list \
        --auth instance_principal \
        --bucket-name "$OCI_BUCKET" \
        --region "$OCI_REGION" \
        --prefix "sale360-full-" \
        --fields name,timeCreated \
        2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin).get('data', [])
    # Sort by timeCreated desc
    data.sort(key=lambda x: x.get('timeCreated', ''), reverse=True)
    for i, obj in enumerate(data):
        if i >= ${RETENTION_DAYS}:
            print(obj.get('name', ''))
except: pass
" 2>/dev/null)

    if [ -n "$OCI_OBJECTS" ]; then
        echo "$OCI_OBJECTS" | while read -r obj; do
            if [ -n "$obj" ]; then
                log "Removendo OCI: $obj"
                oci os object delete \
                    --auth instance_principal \
                    --bucket-name "$OCI_BUCKET" \
                    --region "$OCI_REGION" \
                    --object-name "$obj" \
                    --force 2>/dev/null || true
            fi
        done
    fi
    ok "Limpeza OCI concluída"
fi

# ---- Resumo ----
echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🎯 Backup concluído: ${BACKUP_NAME}"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "   Local:  ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz (${BACKUP_SIZE})"
log "   GitHub: ${GIT_PUSH_OK:+✅ Push OK}${GIT_PUSH_OK:-⚠️  Falhou}"
if [ "$OCI_UPLOAD_OK" = "1" ]; then
    log "   OCI:    ✅ Upload OK"
else
    log "   OCI:    ⚠️  Falhou (verificar IAM policy)"
fi
log "   Log:    ${LOG_FILE}"
log "   Retenção: ${RETENTION_DAYS} dias"
echo ""
