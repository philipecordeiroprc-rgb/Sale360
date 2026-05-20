#!/usr/bin/env bash
# ============================================================
# Sale360 API — Dynamic startup
# Detecta IP público automaticamente (OCI metadata ou fallback)
# ============================================================

# Try to get public IP — OCI instance public IP if available, else ifconfig.me
get_public_ip() {
  # Method 1: Check if we have a public IP assigned via OCI VNIC
  # The VNIC metadata might have it, but it's not always available
  # Method 2: Use an external service (most reliable)
  local ip
  ip=$(curl -sf -m 5 https://ifconfig.me 2>/dev/null) && echo "$ip" && return
  ip=$(curl -sf -m 5 https://api.ipify.org 2>/dev/null) && echo "$ip" && return
  ip=$(curl -sf -m 5 https://icanhazip.com 2>/dev/null) && echo "$ip" && return
  # Fallback: private IP from metadata
  ip=$(curl -sf -m 3 http://169.254.169.254/opc/v1/vnics/ 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['privateIp'])" 2>/dev/null)
  echo "${ip:-127.0.0.1}"
}

PUBLIC_IP=$(get_public_ip)

if [ -n "$PUBLIC_IP" ]; then
  export FRONTEND_URL="http://${PUBLIC_IP}"
  echo "[startup] Public IP: $PUBLIC_IP → FRONTEND_URL=$FRONTEND_URL"
else
  echo "[startup] WARNING: Could not detect public IP, using localhost"
  export FRONTEND_URL="http://localhost:3000"
fi

exec /usr/local/bin/node dist/index.js
