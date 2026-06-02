#!/usr/bin/env bash
# ============================================================
export TZ=America/Sao_Paulo
# Sale360 API — startup
# ============================================================

export DATABASE_URL='postgresql://sale360:sale360_oci_1e53ebfc387adbc1f5a27c9efd80ca1c@127.0.0.1:5432/sale360?sslmode=disable'
export FRONTEND_URL='https://sale360.jvp.app'

# SMTP (Gmail)
export SMTP_HOST='smtp.gmail.com'
export SMTP_PORT='587'
export SMTP_USER='philipecordeiroprc@gmail.com'
export SMTP_PASS='rhvyxgwlvwcdzekg'
export SMTP_FROM='Sale360 <noreply@sale360.app>'

echo "[startup] FRONTEND_URL=$FRONTEND_URL"

exec /usr/local/bin/node dist/index.js
