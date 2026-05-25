#!/usr/bin/env bash
# Launch the Hockley Mint AI Ring Studio (Step 0).
#
#   Backend (FastAPI + ResNet50 identification) → http://localhost:8000
#   Frontend (Next.js 16 + Hockley Mint brand)  → http://localhost:3000
#
# Round-1 Streamlit demo is unchanged at ./run_demo.sh — both can co-exist.

set -e
cd "$(dirname "$0")"

PY=/Library/Frameworks/Python.framework/Versions/3.14/bin/python3
if [[ ! -x "$PY" ]]; then
  PY=python3
fi

# Optional: source apps/api/.env so ROBOFLOW_API_KEY etc. are visible to the
# server process. Ignored silently if the file doesn't exist.
if [[ -f apps/api/.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source apps/api/.env
  set +a
fi

cleanup() {
  echo
  echo "[run_studio] stopping servers..."
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
  wait "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[run_studio] starting FastAPI on :8000 ..."
RELOAD_FLAG=()
if [[ "${STUDIO_RELOAD:-}" == "1" ]]; then
  RELOAD_FLAG=(--reload)
  echo "[run_studio] uvicorn --reload enabled (STUDIO_RELOAD=1). Uses extra memory."
fi
"$PY" -m uvicorn apps.api.main:app --port 8000 "${RELOAD_FLAG[@]}" &
API_PID=$!

echo "[run_studio] starting Next.js on :3000 ..."
( cd apps/web && npm run dev ) &
WEB_PID=$!

echo
echo "[run_studio] frontend → http://localhost:3000"
echo "[run_studio] backend  → http://localhost:8000/api/health"
echo "[run_studio] press Ctrl-C to stop both."
wait
