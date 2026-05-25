# mint-ring

Hockley Mint **AI Ring Studio** (BCU KTP demo): Identify, Design, Try-on, and Gallery modules plus the round-1 Streamlit identification prototype.

## Studio (monorepo)

```bash
./run_studio.sh
```

- Frontend: http://localhost:3000
- API health: http://localhost:8000/api/health

See [CLAUDE.md](CLAUDE.md) for architecture, env vars, and interview notes.

---

# Ring Product Identification — Demo Pack

Computer vision–based ring identification prototype using **embedding similarity**
(frozen pretrained encoder → cosine-similarity nearest-neighbour lookup against a
reference gallery). No model training — new rings are added by dropping reference
photos in a folder.

**Quick start:**

```bash
pip install -r requirements.txt
./run_demo.sh
```

Then open <http://localhost:8501> in a browser.

---

## What's in this folder

| Path | Contents |
|------|----------|
| `run_demo.sh` | Launches the Streamlit demo on port 8501 |
| `requirements.txt` | Python dependencies |
| `scripts/prototype.py` | Core pipeline: encoder loading, gallery build, prediction, evaluation, CLI |
| `scripts/demo.py` | Streamlit UI — imports from `prototype.py` |
| `scripts/split_dataset.py` | Reproducible 30/20/50 stratified split with MD5 dedup, seed=42 |
| `artifacts/gallery_resnet50.npz` | Prebuilt ResNet50 embedding gallery (261 vectors × 2048-d) |
| `artifacts/gallery_dinov2.npz` | Prebuilt DINOv2 ViT-S/14 embedding gallery (261 × 384-d) |
| `artifacts/results_resnet50.json` | Held-out evaluation report (top-1 83.9%, top-3 94.8%, n=459) |
| `artifacts/results_dinov2.json` | DINOv2 baseline (top-1 50.8%, top-3 81.3%) |
| `data/reference/` | 261 images — built the gallery |
| `data/val/` | 171 images — threshold tuning |
| `data/test/` | 459 images — held-out evaluation + Streamlit thumbnail grid |
| `dataset_raw/WeddingRing Dataset/` | 900 raw source frames + per-class MP4 — input to `split_dataset.py` |
| `plots/concepts/08_embedding_space*.png` | t-SNE embedding-space figures used by the demo |

---

## Dataset

- 9 ring classes = 3 designs (WAL2, WAM4, WAM5) × 3 metals (R / W / Y — Rose / White / Yellow gold)
- ~100 PNG frames per class at 440×330 (synthetic CAD renders, white background, turntable rotation)
- After byte-level dedup: 891 unique images, split 261 / 171 / 459

---

## Running the CLI directly

The Streamlit app is built on top of `prototype.py`, which also exposes a CLI:

```bash
# Identify one image
python scripts/prototype.py \
  --gallery artifacts/gallery_resnet50.npz \
  --query data/test/WAL2-R/<some_image>.png

# Full evaluation on held-out test set
python scripts/prototype.py \
  --gallery artifacts/gallery_resnet50.npz \
  --evaluate data/test \
  --threshold 0.55

# Rebuild the gallery from reference images (e.g. after adding new classes)
python scripts/prototype.py \
  --build-gallery data/reference \
  --gallery artifacts/gallery_resnet50.npz \
  --encoder resnet50

# Live webcam (requires opencv-python and a camera)
python scripts/prototype.py --gallery artifacts/gallery_resnet50.npz --webcam
```

---

## Key design choices

- **Frozen encoder, no fine-tuning** — small dataset (~100 images per class) and the
  catalogue grows over time; adding rings should not require retraining.
- **ResNet50 (ImageNet1K_V2)** chosen over DINOv2 ViT-S/14 — empirically stronger
  on these synthetic CAD renders (likely a domain-shift effect: DINOv2 is
  pretrained on natural photographs).
- **Top-k = 5 nearest neighbours, mean cosine per class** — weights evidence by
  similarity strength rather than a hard vote.
- **Confidence threshold 0.55** — system returns `unknown` rather than guessing
  when no class has strong support. Softmax classifiers cannot do this.
- **L2-normalised embeddings** — turns cosine similarity into a single matrix-
  vector multiply against the gallery.
