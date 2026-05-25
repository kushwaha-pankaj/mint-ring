"""
Stratified split of the WeddingRing dataset into reference / val / test.

PURPOSE
-------
The downloaded dataset has 9 class folders, ~100 images each, all mixed
together. The rest of the prototype (scripts/prototype.py) needs three
disjoint subsets:

    data/
        reference/<class>/<file>      -- used to BUILD the gallery
        val/<class>/<file>            -- used to TUNE the threshold + encoder choice
        test/<class>/<file>           -- used ONCE to report final accuracy

This script does that split.

DESIGN DECISIONS
----------------
1. Ratios 60 / 20 / 20.
   Most tutorials use 70 / 15 / 15. The original demo used 30 / 20 / 50 on
   the theory that "the gallery just needs pose diversity, not raw count."
   That was too conservative once the demo started serving real customer
   photos (phone shots, different lighting, off-axis hands): with only ~29
   reference vectors per class the top-k mean cosine becomes brittle, and
   the matching layer is forced to either set a very loose threshold or
   reject too many real-world queries.
   60 / 20 / 20 doubles the gallery to ~60 vectors per class so the top-k
   vote averages over a wider, more representative set of poses. Val (~20)
   stays large enough to keep threshold calibration meaningful, and test
   (~20 per class, 180 total) is still plenty for headline accuracy numbers
   (standard error ~3% with 20 trials per class).

2. Stratified.
   Each subset preserves the original class distribution (i.e. it contains
   the same ratio of each class as the full dataset). In this dataset every
   class has exactly 100 images, so stratification is trivial — but the
   principle stops one class accidentally getting under-represented in any
   one subset.

3. Fixed random seed (42).
   Anyone running this script gets the same files in the same buckets.
   Reproducibility matters: without it, "the model worked yesterday" can
   silently become "the model fails today" because the split changed.

4. Source MP4 files are skipped.
   Each class folder ships an MP4 video alongside the PNGs. Those are the
   source-of-truth turntable renders. We only want the frame stills.

5. Output directory is wiped before re-running.
   So a re-run is identical to a first run. No leftover files from a
   previous attempt confuse the next gallery build.

6. Deduplicate by file content BEFORE splitting.
   A data-quality audit found nine byte-identical pairs in the source
   dataset — one per class, always frames `_000000` and `_000001`. We MD5
   every candidate image and drop later duplicates (sorted filename order)
   so each split contains only unique views. This is the upstream fix:
   reference / val / test all stay free of duplicate frames.

RUN (from repository root)
--------------------------
    python scripts/split_dataset.py

Output is written to data/ at the repo root. The data/reference, data/val,
and data/test folders shipped with this pack were produced by exactly this
script — re-running it is reproducible thanks to the fixed seed.
"""

import hashlib
import random
import shutil
from pathlib import Path


# ===========================================================================
# 1. CONFIGURATION
# ===========================================================================
# All knobs in one block at the top so the actual logic below stays readable.
# ===========================================================================

# Repo root = parent of the scripts/ directory.
ROOT = Path(__file__).resolve().parent.parent

# Where the dataset got unzipped to. If you reorganise, just change this line.
SRC = ROOT / "dataset_raw" / "WeddingRing Dataset"

# Where we write the split.
OUT = ROOT / "data"

# Per-split fractions. Must sum to 1.0.
# Reference is the gallery — bumping it from 30% to 60% gives the top-k vote
# more poses per class to average over, which is what makes the system robust
# to real customer photos (lighting, angle, finger occlusion).
RATIOS = {"reference": 0.60, "val": 0.20, "test": 0.20}

# Random seed for the shuffle. Any integer; 42 is conventional.
SEED = 42

# Lowercase suffixes we treat as images. Set for O(1) membership test.
IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}


def file_md5(path: Path) -> str:
    """MD5 hex digest of the file's raw bytes (duplicate detection, not security)."""
    h = hashlib.md5()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


# ===========================================================================
# 2. SETUP
# ===========================================================================
# Seed the RNG and validate that the source data is actually present.
# ===========================================================================

# random.seed makes random.shuffle deterministic across runs.
random.seed(SEED)

# Fail fast if the source directory is missing (e.g. the user forgot to
# unzip the dataset). SystemExit gives a non-zero exit code so shell pipes
# can detect the failure.
if not SRC.exists():
    raise SystemExit(f"Source not found: {SRC.resolve()}. Did you unzip the dataset?")

# Wipe any previous splits so re-running is deterministic. If we appended
# instead, a second run would silently double the gallery.
if OUT.exists():
    shutil.rmtree(OUT)

print(f"Splitting from {SRC} → {OUT}  (seed={SEED}, ratios={RATIOS})")
print()


# ===========================================================================
# 3. PER-CLASS SPLIT
# ===========================================================================
# For each class folder under the source root:
#   - collect its image files (skipping MP4s and anything non-image)
#   - shuffle (deterministically, thanks to the seed above)
#   - slice into three parts according to RATIOS
#   - copy into data/<split>/<class>/
# ===========================================================================

# Running totals for the final summary print.
totals = {k: 0 for k in RATIOS}
total_dropped = 0

for class_dir in sorted(p for p in SRC.iterdir() if p.is_dir()):
    # sorted() inside the comprehension makes the iteration order
    # deterministic — useful for debugging.
    raw_images = sorted(
        p for p in class_dir.iterdir()
        if p.suffix.lower() in IMG_EXTS
    )

    # DEDUPE BY CONTENT (sorted-filename order keeps the earlier frame, e.g.
    # `_000000` over `_000001`). The MD5 audit on this dataset finds nine
    # byte-identical pairs — one per class. Removing duplicates here means
    # every split downstream contains only unique views, and the gallery
    # build never has to worry about the issue.
    seen_hashes: set[str] = set()
    images: list[Path] = []
    dropped: list[Path] = []
    for img in raw_images:
        digest = file_md5(img)
        if digest in seen_hashes:
            dropped.append(img)
            continue
        seen_hashes.add(digest)
        images.append(img)
    total_dropped += len(dropped)

    # random.shuffle is in-place. After this, `images` is a random permutation
    # — but deterministically random thanks to the seed.
    random.shuffle(images)

    # Slice the shuffled list into the three buckets. int() truncates, so
    # the test bucket absorbs any rounding remainder. For ~99 unique images
    # and the 60/20/20 ratios above this gives approximately 59/19/21 per class.
    n = len(images)
    n_ref = int(n * RATIOS["reference"])
    n_val = int(n * RATIOS["val"])
    splits = {
        "reference": images[:n_ref],
        "val":       images[n_ref:n_ref + n_val],
        "test":      images[n_ref + n_val:],
    }

    for split_name, imgs in splits.items():
        # Mirror the class subfolder under the chosen split.
        dest = OUT / split_name / class_dir.name
        dest.mkdir(parents=True, exist_ok=True)
        for img in imgs:
            # copy2 preserves the original file's modification time, which
            # is occasionally useful when debugging "did this file change?"
            # questions.
            shutil.copy2(img, dest / img.name)
        totals[split_name] += len(imgs)

    dup_suffix = f"  [skipped {len(dropped)} dup]" if dropped else ""
    print(f"  {class_dir.name:10s}  "
          f"ref={len(splits['reference']):3d}  "
          f"val={len(splits['val']):3d}  "
          f"test={len(splits['test']):3d}  "
          f"(unique {n} / raw {len(raw_images)}){dup_suffix}")


# ===========================================================================
# 4. SUMMARY
# ===========================================================================

print()
print(f"DONE.  reference={totals['reference']}  val={totals['val']}  test={totals['test']}  "
      f"(dedup removed {total_dropped} duplicate file(s) before splitting)")
