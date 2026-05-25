"""FastAPI router for /api/tryon/*.

Architecture: **multi-image FLUX Kontext composition**, not 2D compositing.

We send TWO images to FLUX.1 Kontext Pro Multi (fal-ai/flux-pro/kontext/multi):
  image_urls[0] = the user's hand photo
  image_urls[1] = the photoreal ring product render from /design

FLUX places the exact ring design from image 2 onto the ring finger of the
hand in image 1, with correct perspective, sizing, and shadow. This is the
production-grade approach used by jewelry try-on systems (GlamTry, etc.);
naive 2D paste-and-refine cannot reproduce the band-wraps-the-finger
geometry because the input ring is a top-down product photo.

MediaPipe still runs in the browser, but only as a *placement hint* the
user can confirm or drag — the final render is FLUX-native, not a canvas
composite.

Endpoints:
  GET  /api/tryon/health                capability + engine introspection
  POST /api/tryon/generate              hand photo + ring asset -> Kontext Multi
  GET  /api/tryon/renders/{filename}    serve a rendered try-on (path-guarded)
"""
from __future__ import annotations

import io
import time
import uuid
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from PIL import Image

from ..design.engine import Engine, EngineError
from ..history import store as history_store
from ..history.device import device_id_from_request
from ..design.storage import (
    PACKS_DIR,
    UPLOADS_DIR,
    is_within,
)
from .storage import (
    TRYON_DIR,
    ensure_dirs,
    save_render,
)


# Inbound size caps. Hand photo: 12 MB (~modern phone snap). Ring asset on
# disk has no separate cap — we always control that path.
MAX_UPLOAD_BYTES = 12 * 1024 * 1024
# Longer edge keeps skin texture and depth in the reference sent to FLUX.
MAX_EDGE = 1280


# Prompt engineering note:
#   - "image 1" / "image 2" — FLUX Kontext multi resolves these positional
#     references reliably (mirrors the documented duckling/t-shirt example).
#   - Hand identity must be repeated explicitly; Kontext otherwise smooths
#     skin and swaps to a generic hand model.
#   - Avoid "editorial" / "beauty" phrasing — it encourages skin retouching.
#   - Lower guidance_scale on the API call (see generate()) reduces drift.
TRYON_PROMPT = (
    "Place the ring from image 2 onto the hand in image 1 only. "
    "The output hand must be the exact same hand as image 1: identical skin "
    "texture, wrinkles, pores, fine lines, veins, nail details, skin tone, "
    "finger shape, pose, lighting, shadows, depth of field, photographic "
    "grain, and background. Do not smooth, beautify, retouch, or replace the "
    "hand. Do not use a different hand. "
    "Seat the ring on the ring finger (fourth finger, between middle and "
    "pinky), on the proximal phalanx between the base knuckle and first "
    "joint. Match image 2 exactly for metal colour, stone shape and colour, "
    "setting, band style, and proportions. Size for the finger width with "
    "correct perspective, a soft natural shadow on the finger, and specular "
    "highlights that follow the light direction already in image 1. "
    "Do not add other rings. Do not change any other finger. "
    "Natural unretouched photograph, sharp focus on the ring and real skin."
)

# Lower CFG keeps Kontext closer to the reference pixels (less hand swap).
TRYON_GUIDANCE_SCALE = 2.4


def build_router(engine_provider) -> APIRouter:
    """`engine_provider` is a zero-arg callable returning the shared Engine.

    Same pattern as the design router — main.py owns the engine lifecycle.
    """
    router = APIRouter(prefix="/api/tryon", tags=["tryon"])

    @router.get("/health")
    def health() -> dict:
        engine = _safe_engine(engine_provider)
        # Try-on requires Kontext Multi specifically — the standard edit
        # method only takes one image and can't do try-on at all.
        supports_multi = hasattr(engine, "multi_edit") if engine is not None else False
        return {
            "status": "ok",
            "engine": engine.name if engine is not None else None,
            "supports_multi_edit": supports_multi,
            "max_edge_px": MAX_EDGE,
            "max_upload_bytes": MAX_UPLOAD_BYTES,
        }

    @router.post("/generate")
    async def generate(
        request: Request,
        hand_image: UploadFile = File(..., description="The user's hand photo"),
        ring_image_url: str = Form(
            ...,
            description=(
                "URL of the ring asset to wear. Must point at our own asset "
                "endpoints (/api/design/assets/... or /api/tryon/renders/...) "
                "so the server can read the file directly from disk."
            ),
        ),
        seed: int = Form(0, description="0 = derive from upload bytes"),
    ) -> dict:
        """Run FLUX Kontext Multi with [hand, ring] and return the result."""
        engine = engine_provider()
        if engine is None:
            raise HTTPException(503, "Try-on engine not configured (set DESIGN_ENGINE=fal).")
        multi_edit = getattr(engine, "multi_edit", None)
        if multi_edit is None:
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "tryon_engine_unsupported",
                    "message": (
                        f"Engine '{engine.name}' does not support multi-image edit. "
                        "Try-on requires FLUX Kontext. Set DESIGN_ENGINE=fal."
                    ),
                },
            )

        hand_bytes_raw = await hand_image.read()
        if not hand_bytes_raw:
            raise HTTPException(400, "Empty hand image")
        if len(hand_bytes_raw) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                413,
                f"Hand image too large ({MAX_UPLOAD_BYTES // (1024 * 1024)} MB max)",
            )

        try:
            hand_pil = Image.open(io.BytesIO(hand_bytes_raw)).convert("RGB")
        except Exception:
            raise HTTPException(400, "Hand image is not a valid image")

        # Resolve the ring URL to a file on our own disk. This is both a
        # bandwidth optimisation (avoids re-uploading bytes the server
        # already has) AND a security boundary (we don't fetch arbitrary
        # URLs the client supplies — that would be SSRF).
        ring_path = _resolve_internal_asset(ring_image_url)
        if not ring_path or not ring_path.is_file():
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "ring_asset_not_found",
                    "message": (
                        "ring_image_url must point at /api/design/assets/<job>/<file> "
                        "or /api/tryon/renders/<file> on this server."
                    ),
                },
            )

        try:
            ring_pil = Image.open(ring_path).convert("RGB")
        except Exception:
            raise HTTPException(400, "Ring asset on disk could not be decoded")

        # Prepare both images: same downscale and jpeg-encode pass so we
        # send identical, small payloads to fal.
        hand_bytes, (out_w, out_h) = _prepare_for_engine(hand_pil)
        ring_bytes, _ = _prepare_for_engine(ring_pil)

        effective_seed = seed if seed > 0 else _seed_from_bytes(hand_bytes_raw)

        try:
            t0 = time.perf_counter()
            result = await multi_edit(
                TRYON_PROMPT,
                [hand_bytes, ring_bytes],
                seed=effective_seed,
                size=(out_w, out_h),
                guidance_scale=TRYON_GUIDANCE_SCALE,
                enhance_prompt=False,
            )
            latency_ms = int((time.perf_counter() - t0) * 1000)
        except EngineError as e:
            raise HTTPException(
                status_code=502,
                detail={"code": e.code, "message": e.message},
            )

        ensure_dirs()
        render_id = uuid.uuid4().hex
        save_render(render_id, result.image_bytes)

        # Kontext Multi may return at a different aspect than requested
        # (it follows the first reference image, not image_size). Decode
        # the actual bytes so the response reports the real dimensions.
        try:
            with Image.open(io.BytesIO(result.image_bytes)) as out:
                real_w, real_h = out.size
        except Exception:
            real_w, real_h = out_w, out_h

        render_url = f"/api/tryon/renders/{render_id}.jpg"
        device_id = device_id_from_request(request)
        history_store.insert_tryon(
            device_id,
            render_id=render_id,
            ring_image_url=ring_image_url,
            preview_url=render_url,
        )

        return {
            "render_id": render_id,
            "url": render_url,
            "engine": engine.name,
            "seed": effective_seed,
            "latency_ms": latency_ms,
            "image_size": {"width": real_w, "height": real_h},
        }

    @router.get("/renders/{filename}")
    def get_render(filename: str) -> FileResponse:
        safe_file = Path(filename).name
        if safe_file != filename:
            raise HTTPException(404, "Not found")
        target = (TRYON_DIR / safe_file).resolve()
        if not is_within(target, TRYON_DIR):
            raise HTTPException(404, "Not found")
        if not target.is_file():
            raise HTTPException(404, "Not found")
        return FileResponse(target, media_type="image/jpeg")

    return router


# ---------- helpers --------------------------------------------------

def _prepare_for_engine(pil: Image.Image) -> tuple[bytes, tuple[int, int]]:
    """Downscale longest edge to MAX_EDGE, round to multiple of 8, JPEG q92."""
    w, h = pil.size
    longest = max(w, h)
    if longest > MAX_EDGE:
        scale = MAX_EDGE / longest
        new_size = (max(1, int(round(w * scale))), max(1, int(round(h * scale))))
        pil = pil.resize(new_size, Image.LANCZOS)

    w2, h2 = pil.size
    w2 -= w2 % 8
    h2 -= h2 % 8
    if (w2, h2) != pil.size:
        pil = pil.resize((w2, h2), Image.LANCZOS)

    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=95)
    return buf.getvalue(), pil.size


def _seed_from_bytes(data: bytes) -> int:
    h = 0
    for i in range(0, min(len(data), 4096), 31):
        h = (h * 33 + data[i]) & 0xFFFFFFFF
    return h or 1


def _safe_engine(engine_provider) -> Engine | None:
    try:
        return engine_provider()
    except EngineError:
        return None


def _resolve_internal_asset(url: str) -> Path | None:
    """Map a client-supplied URL to a local file path on our storage tree.

    Accepts:
      /api/design/assets/{job_id}/{filename}  ->  PACKS_DIR/{job_id}/{filename}
      /api/tryon/renders/{filename}           ->  TRYON_DIR/{filename}
      /api/design/uploads/{upload_id}/{file}  ->  UPLOADS_DIR/{upload_id}/{file}

    Anything else (absolute URLs, foreign hosts, traversal) returns None.
    The is_within guard at the end is the actual security boundary; the
    string prefix matching is only for routing.
    """
    if not url or not isinstance(url, str):
        return None
    # Allow absolute http(s) URLs that point at our own host by stripping
    # scheme+netloc. The frontend may pass either form depending on env.
    parsed = urlsplit(url)
    path = parsed.path or url
    if not path.startswith("/"):
        return None

    parts = [p for p in path.split("/") if p]
    if len(parts) < 4:
        return None
    if parts[0] != "api":
        return None

    # /api/design/assets/{job_id}/{filename}
    if parts[1] == "design" and parts[2] == "assets" and len(parts) >= 5:
        job_id = Path(parts[3]).name
        filename = Path(parts[4]).name
        if job_id != parts[3] or filename != parts[4]:
            return None
        candidate = (PACKS_DIR / job_id / filename).resolve()
        if is_within(candidate, PACKS_DIR):
            return candidate
        return None

    # /api/tryon/renders/{filename}
    if parts[1] == "tryon" and parts[2] == "renders" and len(parts) >= 4:
        filename = Path(parts[3]).name
        if filename != parts[3]:
            return None
        candidate = (TRYON_DIR / filename).resolve()
        if is_within(candidate, TRYON_DIR):
            return candidate
        return None

    # /api/design/uploads/{upload_id}/{filename}
    if parts[1] == "design" and parts[2] == "uploads" and len(parts) >= 5:
        upload_id = Path(parts[3]).name
        filename = Path(parts[4]).name
        if upload_id != parts[3] or filename != parts[4]:
            return None
        candidate = (UPLOADS_DIR / upload_id / filename).resolve()
        if is_within(candidate, UPLOADS_DIR):
            return candidate
        return None

    return None


__all__ = ["build_router"]
