#!/usr/bin/env python3
"""
Evaluate the browser-side ring detector against the Zenodo 11K Hands w/
Jewelry Segmentation dataset.

Mirrors the JS detector (apps/web/src/lib/detector.ts) in Python so the
metric measures what the live app actually does:
  1. Run MediaPipe Hands on each image.
  2. Pick the longest visible MCP-PIP segment (ring-finger biased).
  3. Crop a 1.6x-segment-length square around the segment midpoint.
  4. Compare that bbox against the bounding box of the ground-truth mask.

Writes artifacts/path_b_eval.json:
  {
    n_samples: int,
    ring_localised_pct: float,
    mean_iou: float,
    per_finger: { index: {n, mean_iou}, ... },
    method: "MediaPipe Hands + MCP-PIP square crop",
    dataset: "11K Hands w/ Jewelry Segmentation (Zenodo 6541286)",
  }

Run on Colab — local Python 3.14 lacks mediapipe wheels at time of writing.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "data" / "zenodo_11khands" / "ring_manifest.json"
OUT = ROOT / "artifacts" / "path_b_eval.json"

# Mirrors FINGERS in detector.ts.
FINGERS = [
    ("index", 5, 6),
    ("middle", 9, 10),
    ("ring", 13, 14),
    ("pinky", 17, 18),
]
RING_BIAS = 0.05  # matches detector.ts ringBias multiplier


def import_mediapipe():
    try:
        import mediapipe as mp  # type: ignore
        return mp
    except ImportError:
        print(
            "mediapipe is not installed. On Colab: !pip install mediapipe\n"
            "Locally (Python 3.11/3.12 venv): pip install mediapipe",
            file=sys.stderr,
        )
        raise


def mask_bbox(mask_path: Path) -> tuple[int, int, int, int] | None:
    arr = np.array(Image.open(mask_path).convert("L"))
    ys, xs = np.where(arr > 0)
    if ys.size == 0:
        return None
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    return (x0, y0, x1 - x0 + 1, y1 - y0 + 1)


def pick_finger(lm, img_w: int, img_h: int):
    """Port of pickFinger() in detector.ts."""
    best = None
    best_score = -float("inf")
    for name, mcp_i, pip_i in FINGERS:
        a, b = lm[mcp_i], lm[pip_i]
        dx, dy = (b.x - a.x) * img_w, (b.y - a.y) * img_h
        seg = float(np.hypot(dx, dy))
        bias = seg * RING_BIAS if name == "ring" else 0
        score = seg + bias
        if score > best_score:
            best_score = score
            best = (name, mcp_i, pip_i, seg)
    if best is None or best[3] < 12:
        return None
    return best


def ring_box(lm, mcp_i: int, pip_i: int, img_w: int, img_h: int):
    """Port of ringBox() in detector.ts."""
    mcp, pip = lm[mcp_i], lm[pip_i]
    cx = (mcp.x + pip.x) / 2 * img_w
    cy = (mcp.y + pip.y) / 2 * img_h
    seg = float(np.hypot((pip.x - mcp.x) * img_w, (pip.y - mcp.y) * img_h))
    side = max(64, int(round(seg * 1.6)))
    x = int(round(cx - side / 2))
    y = int(round(cy - side / 2))
    w = h = side
    if x < 0:
        w += x
        x = 0
    if y < 0:
        h += y
        y = 0
    if x + w > img_w:
        w = img_w - x
    if y + h > img_h:
        h = img_h - y
    if w < 32 or h < 32:
        return None
    return (x, y, w, h)


def iou_xywh(a, b) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    inter_x0 = max(ax, bx)
    inter_y0 = max(ay, by)
    inter_x1 = min(ax + aw, bx + bw)
    inter_y1 = min(ay + ah, by + bh)
    iw = max(0, inter_x1 - inter_x0)
    ih = max(0, inter_y1 - inter_y0)
    inter = iw * ih
    union = aw * ah + bw * bh - inter
    return inter / union if union > 0 else 0.0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", type=int, default=0, help="Random subset size; 0 = all")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    if not MANIFEST.exists():
        print(f"[path_b] missing manifest: {MANIFEST}", file=sys.stderr)
        print("[path_b] run scripts/path_b/02_filter_rings.py first.", file=sys.stderr)
        return 2

    entries = json.loads(MANIFEST.read_text())
    if args.sample and args.sample < len(entries):
        random.seed(args.seed)
        entries = random.sample(entries, args.sample)

    mp = import_mediapipe()
    HandLandmarker = mp.tasks.vision.HandLandmarker
    HLOptions = mp.tasks.vision.HandLandmarkerOptions
    BaseOptions = mp.tasks.BaseOptions

    # Use the same model as the browser (downloaded by run_studio.sh / Colab).
    model_path = ROOT / "apps/web/public/models/hand_landmarker.task"
    options = HLOptions(
        base_options=BaseOptions(model_asset_path=str(model_path)),
        running_mode=mp.tasks.vision.RunningMode.IMAGE,
        num_hands=1,
    )
    landmarker = HandLandmarker.create_from_options(options)

    per_finger_iou: dict[str, list[float]] = defaultdict(list)
    all_iou: list[float] = []
    localised = 0
    skipped_no_hand = 0
    skipped_no_box = 0
    skipped_no_mask = 0

    for entry in entries:
        img_path = ROOT / entry["image"]
        mask_path = ROOT / entry["mask"]

        gt = mask_bbox(mask_path)
        if gt is None:
            skipped_no_mask += 1
            continue

        img = mp.Image.create_from_file(str(img_path))
        result = landmarker.detect(img)
        if not result.hand_landmarks:
            skipped_no_hand += 1
            continue
        lm = result.hand_landmarks[0]
        w, h = img.width, img.height

        pick = pick_finger(lm, w, h)
        if pick is None:
            skipped_no_hand += 1
            continue
        name, mcp_i, pip_i, _seg = pick

        pred = ring_box(lm, mcp_i, pip_i, w, h)
        if pred is None:
            skipped_no_box += 1
            continue

        iou = iou_xywh(pred, gt)
        all_iou.append(iou)
        per_finger_iou[name].append(iou)
        localised += 1

    n = len(entries)
    summary = {
        "n_samples": n,
        "ring_localised_pct": round(localised / n, 4) if n else 0.0,
        "mean_iou": round(float(np.mean(all_iou)), 4) if all_iou else 0.0,
        "median_iou": round(float(np.median(all_iou)), 4) if all_iou else 0.0,
        "per_finger": {
            name: {
                "n": len(vals),
                "mean_iou": round(float(np.mean(vals)), 4),
            }
            for name, vals in per_finger_iou.items()
        },
        "skipped": {
            "no_hand": skipped_no_hand,
            "no_box": skipped_no_box,
            "no_mask": skipped_no_mask,
        },
        "method": "MediaPipe Hands + MCP-PIP square crop",
        "dataset": "11K Hands w/ Jewelry Segmentation (Zenodo 6541286)",
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))
    print(f"\n[path_b] saved → {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
