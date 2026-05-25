#!/usr/bin/env bash
# Launch the Streamlit demo.
#
# URLs (printed by Streamlit on startup):
#   Local URL:   http://localhost:8501           ← this laptop only
#   Network URL: http://<your-LAN-IP>:8501       ← any device on same WiFi
#
# To find the LAN IP manually:
#   macOS WiFi:     ipconfig getifaddr en0
#   macOS Ethernet: ipconfig getifaddr en1
#
# On a phone connected to the same WiFi, open the Network URL in Safari
# or Chrome. The thumbnail picker, upload, predictions, embedding plot,
# and confusion matrix all work fine over plain HTTP.
#
# CAVEAT — webcam capture on mobile:
#   Mobile browsers refuse getUserMedia() on plain HTTP unless the origin
#   is `localhost`. The "Start camera" button on the Network URL will
#   fail with a permissions error. To use the webcam from a phone, expose
#   the app over HTTPS via a tunnel:
#       ngrok http 8501
#   then open the printed https://...ngrok-free.app URL on the phone.
#   (Or use `cloudflared tunnel --url http://localhost:8501`.)

set -e
cd "$(dirname "$0")"

# Use the Python install that has torch + streamlit (3.14 on this machine).
PY=/Library/Frameworks/Python.framework/Versions/3.14/bin/python3

if [[ ! -x "$PY" ]]; then
  # Fall back to whatever python3 resolves to; user can fix PATH if it complains
  PY=python3
fi

# Pick the first free port starting at 8501. If something else (e.g. an
# earlier copy of this demo) is already bound to 8501, we fall through to
# 8502, 8503, ... so the launch always succeeds.
PORT=8501
while lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  echo "[run_demo] port $PORT busy, trying next..."
  PORT=$((PORT + 1))
done
echo "[run_demo] launching Streamlit on port $PORT"

# --server.address=0.0.0.0 makes the bind explicit so the Network URL is
# always reachable from other devices on the LAN. Default would also do
# this but we keep it visible in the launch command for documentation.
exec "$PY" -m streamlit run scripts/demo.py \
  --server.address=0.0.0.0 \
  --server.port="$PORT"
