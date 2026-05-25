#!/usr/bin/env bash
# ============================================================
# Sale360 API — startup
# ============================================================

export DATABASE_URL='postgresql://neondb_owner:npg_Xk2TdJrqNx5p@ep-holy-rain-actxoqs3-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
export FRONTEND_URL='https://sale360.jvp.app'

# SMTP (Gmail)
export SMTP_HOST='smtp.gmail.com'
export SMTP_PORT='587'
export SMTP_USER='philipecordeiroprc@gmail.com'
export SMTP_PASS='rhvyxgwlvwcdzekg'
export SMTP_FROM='Sale360 <noreply@sale360.app>'

echo "[startup] FRONTEND_URL=$FRONTEND_URL"

exec /usr/local/bin/node dist/index.js
