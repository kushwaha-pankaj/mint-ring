"""
Hockley Mint AI Ring Studio — FastAPI backend.

Step 0 scope: wrap the round-1 ResNet50 + cosine-similarity prototype
(apps/api/identification/prototype.py) behind a single HTTP endpoint
so the Next.js frontend can call it.

Run from the project root:
    /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 \
        -m uvicorn apps.api.main:app --reload --port 8000
"""

from __future__ import annotations

import io
import sys
import tempfile
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
import torch
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image
from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor

# Resolve project paths once so the rest of the file uses absolute paths.
API_DIR = Path(__file__).resolve().parent
IDENT_DIR = API_DIR / "identification"
PROJECT_ROOT = API_DIR.parent.parent

# The round-1 prototype is a sibling module — add it to sys.path so we can
# `import prototype` without restructuring the original file.
sys.path.insert(0, str(IDENT_DIR))
import prototype  # noqa: E402

from .attributes import extractor as attribute_extractor  # noqa: E402
from .design import engine as design_engine  # noqa: E402
from .design.router import build_router as build_design_router  # noqa: E402
from .design.storage import ensure_dirs as design_ensure_dirs  # noqa: E402
from .history import router as history_router  # noqa: E402
from .history.device import (  # noqa: E402
    gallery_device_scope,
    ip_derived_device_id,
    normalise_device_id,
)
from .tryon.router import build_router as build_tryon_router  # noqa: E402
from .tryon.storage import ensure_dirs as tryon_ensure_dirs  # noqa: E402

GALLERY_PATH = IDENT_DIR / "artifacts" / "gallery_resnet50.npz"

# Cosine-similarity defaults for /api/identify. Real in-distribution photos
# hit 0.95–0.99 with ResNet50 on this gallery (median 0.98); the round-1
# 0.55 default was set against a far smaller gallery and is no longer the
# right operating point. The studio UI lets the operator scrub the
# threshold and shortlist size live, with these as the starting values.
DEFAULT_THRESHOLD = 0.90
DEFAULT_TOP_K = 5
MIN_TOP_K = 1
MAX_TOP_K = 25
MIN_THRESHOLD = 0.0
MAX_THRESHOLD = 1.0

# ---- Ring object detector config ----
# Free local open-vocabulary detector. GroundingDINO handles small objects and
# lets us ask directly for "wedding ring" / "ring on finger" without relying on
# a weak jewellery-store Roboflow model.
RING_DETECTOR_ID = "IDEA-Research/grounding-dino-tiny"
RING_DETECTOR_PROMPT = (
    "ring. wedding ring. jewellery ring. gold ring. circular ring. "
    "product photo of a ring. ring on finger."
)
RING_DETECTOR_THRESHOLD = 0.08
RING_DETECTOR_TEXT_THRESHOLD = 0.08
RING_DETECTOR_MAX_AREA_RATIO = 0.70
RING_DETECTOR_FULL_FRAME_AREA_RATIO = 0.90
RING_DETECTOR_MAX_DETECTIONS = 5
RING_DETECTOR_NMS_IOU = 0.45


# ---- App + model lifecycle ----

app = FastAPI(
    title="Hockley Mint AI Ring Studio API",
    version="0.1.0",
    description="Step 0 — identification only. Modules 1-4 layered on later.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class _ModelState:
    """Loaded once at startup; reused per request."""
    gallery: prototype.Gallery | None = None
    model = None
    preprocess = None
    detector_processor = None
    detector_model = None
    encoder_name: str = ""
    boot_seconds: float = 0.0
    detector_boot_seconds: float = 0.0
    design_engine: design_engine.Engine | None = None


state = _ModelState()


def _design_engine_provider() -> design_engine.Engine:
    if state.design_engine is None:
        state.design_engine = design_engine.make_engine()
    return state.design_engine


def _design_engine_status() -> dict:
    design_engine.load_design_env()
    configured = (
        design_engine.os.environ.get("DESIGN_ENGINE", "pollinations").lower()
    )
    current = state.design_engine.name if state.design_engine is not None else None
    return {
        "configured": configured,
        "current": current,
        "fal_key_present": bool(
            design_engine.os.environ.get("FAL_KEY")
            or design_engine.os.environ.get("FAL_API_KEY")
        ),
    }


app.include_router(build_design_router(_design_engine_provider))
app.include_router(build_tryon_router(_design_engine_provider))
app.include_router(history_router)


@app.on_event("startup")
def _load_model_once() -> None:
    start = time.perf_counter()
    if not GALLERY_PATH.exists():
        raise RuntimeError(f"Gallery missing: {GALLERY_PATH}")
    state.gallery = prototype.Gallery.load(GALLERY_PATH)
    model, preprocess, _ = prototype.load_encoder(state.gallery.encoder_name)
    state.model = model
    state.preprocess = preprocess
    state.encoder_name = state.gallery.encoder_name
    state.boot_seconds = time.perf_counter() - start
    design_ensure_dirs()
    tryon_ensure_dirs()


@app.on_event("shutdown")
async def _shutdown_design_engine() -> None:
    if state.design_engine is not None:
        close = getattr(state.design_engine, "aclose", None)
        if close is not None:
            await close()


def _load_detector_once() -> None:
    """Lazy-load the detector so API boot stays fast for identification."""
    if state.detector_model is not None and state.detector_processor is not None:
        return
    start = time.perf_counter()
    state.detector_processor = AutoProcessor.from_pretrained(RING_DETECTOR_ID)
    state.detector_model = AutoModelForZeroShotObjectDetection.from_pretrained(RING_DETECTOR_ID)
    state.detector_model.eval()
    state.detector_boot_seconds = time.perf_counter() - start


# ---- Endpoints ----

@app.get("/api/studio/device")
def studio_device(request: Request) -> dict:
    """
    Stable ids for this client.

    machine_device_id is derived from the request IP (same machine → same UUID).
    device_id is what the API uses for new generations (browser header or machine id).
    """
    scope = gallery_device_scope(request)
    return {
        "device_id": scope.primary,
        "machine_device_id": ip_derived_device_id(request),
        "browser_device_id": normalise_device_id(request.headers.get("x-hm-device-id")),
        "loopback": scope.loopback,
        "gallery_scope_ids": list(scope.query_ids),
    }


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok" if state.gallery is not None else "loading",
        "encoder": state.encoder_name,
        "gallery_size": len(state.gallery.labels) if state.gallery else 0,
        "classes": state.gallery.classes if state.gallery else [],
        "boot_seconds": round(state.boot_seconds, 3),
        "detector": {
            "model": RING_DETECTOR_ID,
            "loaded": state.detector_model is not None,
            "boot_seconds": round(state.detector_boot_seconds, 3)
            if state.detector_boot_seconds
            else None,
        },
        "analyser": attribute_extractor.status(),
        "design_generation": _design_engine_status(),
    }


@app.post("/api/analyse")
async def analyse(image: UploadFile = File(...)) -> dict:
    """
    Zero-shot ring attribute extraction with SigLIP on the uploaded photograph.

    The frontend sends the same detected ring crop used for /api/identify (hand
    crop when detection applied, otherwise the original upload). Attributes
    are read from the customer's ring — not from a catalogue reference image.

    Returns:
        {
          "attributes": [
            {"key": "metal", "title": "Metal", "top": "Yellow gold",
             "candidates": [{label, score}, ...]},
            ...
          ],
          "latency_ms": int,
          "model": str,
          "device": "mps" | "cpu",
          "prompt_count": int,
        }
    """
    contents = await image.read()
    if not contents:
        raise HTTPException(400, "Empty file")
    try:
        pil = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(400, f"Could not decode image: {e}")

    results, latency_ms = attribute_extractor.extract(pil)
    return {
        "attributes": attribute_extractor.to_jsonable(results),
        "latency_ms": latency_ms,
        **attribute_extractor.metadata(),
    }


@app.post("/api/identify")
async def identify(
    image: UploadFile = File(...),
    threshold: float = Form(DEFAULT_THRESHOLD),
    top_k: int = Form(DEFAULT_TOP_K),
) -> dict:
    """
    Identify a ring from an uploaded image.

    The operator controls two parameters live from the studio UI:
      * `threshold`  — cosine-similarity cutoff for a "confident" match
                       (clamped to [0.0, 1.0]).
      * `top_k`      — number of nearest gallery neighbours to surface in
                       the shortlist (clamped to [1, MAX_TOP_K]).

    The endpoint returns only threshold-qualified catalogue neighbours in the
    public shortlist. A raw best class is still reported for diagnostics, but
    `ring_id`, `top_k`, and `class_scores` represent accepted matches only.

    Response shape:
        {
          "ring_id":          str | None,   # set only when above threshold (back-compat)
          "predicted_class":  str,          # top accepted class, or raw best class if none pass
          "confidence":       float,        # mean cosine similarity for predicted_class
          "is_confident":     bool,         # confidence >= threshold
          "threshold":        float,        # threshold actually applied
          "top_k_requested":  int,          # k actually used after clamping
          "top_k": [                        # ranked neighbours with similarity >= threshold
            {"label": str, "similarity": float, "source_path": str},
            ...
          ],
          "class_scores": [                 # per-class mean over accepted top-k, sorted desc
            {"label": str, "mean_similarity": float, "count": int},
            ...
          ],
          "latency_ms": int,
        }
    """
    if state.gallery is None or state.model is None:
        raise HTTPException(503, "Model not loaded yet")

    threshold = max(MIN_THRESHOLD, min(MAX_THRESHOLD, float(threshold)))
    k = max(MIN_TOP_K, min(MAX_TOP_K, int(top_k)))
    k = min(k, len(state.gallery.labels))

    contents = await image.read()
    if not contents:
        raise HTTPException(400, "Empty file")

    try:
        pil = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(400, f"Could not decode image: {e}")

    t0 = time.perf_counter()
    query_vec = prototype.embed_image(pil, state.model, state.preprocess)

    # Run the similarity search ourselves so the response can include
    # per-class aggregates instead of just the winner. We deliberately do
    # NOT call prototype.predict — its threshold-based "unknown" semantics
    # are exactly what this endpoint replaces.
    gallery = state.gallery
    sims = gallery.embeddings @ query_vec  # shape (N,)
    n = len(sims)
    top_indices = np.argpartition(-sims, kth=min(k, n - 1))[:k]
    top_indices = top_indices[np.argsort(-sims[top_indices])]

    top_results = [
        (gallery.labels[i], float(sims[i]), gallery.paths[i])
        for i in top_indices
    ]

    raw_by_class: dict[str, list[float]] = defaultdict(list)
    for label, sim, _ in top_results:
        raw_by_class[label].append(sim)

    raw_class_scores = sorted(
        (
            {
                "label": label,
                "mean_similarity": round(float(np.mean(s)), 4),
                "count": len(s),
            }
            for label, s in raw_by_class.items()
        ),
        key=lambda d: d["mean_similarity"],
        reverse=True,
    )

    # The operator threshold is an acceptance gate for the public shortlist:
    # no reference photo or aggregate design appears unless its similarity
    # evidence passes the current threshold.
    accepted_results = [
        (label, sim, path)
        for label, sim, path in top_results
        if sim >= threshold
    ]

    by_class: dict[str, list[float]] = defaultdict(list)
    for label, sim, _ in accepted_results:
        by_class[label].append(sim)

    class_scores = sorted(
        (
            {
                "label": label,
                "mean_similarity": round(float(np.mean(s)), 4),
                "count": len(s),
            }
            for label, s in by_class.items()
        ),
        key=lambda d: d["mean_similarity"],
        reverse=True,
    )

    if class_scores:
        predicted_class = class_scores[0]["label"]
        confidence = class_scores[0]["mean_similarity"]
        is_confident = True
    else:
        # Diagnostics only: preserve the raw closest class/score so technical
        # panels can explain why nothing was accepted, without surfacing the
        # image as a catalogue match.
        predicted_class = raw_class_scores[0]["label"]
        confidence = raw_class_scores[0]["mean_similarity"]
        is_confident = False

    latency_ms = int((time.perf_counter() - t0) * 1000)

    return {
        # Back-compat: legacy consumers (Streamlit, CLI integrations) keep
        # the "ring_id is None == unknown" semantics. New consumers should
        # use `predicted_class` + `is_confident`.
        "ring_id": predicted_class if is_confident else None,
        "predicted_class": predicted_class,
        "confidence": confidence,
        "is_confident": is_confident,
        "threshold": threshold,
        "top_k_requested": k,
        "top_k": [
            {"label": label, "similarity": round(sim, 4), "source_path": str(path)}
            for label, sim, path in accepted_results
        ],
        "class_scores": class_scores,
        "latency_ms": latency_ms,
    }


_ALLOWED_IMAGE_ROOTS = (
    (PROJECT_ROOT / "data" / "reference").resolve(),
    (PROJECT_ROOT / "data" / "test").resolve(),
)


@app.get("/api/reference-image")
def reference_image(path: str) -> FileResponse:
    """
    Serve a reference / test image by relative path.

    Frontend gets paths like 'data/reference/WAM5-Y/WAM5-Y_000041.png' from
    /api/identify and renders them as <img src=".../api/reference-image?path=...">.

    Security: resolved path MUST live inside data/reference or data/test.
    Anything else (including '..' traversal) is rejected with 404.
    """
    # Treat the input as relative to the project root; normalise + resolve once.
    try:
        candidate = (PROJECT_ROOT / path).resolve()
    except (OSError, ValueError):
        raise HTTPException(404, "Not found")

    if not any(_is_within(candidate, root) for root in _ALLOWED_IMAGE_ROOTS):
        raise HTTPException(404, "Not found")

    if not candidate.is_file():
        raise HTTPException(404, "Not found")

    return FileResponse(candidate, media_type=_guess_media_type(candidate))


def _is_within(child: Path, parent: Path) -> bool:
    """True if `child` is `parent` or a descendant of it."""
    try:
        child.relative_to(parent)
    except ValueError:
        return False
    return True


def _guess_media_type(p: Path) -> str:
    return {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
    }.get(p.suffix.lower(), "application/octet-stream")


@app.post("/api/detect-ring")
async def detect_ring(image: UploadFile = File(...)) -> dict:
    """
    Detect ring regions with local GroundingDINO open-vocabulary detection.

    This is the single detector path for the demo: no Roboflow dependency and
    no local heuristic guessing. GroundingDINO proposes boxes for the prompt
    "wedding ring / jewellery ring / ring on finger"; we reject full-frame
    boxes, preserve whole product-shot boxes, and apply NMS.

    Response (200):
        {
          "candidates": [
            {
              "bbox": [x, y, w, h],      // top-left coords, source pixels
              "confidence": float,        // 0..1 from GroundingDINO
              "class_label": "ring"
            }, ...
          ],
          "image_width": int,
          "image_height": int,
          "model": str,
          "latency_ms": int,
          "source": "groundingdino"
        }
    """
    contents = await image.read()
    if not contents:
        raise HTTPException(400, "Empty file")

    try:
        pil = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(400, f"Could not decode image: {e}")

    img_w, img_h = pil.size
    t0 = time.perf_counter()
    try:
        _load_detector_once()
        processor = state.detector_processor
        detector_model = state.detector_model
        inputs = processor(images=pil, text=RING_DETECTOR_PROMPT, return_tensors="pt")
        with torch.no_grad():
            outputs = detector_model(**inputs)
        detections = processor.post_process_grounded_object_detection(
            outputs,
            inputs.input_ids,
            threshold=RING_DETECTOR_THRESHOLD,
            text_threshold=RING_DETECTOR_TEXT_THRESHOLD,
            target_sizes=[(img_h, img_w)],
        )[0]
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={"source": "groundingdino_unavailable", "reason": e.__class__.__name__},
        )

    candidates: list[dict] = []
    for score, box in zip(detections["scores"], detections["boxes"]):
        x1, y1, x2, y2 = [float(v) for v in box]
        w = max(0.0, x2 - x1)
        h = max(0.0, y2 - y1)
        if w < 8 or h < 8:
            continue
        area_ratio = (w * h) / max(1, img_w * img_h)
        if (
            area_ratio > RING_DETECTOR_MAX_AREA_RATIO
            or area_ratio >= RING_DETECTOR_FULL_FRAME_AREA_RATIO
        ):
            continue
        candidates.append({
            "bbox": [round(x1, 1), round(y1, 1), round(w, 1), round(h, 1)],
            "confidence": round(float(score), 4),
            "class_label": "ring",
        })
    candidates = _nms(candidates, RING_DETECTOR_NMS_IOU)[:RING_DETECTOR_MAX_DETECTIONS]

    return {
        "candidates": candidates,
        "image_width": img_w,
        "image_height": img_h,
        "model": RING_DETECTOR_ID,
        "latency_ms": int((time.perf_counter() - t0) * 1000),
        "source": "groundingdino",
    }


def _nms(candidates: list[dict], threshold: float) -> list[dict]:
    kept: list[dict] = []
    for cand in sorted(candidates, key=lambda c: c["confidence"], reverse=True):
        if all(_iou(cand["bbox"], prev["bbox"]) < threshold for prev in kept):
            kept.append(cand)
    return kept


def _iou(a: list[float], b: list[float]) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ax2, ay2 = ax + aw, ay + ah
    bx2, by2 = bx + bw, by + bh
    ix1, iy1 = max(ax, bx), max(ay, by)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    union = aw * ah + bw * bh - inter
    return inter / union if union > 0 else 0.0


@app.get("/api/sample-image/{class_name}")
def sample_image(class_name: str) -> dict:
    """
    Return a path to one reference image for the given class so the UI can
    render thumbnails for the top-k matches without exposing the whole
    filesystem.
    """
    if state.gallery is None:
        raise HTTPException(503, "Model not loaded yet")
    for label, path in zip(state.gallery.labels, state.gallery.paths):
        if label == class_name:
            return {"class_name": class_name, "path": path}
    raise HTTPException(404, f"Unknown class {class_name}")
