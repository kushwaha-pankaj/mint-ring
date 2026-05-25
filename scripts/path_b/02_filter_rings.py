#!/usr/bin/env python3
"""
Filter the Zenodo 11K-Hands jewellery masks down to mask files whose
foreground sits on a finger — i.e. probable rings rather than bracelets
or watches.

Heuristic (deliberately simple, runs without MediaPipe):
  * The Zenodo masks are 1600x1200. Wrist-worn jewellery (bracelets,
    watches) generally has its centroid in the LOWER THIRD of the image,
    near the wrist crease, and large mask area.
  * Ring jewellery has its centroid in the UPPER 2/3 and small mask area.

This isn't perfect — it's a filter, not a classifier. The downstream eval
(03_eval_detector.py) is what proves the detector works; this script
just stops us evaluating on bracelet masks.

Output: data/zenodo_11khands/ring_manifest.json
  [
    {"image": "Hands/Hand_0000001.jpg", "mask": "masks/Hand_0000001.png",
     "centroid_y_frac": 0.42, "area_frac": 0.012},
    ...
  ]
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / "data" / "zenodo_11khands"
MASK_DIR = TARGET / "masks"
IMG_DIR = TARGET / "images"
OUT = TARGET / "ring_manifest.json"

# Tunables, kept conservative — we want false negatives over false positives.
MAX_CENTROID_Y_FRAC = 0.78   # reject masks centred in the bottom 22%
MAX_AREA_FRAC = 0.040        # ring masks are usually <4% of frame area


def main() -> int:
    if not MASK_DIR.exists():
        print(f"[path_b] missing masks dir: {MASK_DIR}", file=sys.stderr)
        return 2

    entries: list[dict] = []
    skipped_wrist = 0
    skipped_large = 0
    skipped_no_image = 0

    for mask_path in sorted(MASK_DIR.rglob("*.png")):
        # Match a same-stem image. The 11K Hands archive uses Hand_<id>.jpg.
        stem = mask_path.stem
        candidates = list(IMG_DIR.rglob(f"{stem}.jpg"))
        if not candidates:
            skipped_no_image += 1
            continue
        image_path = candidates[0]

        mask = np.array(Image.open(mask_path).convert("L"))
        if mask.size == 0:
            continue
        h, w = mask.shape
        fg = mask > 0
        area = int(fg.sum())
        if area == 0:
            continue
        ys, xs = np.where(fg)
        centroid_y_frac = float(ys.mean() / h)
        area_frac = float(area / (h * w))

        if centroid_y_frac > MAX_CENTROID_Y_FRAC:
            skipped_wrist += 1
            continue
        if area_frac > MAX_AREA_FRAC:
            skipped_large += 1
            continue

        entries.append({
            "image": str(image_path.relative_to(ROOT)),
            "mask": str(mask_path.relative_to(ROOT)),
            "centroid_y_frac": round(centroid_y_frac, 4),
            "area_frac": round(area_frac, 5),
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(entries, indent=2))

    print(
        f"[path_b] kept {len(entries)} ring-likely entries · "
        f"skipped {skipped_wrist} wrist · {skipped_large} large · "
        f"{skipped_no_image} no-matching-image"
    )
    print(f"[path_b] manifest → {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
