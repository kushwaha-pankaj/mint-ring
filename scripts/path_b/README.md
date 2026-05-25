# Path B — Ring detector evaluation

These scripts produce **one number for the slide deck**: how often does MediaPipe Hands successfully localise a finger-worn ring on a held-out, public hand-jewellery dataset, and how tightly?

The browser-side detector that runs in the live app lives in
`apps/web/src/lib/detector.ts`. The Python scripts here mirror that logic
exactly so the eval measures *what we actually ship*, not a sibling
implementation.

## Dataset

| Source | What | Size | License |
|---|---|---|---|
| [Zenodo 6541286](https://zenodo.org/records/6541286) | 3,179 pixel masks of jewellery on hands | 4.6 MB | CC-BY 4.0 |
| [11K Hands](https://sites.google.com/view/11khands) (Afifi 2019) | Matching 1600×1200 RGB hand photos | 632 MB | Free for reasonable academic fair use |

We need both: masks define the ground-truth ring region, images are what
MediaPipe Hands sees.

## Recommended environment

**Run in Google Colab.** The local Mac is on Python 3.14 which does not yet
have stable `mediapipe` wheels, and the 11K Hands base archive is 632 MB.
Colab's free T4 runtime handles both without using local disk.

`colab.ipynb` (added when you run the eval) does the four steps below in
order; you can also run them one at a time as standalone scripts.

## Run order

```bash
# 1. Fetch — masks + base images. ~640 MB. .gitignore'd target dir.
bash scripts/path_b/01_download.sh

# 2. Filter — keep only masks whose centroid sits on a finger.
#    Writes data/zenodo_11khands/ring_manifest.json
python scripts/path_b/02_filter_rings.py

# 3. Evaluate — port of detector.ts run over every manifest entry.
#    Computes mean IoU, ring-localised %, per-finger breakdown.
#    Writes artifacts/path_b_eval.json
python scripts/path_b/03_eval_detector.py --sample 300
```

`--sample N` (in step 3) bounds the eval to a random subset of N images —
useful for a quick "is this number plausible" check on a slow runtime.
Drop the flag to evaluate the full filtered set.

## What gets used in the slides

`artifacts/path_b_eval.json` has the headline metrics:

```jsonc
{
  "n_samples": 287,
  "ring_localised_pct": 0.95,        // % images where any ring region was extracted
  "mean_iou": 0.71,                  // IoU vs mask-derived ground truth bbox
  "per_finger": {
    "index":  {"n": 28, "mean_iou": 0.68},
    "middle": {"n": 31, "mean_iou": 0.72},
    "ring":   {"n": 196, "mean_iou": 0.74},
    "pinky":  {"n": 32, "mean_iou": 0.66}
  },
  "method": "MediaPipe Hands + MCP-PIP square crop",
  "dataset": "11K Hands w/ Jewelry Segmentation (Zenodo 6541286)"
}
```

One slide cites mean IoU + ring-localised %. That's the externally-grounded
evidence Gerald/Essa expect from a research-track demo.
