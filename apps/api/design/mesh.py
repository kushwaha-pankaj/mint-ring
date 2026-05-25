"""Research mesh generation via fal.ai (Rodin / Meshy / Tripo).

Default (DESIGN_MESH=auto): Hyper3D Rodin Gen-2 when the pack has angle
references, otherwise Meshy v6 from the hero. See:
https://fal.ai/models/fal-ai/hyper3d/rodin/v2/api

Rodin accepts up to 5 images. We send the hero first for material generation,
then available cardinal turntable views for shape coverage.

Best-effort: mesh failures do not fail the whole job.
"""
from __future__ import annotations

import asyncio
import hashlib
import os
from typing import Any, Literal

from .engine import EngineError, FalSchnellEngine, load_design_env
from .fast_mode import mesh_auto_uses_fast_provider

MESH_FILENAME = "research_mesh.glb"

# Turntable degrees used for Meshy v5 multi (front, side, back, other side).
MESHY_CARDINAL_DEGREES = (0, 90, 180, 270)

MeshProvider = Literal[
    "rodin",
    "meshy-multi",
    "meshy-v6",
    "tripo-multiview",
    "tripo-v25",
    "triposr",
]

RODIN = "fal-ai/hyper3d/rodin/v2"
MESHY_V6 = "fal-ai/meshy/v6/image-to-3d"
MESHY_MULTI = "fal-ai/meshy/v5/multi-image-to-3d"
TRIPO_IMAGE = "tripo3d/tripo/v2.5/image-to-3d"
TRIPO_MULTIVIEW = "tripo3d/tripo/v2.5/multiview-to-3d"
TRIPOSR = "fal-ai/triposr"

_LEGACY_ON = frozenset({"on", "fal", "1", "true", "yes"})
_VALID_PROVIDERS = frozenset(
    {
        "rodin",
        "hyper3d",
        "hyper3d-rodin",
        "rodin-gen2",
        "meshy-multi",
        "meshy-v6",
        "tripo-multiview",
        "tripo-v25",
        "triposr",
        "auto",
    }
)

_MESHY_QUALITY: dict[str, Any] = {
    "topology": "triangle",
    "target_polycount": 100_000,
    "symmetry_mode": "off",
    "should_remesh": True,
    "should_texture": True,
    "enable_pbr": True,
}

_MESHY_FAST: dict[str, Any] = {
    "topology": "triangle",
    "target_polycount": 20_000,
    "symmetry_mode": "auto",
    "should_remesh": False,
    "should_texture": True,
    "enable_pbr": False,
}

_DEFAULT_TEXTURE_PROMPT = (
    "fine jewellery ring, polished precious metal, clear faceted gemstone, "
    "studio product photography, soft highlights, neutral background, photorealistic. "
    "Match the reference images exactly — same design, proportions, and materials."
)


class _MeshFal(FalSchnellEngine):
    """fal client with a longer queue poll for 3D jobs (Meshy can take several minutes)."""

    def __init__(self, *, max_polls: int = 360) -> None:
        super().__init__()
        self._max_polls = max_polls

    async def _poll(self, status_url: str, response_url: str) -> dict:
        delay = 1.0
        for _ in range(self._max_polls):
            try:
                s = await self._client.get(status_url)
            except Exception as e:
                raise EngineError(
                    code="fal_network",
                    message=f"fal.ai poll network error: {e.__class__.__name__}",
                )
            if s.status_code >= 400:
                raise EngineError(
                    code=f"fal_poll_{s.status_code}",
                    message=f"fal.ai status returned HTTP {s.status_code}",
                )
            data = s.json()
            status = data.get("status")
            if status == "COMPLETED":
                r = await self._client.get(response_url)
                if r.status_code >= 400:
                    raise EngineError(
                        code=f"fal_response_{r.status_code}",
                        message=f"fal.ai response returned HTTP {r.status_code}",
                    )
                return r.json()
            if status in ("FAILED", "CANCELLED"):
                raise EngineError(
                    code="fal_failed",
                    message=f"fal.ai job reported status {status}",
                )
            await asyncio.sleep(delay)
            delay = min(3.0, delay * 1.15)
        mins = max(1, int(self._max_polls * 2 / 60))
        raise EngineError(
            code="fal_timeout",
            message=f"3D mesh job did not complete within the timeout window (~{mins} min).",
        )


def mesh_stage_enabled() -> bool:
    load_design_env()
    flag = (os.environ.get("DESIGN_MESH") or "auto").strip().lower()
    if flag in ("off", "0", "false", "no"):
        return False
    if not (os.environ.get("FAL_KEY") or os.environ.get("FAL_API_KEY")):
        return False
    if flag == "auto":
        engine = (os.environ.get("DESIGN_ENGINE") or "").strip().lower()
        return engine.startswith("fal") or bool(os.environ.get("FAL_KEY"))
    return flag in _VALID_PROVIDERS or flag in _LEGACY_ON


def texture_prompt_for_pack(*, design_prompt: str | None = None) -> str:
    """Short PBR texture hint aligned with the pack's FLUX hero prompt."""
    if design_prompt and design_prompt.strip():
        base = design_prompt.strip()[:360]
        return f"{base}. Match the multi-view reference photos exactly."
    return _DEFAULT_TEXTURE_PROMPT


def _image_digest(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


def meshy_cardinal_bytes(
    hero_bytes: bytes, angles_by_degree: dict[int, bytes]
) -> list[bytes]:
    """Four turntable views for Meshy v5: 0°, 90°, 180°, 270° (0° from angles or hero)."""
    views: list[bytes] = []
    for deg in MESHY_CARDINAL_DEGREES:
        if deg in angles_by_degree:
            views.append(angles_by_degree[deg])
        elif deg == 0:
            views.append(hero_bytes)
        else:
            return []
    return views if len(views) == 4 else []


def count_cardinal_views(hero_bytes: bytes, angles_by_degree: dict[int, bytes]) -> int:
    return len(meshy_cardinal_bytes(hero_bytes, angles_by_degree))


def count_distinct_views(hero_bytes: bytes, angles_by_degree: dict[int, bytes]) -> int:
    """Distinct bytes among cardinal views (detect duplicate turntable frames)."""
    views = meshy_cardinal_bytes(hero_bytes, angles_by_degree)
    if len(views) < 4:
        return len(views)
    seen: set[str] = set()
    for data in views:
        seen.add(_image_digest(data))
    return len(seen)


def resolve_provider(
    *,
    angles_in_pack: bool,
    angle_count: int,
    cardinal_view_count: int,
    distinct_cardinal_count: int,
) -> MeshProvider:
    """Pick provider from DESIGN_MESH and what the pack produced."""
    load_design_env()
    flag = (os.environ.get("DESIGN_MESH") or "auto").strip().lower()
    if flag in _LEGACY_ON:
        flag = "meshy-multi"
    if flag in ("hyper3d", "hyper3d-rodin", "rodin-gen2"):
        flag = "rodin"
    if flag == "auto":
        if mesh_auto_uses_fast_provider():
            return "triposr"
        if (
            angles_in_pack
            and cardinal_view_count == 4
            and distinct_cardinal_count >= 3
        ):
            return "rodin"
        return "meshy-v6"
    if flag not in _VALID_PROVIDERS:
        return "meshy-v6"
    if flag == "meshy-multi" and cardinal_view_count < 4:
        return "meshy-v6"
    if flag == "tripo-multiview" and cardinal_view_count < 2:
        return "tripo-v25"
    return flag  # type: ignore[return-value]


def provider_label(provider: MeshProvider) -> str:
    labels = {
        "rodin": "Hyper3D Rodin Gen-2 3D",
        "meshy-multi": "Meshy v5 multi-image 3D",
        "meshy-v6": "Meshy v6 3D",
        "tripo-multiview": "Tripo multiview 3D",
        "tripo-v25": "Tripo v2.5 3D",
        "triposr": "Fast 3D preview (TripoSR)",
    }
    return labels.get(provider, "Research 3D mesh")


def _pick_multiview_bytes(hero_bytes: bytes, angles_by_degree: dict[int, bytes]) -> list[bytes]:
    """Tripo multiview fallback — hero front plus orthogonal turns."""
    seen: set[str] = set()
    views: list[bytes] = []

    def add(data: bytes) -> None:
        sig = _image_digest(data)
        if sig in seen:
            return
        seen.add(sig)
        views.append(data)

    add(hero_bytes)
    for deg in (90, 180, 270):
        if deg in angles_by_degree:
            add(angles_by_degree[deg])
        if len(views) >= 4:
            break
    return views if views else [hero_bytes]


def _pick_rodin_bytes(hero_bytes: bytes, angles_by_degree: dict[int, bytes]) -> list[bytes]:
    """Rodin Gen-2 accepts up to 5 images; first image drives material generation."""
    seen: set[str] = set()
    views: list[bytes] = []

    def add(data: bytes) -> None:
        sig = _image_digest(data)
        if sig in seen:
            return
        seen.add(sig)
        views.append(data)

    add(hero_bytes)
    for deg in MESHY_CARDINAL_DEGREES:
        if deg in angles_by_degree:
            add(angles_by_degree[deg])
        if len(views) >= 5:
            break
    return views


def _effective_provider(
    provider: MeshProvider,
    hero_bytes: bytes,
    angles_by_degree: dict[int, bytes],
) -> MeshProvider:
    """Downgrade multi-view providers when cardinal turntable views are incomplete."""
    cardinal = count_cardinal_views(hero_bytes, angles_by_degree)
    distinct = count_distinct_views(hero_bytes, angles_by_degree)
    if provider == "meshy-multi":
        if cardinal < 4:
            return "meshy-v6"
        if distinct < 3:
            return "meshy-v6"
    if provider == "tripo-multiview" and cardinal < 2:
        return "tripo-v25"
    return provider


def _glb_url_from_body(body: dict) -> str | None:
    for key in ("pbr_model", "model_glb", "model_mesh"):
        item = body.get(key)
        if isinstance(item, dict) and item.get("url"):
            return str(item["url"])
    urls = body.get("model_urls")
    if isinstance(urls, dict):
        glb = urls.get("glb")
        if isinstance(glb, dict) and glb.get("url"):
            return str(glb["url"])
    return None


def _meshy_quality_block() -> dict[str, Any]:
    load_design_env()
    flag = (os.environ.get("DESIGN_MESH") or "auto").strip().lower()
    if flag == "triposr":
        return dict(_MESHY_FAST)
    return dict(_MESHY_QUALITY)


def _meshy_payload(
    *,
    hero_url: str,
    texture_prompt: str,
    image_urls: list[str] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        **_meshy_quality_block(),
        "texture_image_url": hero_url,
        "texture_prompt": texture_prompt,
    }
    if image_urls is not None:
        payload["image_urls"] = image_urls
    else:
        payload["image_url"] = hero_url
    return payload


async def build_pack_glb(
    hero_bytes: bytes,
    angles_by_degree: dict[int, bytes],
    *,
    provider: MeshProvider,
    texture_prompt: str | None = None,
) -> bytes:
    """Generate a textured GLB for the design pack."""
    load_design_env()
    provider = _effective_provider(provider, hero_bytes, angles_by_degree)
    prompt = texture_prompt or _DEFAULT_TEXTURE_PROMPT
    max_polls = 90 if provider == "triposr" else 360
    client = _MeshFal(max_polls=max_polls)
    try:
        hero_url = client._data_url(hero_bytes)
        if provider == "meshy-multi":
            cardinal = meshy_cardinal_bytes(hero_bytes, angles_by_degree)
            if len(cardinal) != 4:
                raise EngineError(
                    code="mesh_cardinal_incomplete",
                    message=(
                        "Meshy v5 multi-image needs 0°, 90°, 180°, and 270° turntable views."
                    ),
                )
            urls = [client._data_url(b) for b in cardinal]
            payload = _meshy_payload(
                hero_url=hero_url,
                texture_prompt=prompt,
                image_urls=urls,
            )
            body = await client._submit(MESHY_MULTI, payload)
        elif provider == "meshy-v6":
            payload = _meshy_payload(hero_url=hero_url, texture_prompt=prompt)
            body = await client._submit(MESHY_V6, payload)
        elif provider == "tripo-multiview":
            views = _pick_multiview_bytes(hero_bytes, angles_by_degree)
            urls = [client._data_url(b) for b in views]
            front = urls[0]
            right = urls[1] if len(urls) > 1 else None
            back = urls[2] if len(urls) > 2 else None
            left = urls[3] if len(urls) > 3 else None
            payload: dict = {
                "front_image_url": front,
                "texture": "HD",
                "orientation": "align_image",
                "texture_alignment": "original_image",
            }
            if right:
                payload["right_image_url"] = right
            if back:
                payload["back_image_url"] = back
            if left:
                payload["left_image_url"] = left
            body = await client._submit(TRIPO_MULTIVIEW, payload)
        elif provider == "tripo-v25":
            payload = {
                "image_url": hero_url,
                "texture": "HD",
                "orientation": "align_image",
                "texture_alignment": "original_image",
            }
            body = await client._submit(TRIPO_IMAGE, payload)
        elif provider == "rodin":
            views = _pick_rodin_bytes(hero_bytes, angles_by_degree)
            payload = {
                "prompt": prompt,
                "input_image_urls": [client._data_url(b) for b in views],
                "geometry_file_format": "glb",
                "material": "All",
                "quality_mesh_option": "500K Triangle",
                "use_original_alpha": False,
            }
            body = await client._submit(RODIN, payload)
        else:
            mc = 192 if mesh_auto_uses_fast_provider() else 256
            payload = {
                "image_url": hero_url,
                "output_format": "glb",
                "do_remove_background": True,
                "foreground_ratio": 0.9,
                "mc_resolution": mc,
            }
            body = await client._submit(TRIPOSR, payload)

        url = _glb_url_from_body(body)
        if not url:
            raise EngineError(
                code="mesh_no_url",
                message=f"{provider} returned no GLB URL: {str(body)[:240]}",
            )
        try:
            resp = await client._client.get(url)
        except Exception as e:
            raise EngineError(
                code="mesh_fetch",
                message=f"Could not download GLB: {e.__class__.__name__}",
            )
        if resp.status_code >= 400:
            raise EngineError(
                code=f"mesh_fetch_{resp.status_code}",
                message=f"GLB download returned HTTP {resp.status_code}",
            )
        data = resp.content
        if len(data) < 16 or data[:4] != b"glTF":
            raise EngineError(
                code="mesh_invalid_glb",
                message="Downloaded file does not look like a GLB container.",
            )
        return data
    finally:
        await client.aclose()


async def hero_to_glb(hero_bytes: bytes) -> bytes:
    """Backward-compatible single-image entry (Meshy v6)."""
    return await build_pack_glb(hero_bytes, {}, provider="meshy-v6")
