#!/usr/bin/env bash
# Fetch the Path B evaluation dataset:
#   * Zenodo 6541286 jewelry segmentation masks (4.6 MB, CC-BY 4.0)
#   * 11K Hands base RGB images (632 MB, free for academic fair use)
#
# Output:
#   data/zenodo_11khands/masks/*.png          (jewellery foreground masks)
#   data/zenodo_11khands/images/*.jpg         (matching RGB hand photos)
#
# Both folders are .gitignore'd in the repo root.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TARGET="$ROOT/data/zenodo_11khands"
MASK_DIR="$TARGET/masks"
IMG_DIR="$TARGET/images"

mkdir -p "$MASK_DIR" "$IMG_DIR"

# ---- 1. Zenodo masks (small, direct) ---------------------------------------
ZENODO_URL="https://zenodo.org/records/6541286/files/jewelry-segmentation-masks.zip"
ZIP="$TARGET/masks.zip"

if [ -z "$(ls -A "$MASK_DIR" 2>/dev/null)" ]; then
  echo "[path_b] downloading Zenodo masks..."
  curl -L --fail -o "$ZIP" "$ZENODO_URL"
  unzip -q -o "$ZIP" -d "$MASK_DIR"
  rm "$ZIP"
else
  echo "[path_b] masks already present, skipping"
fi

# ---- 2. 11K Hands base images (Google Drive, painful but necessary) --------
# The original 11K Hands archive lives on Google Drive (file id below). Using
# gdown is the cleanest path; install transparently if missing.

GDRIVE_ID="1FOzNAdjeIIqXukSCMHzm6QwI8NF11N9q"   # 11K Hands "Hands.zip" (per author's site)
ARCHIVE="$TARGET/Hands.zip"

if [ -z "$(ls -A "$IMG_DIR" 2>/dev/null)" ]; then
  if ! command -v gdown >/dev/null 2>&1; then
    echo "[path_b] installing gdown..."
    python3 -m pip install --quiet --user gdown
  fi
  echo "[path_b] downloading 11K Hands base images (~632 MB)..."
  gdown --id "$GDRIVE_ID" -O "$ARCHIVE"
  unzip -q -o "$ARCHIVE" -d "$IMG_DIR"
  rm "$ARCHIVE"
else
  echo "[path_b] images already present, skipping"
fi

echo "[path_b] done. masks=$(ls "$MASK_DIR" | wc -l | tr -d ' '), images=$(ls "$IMG_DIR" | wc -l | tr -d ' ')"
