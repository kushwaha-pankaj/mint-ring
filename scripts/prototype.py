"""
Ring Product Identification – Embedding Similarity Prototype (Option B)
========================================================================

PURPOSE
-------
Identify which of nine known rings appears in a query image, by:
  1. Building a "gallery" of reference embeddings (one per known image).
  2. Embedding the query image with the same encoder.
  3. Finding the nearest gallery embeddings via cosine similarity.
  4. Voting per class to produce a label + confidence.
  5. Returning "unknown" if the best score is below a threshold.

We do NOT train a model. Instead we use a pretrained vision encoder
(ResNet50 or DINOv2) as a feature extractor — the same trick used by
face recognition and visual product search at scale.

HOW THE CODE IS LAID OUT
------------------------
The script is intentionally split into eight numbered sections.
Each section is a clear conceptual step in the pipeline; comments
inside each section explain the WHY, not just the WHAT.

  1. CONFIGURATION       – constants and thresholds
  2. MODEL LOADING       – load a pretrained encoder, strip its classifier head
  3. IMAGE LOADING + EMBEDDING – preprocess and produce a single vector
  4. GALLERY BUILD       – run the encoder over a folder of reference images
  5. RETRIEVAL + PREDICTION – cosine similarity, top-k aggregation, threshold
  6. EVALUATION          – top-1/top-3 accuracy, confusion matrix, per-class metrics
  7. WEBCAM DEMO         – live identification from a camera feed
  8. CLI                 – argparse glue that wires the above together

If you are reading this to learn the system end-to-end, follow the
"life of one image" path:
    main() → predict_from_path() → load_image() → embed_image()
          → predict() → return Prediction

For a deeper conceptual treatment of the terms used here
(encoder, embedding, cosine similarity, L2 normalisation, top-k, etc.)
see docs/glossary.md and docs/definitions.md.

DIRECTORY LAYOUT EXPECTED
-------------------------
data/
├── reference/                          # The "gallery" — known examples
│   ├── WAL2-R/                         # One subfolder per ring class
│   │   ├── WAL2-R_000000.png           # Each image becomes one gallery vector
│   │   ├── WAL2-R_000001.png
│   │   └── ...
│   ├── WAL2-W/
│   └── ...
└── test/                               # Held-out images for evaluation
    └── ...

RUN (from the repository root)
------------------------------
  python scripts/prototype.py --build-gallery data/reference --gallery artifacts/gallery.npz
  python scripts/prototype.py --gallery artifacts/gallery.npz --query path/to/image.jpg
  python scripts/prototype.py --gallery artifacts/gallery.npz --evaluate data/test
  python scripts/prototype.py --gallery artifacts/gallery.npz --webcam

DEPENDENCIES
------------
  pip install torch torchvision pillow numpy scikit-learn opencv-python
  # optional: DINOv2 is pulled from torch.hub on first use
"""

from __future__ import annotations

# ---------- Standard library ----------
import argparse            # parse --build-gallery, --query, etc. from the CLI
import hashlib             # MD5 content hashes for duplicate detection at gallery build
import json                # pretty-print results so they pipe nicely to other tools
import sys                 # entrypoint at the bottom uses sys.argv / sys.exit
import warnings            # suppress benign DINOv2 xFormers optional-dep warnings
from dataclasses import dataclass  # @dataclass = auto __init__/__repr__/__eq__ for plain containers
from pathlib import Path   # modern path handling. Avoids string-concat bugs.
from typing import Optional

# ---------- Third-party ----------
import numpy as np         # all our vector maths is numpy. Embeddings live as np.ndarray.
import torch
import torch.nn as nn      # nn.Identity is what we use to "remove" the classifier head
from PIL import Image, ImageOps   # PIL for image I/O. ImageOps.exif_transpose fixes phone rotation.
from torchvision import models, transforms  # ResNet50 + its canonical preprocessing pipeline


# ===========================================================================
# 1. CONFIGURATION
# ===========================================================================
# All knobs in one place so the rest of the file reads cleanly. Every
# constant in this block is something a panellist might ask about — keep
# the comments here as your defensible justification.
# ===========================================================================

# Use CUDA (NVIDIA GPU) if available; otherwise fall back to CPU. On a laptop
# without a GPU this still runs comfortably — ResNet50 inference is ~50 ms per
# image on a modern CPU.
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# File extensions we recognise as images. A set (not a list) gives O(1) lookup
# when we ask "is this file an image?". Lowercase only — we always compare
# against `path.suffix.lower()`.
IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}

# Confidence threshold. If the top-class mean similarity is below this, we
# return "unknown" instead of guessing. 0.55 is a STARTING value — in real
# production it should be calibrated on the validation set by sweeping the
# precision-recall curve. The point is the system *has* a threshold; a softmax
# classifier doesn't and that's one of the reasons we chose Option B.
DEFAULT_CONFIDENCE_THRESHOLD = 0.55

# How many nearest neighbours to look at when aggregating. Smaller k = more
# sensitive to single noisy reference images. Larger k = blurs across classes.
# k=5 is a sensible middle ground for ~30 references per class.
TOP_K = 5


def file_content_md5(path: Path) -> str:
    """MD5 hex digest of raw file bytes (for duplicate detection, not security)."""
    digest = hashlib.md5()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


# ===========================================================================
# 2. MODEL LOADING
# ===========================================================================
# This is where we get the pretrained encoder. The encoder is the
# component that turns an image into a fixed-length vector (an "embedding").
# We use it FROZEN — no training, no fine-tuning, just forward passes.
# ===========================================================================

def load_encoder(name: str = "resnet50") -> tuple[nn.Module, transforms.Compose, int]:
    """
    Load a pretrained encoder and return:
        (model, preprocess_pipeline, embedding_dimension)

    Encoder choices:
      - "resnet50": Microsoft's 2015 CNN, pretrained on ImageNet (1.28M labelled
                    photos, 1000 classes). 25M parameters. Output: 2048-d vector.
                    Strong supervised baseline; works well on this synthetic data.
      - "dinov2":   Meta AI's 2023 self-supervised Vision Transformer. Trained
                    on 142M natural photographs without human labels.
                    Output: 384-d (ViT-S/14 variant).

    Why a frozen encoder rather than a fine-tuned one:
      - Training data is small (~100 images per class).
      - The encoder has already learned general visual features (edges,
        textures, geometric patterns, surface properties) from a much larger
        dataset — we just reuse that knowledge.
      - Adding a new ring becomes "drop reference photos in a folder",
        not "kick off a retraining job".
    """

    if name == "resnet50":
        # IMAGENET1K_V2 is the better of the two official torchvision weight
        # bundles for ResNet50 — ~80% top-1 on ImageNet vs ~76% for V1.
        weights = models.ResNet50_Weights.IMAGENET1K_V2
        model = models.resnet50(weights=weights)

        # ResNet50's last layer is Linear(2048 -> 1000), which produces
        # probabilities over the 1000 ImageNet classes. We don't want those;
        # we want the 2048-dim feature vector that sits one step earlier.
        # Replacing the layer with Identity (a no-op) makes model(x) return
        # the feature vector directly. This is the canonical
        # "feature extractor" idiom.
        model.fc = nn.Identity()

        # Every torchvision weight bundle ships its own preprocessing pipeline:
        # the exact resize, crop, and normalisation the model was trained with.
        # Using it guarantees we feed the model the input distribution it
        # expects. Skipping or fudging this is a silent way to degrade quality.
        preprocess = weights.transforms()
        embedding_dim = 2048

    elif name == "dinov2":
        # DINOv2 is fetched from torch.hub on first call (cached locally after).
        # Falls back to ResNet50 gracefully if there's no internet on first run.
        #
        # xFormers is an optional speed/memory optimisation inside the hub repo.
        # Without it, DINOv2 uses standard PyTorch attention (correct for inference).
        # We suppress the three UserWarnings on load — xformers often has no wheel
        # for macOS / Python 3.14, and the messages are noise in the demo terminal.
        try:
            with warnings.catch_warnings():
                warnings.filterwarnings(
                    "ignore",
                    message="xFormers is not available",
                    category=UserWarning,
                )
                model = torch.hub.load("facebookresearch/dinov2", "dinov2_vits14")
        except Exception as e:
            print(f"[warn] DINOv2 load failed ({e}); falling back to ResNet50.")
            return load_encoder("resnet50")

        # DINOv2 doesn't ship a torchvision-style transforms() helper, so we
        # build the canonical pipeline by hand. 518 = 37 patches × 14 patch_size
        # is the resolution DINOv2 ViT-S/14 expects.
        preprocess = transforms.Compose([
            transforms.Resize(520, interpolation=transforms.InterpolationMode.BICUBIC),
            transforms.CenterCrop(518),
            transforms.ToTensor(),                # PIL Image -> tensor in [0, 1]
            transforms.Normalize(                 # subtract ImageNet mean/divide by std
                mean=(0.485, 0.456, 0.406),
                std=(0.229, 0.224, 0.225),
            ),
        ])
        embedding_dim = 384
    else:
        raise ValueError(f"Unknown encoder '{name}'. Use 'resnet50' or 'dinov2'.")

    # eval() switches batchnorm / dropout to inference mode → deterministic outputs.
    # .to(DEVICE) moves the parameters onto the GPU if one is available.
    model.eval().to(DEVICE)

    # Belt-and-braces freeze. We're not training, so we don't need gradients.
    # Setting requires_grad=False frees autograd from tracking these tensors,
    # which saves memory and speeds up forward passes.
    for p in model.parameters(): # pyright: ignore[reportAttributeAccessIssue, reportUnknownMemberType]
        p.requires_grad_(False) # type: ignore

    return model, preprocess, embedding_dim


# ===========================================================================
# 3. IMAGE LOADING + EMBEDDING
# ===========================================================================
# These two functions are what runs for every image in the system —
# both at gallery-build time AND at query time. Keep them small and clean.
# ===========================================================================

def load_image(path: Path) -> Image.Image:
    """
    Open an image file from disk and return a PIL RGB Image.

    Two important details:

    1. EXIF orientation. Modern cameras and phones store images on disk in
       their native sensor orientation, plus a rotation flag in the EXIF
       metadata block. PIL by default IGNORES that flag, so e.g. a portrait
       photo loads as a landscape image lying on its side. We use
       ImageOps.exif_transpose to read the flag and physically rotate the
       pixels. Skipping this line silently kills accuracy on real photos.

    2. RGB conversion. Greyscale PNGs become 3-channel grey; RGBA PNGs drop
       their alpha channel; palette-mode (8-bit indexed) PNGs are expanded.
       Without this, the model crashes on the first non-3-channel input.
    """
    img = Image.open(path)
    img = ImageOps.exif_transpose(img)
    return img.convert("RGB")


@torch.inference_mode()  # disable autograd globally inside this function (faster than torch.no_grad)
def embed_image(img: Image.Image, model: nn.Module, preprocess) -> np.ndarray:
    """
    Take one PIL image, run it through the encoder, and return a 1-D
    L2-normalised numpy float32 vector.

    Step by step for one image:
      1.  preprocess(img)            → torch.Tensor of shape (3, H, W)
      2.  .unsqueeze(0)              → shape (1, 3, H, W) — models expect a batch dim
      3.  .to(DEVICE)                → move onto GPU if available
      4.  model(...)                 → shape (1, D) where D = 2048 (ResNet50) or 384 (DINOv2)
      5.  .squeeze(0)                → shape (D,)
      6.  .cpu().numpy().astype(...) → leave PyTorch land, enter numpy land
      7.  divide by L2 norm          → unit vector. AFTER this, cosine similarity
                                       between any two embeddings is just a dot product.

    Why L2 normalisation (the magic step):
      Cosine similarity is defined as (a · b) / (||a|| · ||b||).
      If we pre-divide both vectors by their lengths, ||a|| = ||b|| = 1, so
      cosine reduces to a plain dot product `a @ b`. This is the trick that
      lets the entire gallery search be one matrix multiplication.
    """
    tensor = preprocess(img).unsqueeze(0).to(DEVICE)
    embedding = model(tensor).squeeze(0).cpu().numpy().astype(np.float32)

    # Defensive: a zero vector would blow up the division. In practice the
    # encoder never produces this, but the guard is free.
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm
    return embedding


def embed_batch(paths: list[Path], model, preprocess, batch_size: int = 16) -> np.ndarray:
    """
    Embed many images at once. Same logic as embed_image() but processes
    `batch_size` images per forward pass for efficiency.

    Why batching matters: GPUs (and to a lesser extent CPUs) are highly
    parallel. Running 16 images in one forward pass is ~5x faster than 16
    individual forward passes. With 261 reference images this turns a
    minute of gallery building into ~10 seconds.

    Returns an (N, D) matrix where each row is one L2-normalised embedding.
    Row i corresponds to paths[i].
    """
    all_vecs = []
    for i in range(0, len(paths), batch_size):
        chunk = paths[i:i + batch_size]

        # Stack the preprocessed tensors into one batch dimension.
        # torch.stack: list of (3, H, W) tensors → (B, 3, H, W) tensor.
        tensors = torch.stack([preprocess(load_image(p)) for p in chunk]).to(DEVICE)

        with torch.inference_mode():
            vecs = model(tensors).cpu().numpy().astype(np.float32)  # (B, D)

        # Row-wise L2 normalisation. Calculate every row's length...
        norms = np.linalg.norm(vecs, axis=1, keepdims=True)  # (B, 1)
        norms[norms == 0] = 1.0                              # avoid divide-by-zero
        vecs = vecs / norms                                  # broadcast (B, D) / (B, 1)
        all_vecs.append(vecs)

    # np.vstack concatenates along axis 0: list of (B, D) → (N, D).
    return np.vstack(all_vecs)


# ===========================================================================
# 4. GALLERY BUILD
# ===========================================================================
# The gallery is the system's memory of "what known rings look like".
# It is built ONCE per encoder (or whenever the catalogue changes) and
# loaded into RAM at inference time.
# ===========================================================================

@dataclass
class Gallery:
    """
    A container for the precomputed reference embeddings and their labels.

    Row i of `embeddings` came from the image at `paths[i]` and belongs to
    the class at `labels[i]`. `classes` is the sorted unique list of class
    names (useful for the confusion matrix, dropdowns, etc.). `encoder_name`
    tells future code which encoder these embeddings came from — never mix
    embeddings from different encoders in the same gallery.

    @dataclass automatically gives us __init__, __repr__, and __eq__ so we
    don't have to write boilerplate.
    """
    embeddings: np.ndarray   # shape (N, D), L2-normalised, dtype float32
    labels: list[str]        # length N — class label for each row
    paths: list[str]         # length N — original file path for each row
    classes: list[str]       # sorted unique labels
    encoder_name: str        # which encoder produced these embeddings

    def save(self, path: Path) -> None:
        """
        Persist the gallery to disk as a single .npz file.

        .npz is numpy's native compressed format. Good enough for this scale
        (261 vectors × 2048 dimensions = ~2 MB). For 10k+ vectors you would
        graduate to FAISS or a vector database, but the interface stays
        the same.
        """
        np.savez(
            path,
            embeddings=self.embeddings,
            labels=np.array(self.labels),
            paths=np.array(self.paths),
            classes=np.array(self.classes),
            encoder_name=np.array(self.encoder_name),
        )

    @classmethod
    def load(cls, path: Path) -> "Gallery":
        """Load a previously-saved gallery file."""
        # allow_pickle=True is needed because we stored string arrays.
        data = np.load(path, allow_pickle=True)
        return cls(
            embeddings=data["embeddings"],
            labels=data["labels"].tolist(),
            paths=data["paths"].tolist(),
            classes=data["classes"].tolist(),
            encoder_name=str(data["encoder_name"]),
        )

    def reference_content_hashes(self) -> set[str]:
        """MD5 of every image file currently stored in this gallery."""
        return {file_content_md5(Path(p)) for p in self.paths}


def collect_reference_paths(
    root: Path,
    *,
    dedupe: bool = True,
) -> tuple[list[Path], list[str], list[Path]]:
    """
    Walk `root` (folder-per-class) and return paths to embed.

    When dedupe=True, skip later files whose bytes match an earlier file
    (sorted class order, then sorted filename). First occurrence wins.
    """
    paths: list[Path] = []
    labels: list[str] = []
    skipped: list[Path] = []
    seen_hashes: set[str] = set()

    for class_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        for img_path in sorted(class_dir.iterdir()):
            if img_path.suffix.lower() not in IMG_EXTS:
                continue
            if dedupe:
                digest = file_content_md5(img_path)
                if digest in seen_hashes:
                    skipped.append(img_path)
                    continue
                seen_hashes.add(digest)
            paths.append(img_path)
            labels.append(class_dir.name)

    return paths, labels, skipped


def build_gallery(
    root: Path,
    encoder_name: str = "resnet50",
    *,
    dedupe: bool = True,
) -> Gallery:
    """
    Scan `root` for class subfolders, embed every image, return a Gallery.

    Expected layout:
        root/
        ├── class_A/
        │   ├── img001.png
        │   └── img002.png
        ├── class_B/
        │   └── ...

    Each subfolder name becomes the class label for every image inside it.
    This is the same convention used by torchvision.datasets.ImageFolder.

    Reading the directory in sorted() order makes the gallery deterministic
    across runs — useful for debugging and reproducible evaluation.

    With dedupe=True (default), byte-identical reference files are embedded
    only once so top-k aggregation is not biased by duplicate gallery vectors.
    """
    paths, labels, skipped = collect_reference_paths(root, dedupe=dedupe)

    if skipped:
        print(f"[gallery] dedupe: skipped {len(skipped)} byte-identical file(s):", file=sys.stderr)
        for p in skipped:
            print(f"  - {p}", file=sys.stderr)
    elif dedupe:
        print("[gallery] dedupe: no byte-identical duplicates among reference files", file=sys.stderr)

    if not paths:
        raise RuntimeError(f"No images found under {root}")

    model, preprocess, _ = load_encoder(encoder_name)

    print(f"[gallery] embedding {len(paths)} images across "
          f"{len(set(labels))} rings using {encoder_name} on {DEVICE}...")

    embeddings = embed_batch(paths, model, preprocess)
    return Gallery(
        embeddings=embeddings,
        labels=labels,
        paths=[str(p) for p in paths],
        classes=sorted(set(labels)),
        encoder_name=encoder_name,
    )


# ===========================================================================
# 5. RETRIEVAL + PREDICTION
# ===========================================================================
# Given a query embedding, find the best matching ring class. This is the
# heart of the system. Everything else (image I/O, gallery build, CLI) is
# infrastructure around this.
# ===========================================================================

@dataclass
class Prediction:
    """
    The structured result of a single query.

      - ring_id:    the predicted class name, or None if the system declined
                    to guess (i.e. confidence below the threshold).
      - confidence: the mean cosine similarity of the predicted class within
                    the top-k neighbours. A real number in [-1, 1], typically
                    in [0.5, 1.0] for ring images.
      - top_k:      list of (label, similarity, gallery_path) tuples for the
                    k most similar reference images. Useful for surfacing a
                    shortlist to a human reviewer.
    """
    ring_id: Optional[str]
    confidence: float
    top_k: list[tuple[str, float, str]]


def predict(
    query_embedding: np.ndarray,
    gallery: Gallery,
    top_k: int = TOP_K,
    threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
) -> Prediction:
    """
    Predict the ring class for a query embedding.

    Algorithm:
      1. Compute cosine similarity between the query and every gallery vector.
      2. Take the top-k most similar gallery entries.
      3. Group those entries by class and compute the mean similarity per class.
      4. The class with the highest mean similarity wins.
      5. If that mean is below `threshold`, return Prediction with ring_id=None.

    Why mean similarity instead of a majority vote among top-k:
      - A vote ignores how confident each neighbour was. A class winning 3-2
        could win even when the 3 votes are weak matches and the 2 are strong.
      - Mean similarity weights the evidence by strength.
      - On small galleries with frequent ties, mean is a better tie-breaker.
    """

    # -- Step 1: cosine similarity in one line -------------------------------
    # Both gallery rows and the query are L2-normalised, so the inner product
    # IS the cosine similarity. One matrix-vector multiplication produces
    # all N similarities at once. On a 261-vector gallery this is microseconds.
    sims = gallery.embeddings @ query_embedding   # shape (N,)

    # -- Step 2: top-k indices -----------------------------------------------
    # argpartition runs in O(N) and gives the top-k indices in arbitrary
    # order. We then sort just those k by similarity descending — O(k log k).
    # The naïve `argsort(-sims)[:top_k]` would be O(N log N), wasteful when
    # the gallery is large.
    top_idx = np.argpartition(-sims, kth=min(top_k, len(sims) - 1))[:top_k]
    top_idx = top_idx[np.argsort(-sims[top_idx])]

    # Materialise the top-k as (label, similarity, source_path) tuples.
    top_results = [
        (gallery.labels[i], float(sims[i]), gallery.paths[i])
        for i in top_idx
    ]

    # -- Step 3: per-class mean similarity within top-k ----------------------
    class_scores: dict[str, list[float]] = {}
    for label, sim, _ in top_results:
        class_scores.setdefault(label, []).append(sim)
    aggregated = {c: float(np.mean(s)) for c, s in class_scores.items()}

    # -- Step 4: pick the winner ---------------------------------------------
    best_class = max(aggregated, key=aggregated.get)
    best_score = aggregated[best_class]

    # -- Step 5: threshold check ---------------------------------------------
    # The "honest unknown" answer. Softmax classifiers cannot do this; they
    # always sum to 1.0 and so are forced to commit. Embedding similarity
    # gives us a real-valued confidence we can compare to a calibrated cutoff.
    if best_score < threshold:
        return Prediction(ring_id=None, confidence=best_score, top_k=top_results)
    return Prediction(ring_id=best_class, confidence=best_score, top_k=top_results)


def predict_from_path(path: Path, gallery: Gallery, threshold: float = DEFAULT_CONFIDENCE_THRESHOLD) -> Prediction:
    """
    Convenience wrapper: file path → Prediction.

    Loads the encoder matching the gallery's encoder_name, embeds the image,
    and runs the prediction.
    """
    model, preprocess, _ = load_encoder(gallery.encoder_name)
    query_vec = embed_image(load_image(path), model, preprocess)
    return predict(query_vec, gallery, threshold=threshold)


# ===========================================================================
# 6. EVALUATION
# ===========================================================================
# Run the prediction pipeline over a labelled test set and compute the
# headline metrics: top-1, top-3, per-class precision/recall/F1, and the
# confusion matrix. This is what produces the numbers on the slide deck.
# ===========================================================================

def evaluate(
    gallery: Gallery,
    test_root: Path,
    threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    *,
    skip_gallery_duplicates: bool = True,
) -> dict:
    """
    Score the system on a held-out test set.

    Layout of test_root mirrors the gallery layout:
        test_root/
        ├── class_A/
        │   ├── unseen_001.png
        │   └── unseen_002.png
        ├── class_B/
        │   └── ...

    Metrics returned:
      - top1_accuracy:    fraction where the best guess equals the true label
      - top3_accuracy:    fraction where the true label is in the top-3 ranked classes
      - rejection_rate:   fraction where the system returned 'unknown' at this threshold
      - confusion_matrix: K×K integer matrix (rows = true, cols = predicted)
      - per_class:        precision/recall/F1/support per class (sklearn's classification_report)

    Important rule: NEVER evaluate against the same images that built the
    gallery. That measures memorisation, not generalisation. The split is
    handled upstream by split_dataset.py.

    When skip_gallery_duplicates=True (default), test images whose file bytes
    match any gallery reference are excluded from metrics (same pixels as a
    gallery entry would be a trivial nearest-neighbour hit).
    """
    model, preprocess, _ = load_encoder(gallery.encoder_name)
    gallery_hashes = gallery.reference_content_hashes() if skip_gallery_duplicates else set()

    # Parallel lists: y_true[i] is the true label for the i-th test image,
    # y_pred[i] is the system's predicted label (or None for 'unknown').
    y_true: list[str] = []
    y_pred: list[Optional[str]] = []
    top3_correct = 0
    n_total = 0
    skipped_gallery_dup: list[str] = []

    for class_dir in sorted(p for p in test_root.iterdir() if p.is_dir()):
        for img_path in sorted(class_dir.iterdir()):
            if img_path.suffix.lower() not in IMG_EXTS:
                continue
            if skip_gallery_duplicates and file_content_md5(img_path) in gallery_hashes:
                skipped_gallery_dup.append(str(img_path))
                continue
            n_total += 1
            true_label = class_dir.name
            y_true.append(true_label)

            vec = embed_image(load_image(img_path), model, preprocess)
            pred = predict(vec, gallery, threshold=threshold)
            y_pred.append(pred.ring_id)

            # Top-3 = true label appears anywhere in the top-3 returned matches.
            top3_labels = [lbl for lbl, _, _ in pred.top_k[:3]]
            if true_label in top3_labels:
                top3_correct += 1

    if skipped_gallery_dup:
        print(f"[evaluate] skipped {len(skipped_gallery_dup)} test image(s) "
              "byte-identical to a gallery reference", file=sys.stderr)

    # Top-1 treats 'unknown' (None) as wrong, which is the strict scoring.
    correct = sum(1 for t, p in zip(y_true, y_pred) if t == p)
    top1 = correct / n_total if n_total else 0.0
    top3 = top3_correct / n_total if n_total else 0.0

    # Lazy import so the script still runs if scikit-learn is missing for
    # other code paths (e.g. just running --query).
    from sklearn.metrics import confusion_matrix, classification_report
    classes = gallery.classes

    # Replace None ('unknown') with a sentinel string so sklearn doesn't choke.
    y_pred_for_cm = [p if p is not None else "UNKNOWN" for p in y_pred]
    cm_labels = classes + (["UNKNOWN"] if "UNKNOWN" in y_pred_for_cm else [])
    cm = confusion_matrix(y_true, y_pred_for_cm, labels=cm_labels)
    report = classification_report(
        y_true, y_pred_for_cm, labels=cm_labels, zero_division=0, output_dict=True
    )

    rejection_rate = sum(1 for p in y_pred if p is None) / n_total if n_total else 0.0

    return {
        "n_total": n_total,
        "n_skipped_gallery_duplicate": len(skipped_gallery_dup),
        "skipped_gallery_duplicate_paths": skipped_gallery_dup,
        "top1_accuracy": top1,
        "top3_accuracy": top3,
        "rejection_rate_at_threshold": rejection_rate,
        "confusion_matrix_labels": cm_labels,
        "confusion_matrix": cm.tolist(),
        "per_class": report,
        "threshold": threshold,
        "encoder": gallery.encoder_name,
    }


# ===========================================================================
# 7. WEBCAM DEMO
# ===========================================================================
# Live identification from the default camera. Each frame is treated as a
# query image. Latency is small enough (~50-100 ms) for a 5-10 FPS feed
# on a laptop CPU.
#
# There are two surfaces for the camera:
#   - This CLI loop (`python scripts/prototype.py --webcam`) uses OpenCV to
#     run a true continuous feed in a desktop window. Useful for kiosk-style
#     full-screen presentation.
#   - The Streamlit demo (scripts/demo.py) exposes a single-frame capture
#     via st.camera_input() in a sibling expander on the Identify tab. Same
#     pipeline, just one snapshot at a time. That's the path the panel
#     will see during the interview.
#
# Either way the webcam is most useful for the in-person Hockley Mint
# follow-up with physical rings — for the synthetic-gallery pilot it will
# usually say 'unknown' on real-world scenes (the domain gap is real).
# ===========================================================================

def webcam_loop(gallery: Gallery, threshold: float = DEFAULT_CONFIDENCE_THRESHOLD) -> None:
    """
    Live identification from the default webcam. Press 'q' to quit.

    Loop body:
      1. Capture frame from the camera (OpenCV gives BGR).
      2. Convert BGR -> RGB and wrap as a PIL image.
      3. Run the same embed_image / predict pipeline used everywhere else.
      4. Draw the prediction + confidence on the frame.
      5. Show the frame in a window.
    """
    # OpenCV is imported lazily because most code paths don't need it and we
    # don't want to crash on machines where it isn't installed.
    try:
        import cv2
    except ImportError:
        print("Install opencv-python for the webcam demo: pip install opencv-python")
        return

    model, preprocess, _ = load_encoder(gallery.encoder_name)
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Could not open webcam.")
        return

    print("[webcam] press 'q' to quit.")
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break  # camera disconnected or end of stream

            # OpenCV's native format is BGR (historical reasons).
            # PIL/torchvision expect RGB. Skipping this swap silently gives
            # bad predictions because the colour channels are wrong.
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil = Image.fromarray(rgb)

            vec = embed_image(pil, model, preprocess)
            pred = predict(vec, gallery, threshold=threshold)

            label = pred.ring_id if pred.ring_id else "unknown"
            text = f"{label}  ({pred.confidence:.2f})"

            # Green for accepted predictions, red for 'unknown'.
            colour = (0, 255, 0) if pred.ring_id else (0, 0, 255)
            cv2.putText(frame, text, (20, 40), cv2.FONT_HERSHEY_SIMPLEX,
                        1.0, colour, 2)
            cv2.imshow("Ring identifier (q to quit)", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        # Make sure the camera is released even on Ctrl+C, otherwise it
        # stays "in use" until you reboot.
        cap.release()
        cv2.destroyAllWindows()


# ===========================================================================
# 8. CLI
# ===========================================================================
# Thin argparse layer that wires the above functions to command-line flags.
# Use --build-gallery FIRST (one-off), then --query / --evaluate / --webcam.
# ===========================================================================

def main(argv: list[str]) -> int:
    """Parse arguments and dispatch to the right action."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--encoder", choices=["resnet50", "dinov2"], default="resnet50",
                        help="Which pretrained encoder to use.")
    parser.add_argument("--build-gallery", type=Path,
                        help="Path to the reference root. Build a gallery and save it.")
    parser.add_argument("--gallery", type=Path, default=Path("artifacts/gallery.npz"),
                        help="Where to read or write the gallery file.")
    parser.add_argument("--query", type=Path,
                        help="Path to an image to identify.")
    parser.add_argument("--evaluate", type=Path,
                        help="Path to the test root. Compute the full accuracy report.")
    parser.add_argument("--webcam", action="store_true",
                        help="Run the live webcam demo.")
    parser.add_argument("--threshold", type=float, default=DEFAULT_CONFIDENCE_THRESHOLD,
                        help="Confidence threshold below which we return 'unknown'.")
    parser.add_argument("--no-dedup", action="store_true",
                        help="With --build-gallery: embed byte-identical reference files more than once.")
    parser.add_argument("--include-gallery-dupes-in-eval", action="store_true",
                        help="With --evaluate: count test images that are byte-identical to gallery refs.")
    args = parser.parse_args(argv)

    # -- Action 1: build a gallery and write it to disk ----------------------
    if args.build_gallery:
        gallery = build_gallery(
            args.build_gallery,
            encoder_name=args.encoder,
            dedupe=not args.no_dedup,
        )
        args.gallery.parent.mkdir(parents=True, exist_ok=True)
        gallery.save(args.gallery)
        print(f"[gallery] saved → {args.gallery}  ({len(gallery.labels)} vectors, "
              f"{len(gallery.classes)} classes, encoder={gallery.encoder_name})")
        return 0

    # All remaining actions need a gallery on disk.
    if not args.gallery.exists():
        print(f"Gallery not found at {args.gallery}. Build one first with --build-gallery.")
        return 1

    gallery = Gallery.load(args.gallery)

    # -- Action 2: identify a single image -----------------------------------
    if args.query:
        pred = predict_from_path(args.query, gallery, threshold=args.threshold)
        print(json.dumps({
            "query": str(args.query),
            "prediction": pred.ring_id,
            "confidence": round(pred.confidence, 4),
            "top_k": [
                {"label": lbl, "similarity": round(sim, 4), "path": p}
                for lbl, sim, p in pred.top_k
            ],
        }, indent=2))
        return 0

    # -- Action 3: full evaluation over a test set ---------------------------
    if args.evaluate:
        report = evaluate(
            gallery,
            args.evaluate,
            threshold=args.threshold,
            skip_gallery_duplicates=not args.include_gallery_dupes_in_eval,
        )
        print(json.dumps(report, indent=2))
        return 0

    # -- Action 4: live webcam demo ------------------------------------------
    if args.webcam:
        webcam_loop(gallery, threshold=args.threshold)
        return 0

    parser.print_help()
    return 0


# Standard "run only when invoked directly, not when imported" guard.
# Returns the int exit code from main() to the shell via sys.exit.
if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
