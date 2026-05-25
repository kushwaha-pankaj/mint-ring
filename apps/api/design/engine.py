"""Image generation engines for /api/design.

Engines:
  pollinations  free public FLUX endpoint, slow, no auth, text-to-image only
  fal-schnell   fal.ai FLUX.1 [schnell], $0.003/MP, text-to-image + img2img
  fal-kontext   fal.ai FLUX.1 Kontext [pro], $0.04/image, edit-from-reference

Set DESIGN_ENGINE to choose. fal engines require FAL_KEY. When the demo runs
in offline mode the Pollinations engine remains as a deliberate fallback so a
missing key never breaks the page.
"""
from __future__ import annotations

import asyncio
import base64
import os
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol
from urllib.parse import quote

import httpx


_FALLBACK_RENDER = (
    Path(__file__).resolve().parents[2]
    / "web"
    / "public"
    / "design"
    / "pack"
    / "sapphire-render.jpg"
)

_ENV_LOADED = False


def load_design_env() -> None:
    """Load local design generation env vars for uvicorn/dev runs.

    The repo's launcher does not pass python-dotenv, so a plain uvicorn
    process otherwise ignores apps/api/.env and falls back to Pollinations.
    """
    global _ENV_LOADED
    if _ENV_LOADED:
        return
    _ENV_LOADED = True
    api_dir = Path(__file__).resolve().parent.parent
    for env_path in (api_dir / ".env", api_dir / ".env.example"):
        if not env_path.is_file():
            continue
        for raw_line in env_path.read_text().splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            if key not in {
                "DESIGN_ENGINE",
                "DESIGN_MESH",
                "DESIGN_HERO",
                "DESIGN_ANGLES",
                "DESIGN_FAST",
                "POLLINATIONS_BASE",
                "FAL_KEY",
                "FAL_API_KEY",
            }:
                continue
            os.environ.setdefault(key, value.strip().strip('"').strip("'"))


class EngineError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class GenerationResult:
    image_bytes: bytes
    seed: int


class Engine(Protocol):
    """Capability-tagged engine.

    All engines implement text_to_image. Engines that can do img2img or
    instruction-edit set the corresponding boolean to True so the pipeline
    knows whether to call image_to_image or fall back to text-only.
    """

    name: str
    supports_img2img: bool
    supports_edit: bool
    supports_turntable: bool

    async def text_to_image(
        self,
        prompt: str,
        *,
        seed: int,
        size: tuple[int, int] = (1024, 1024),
    ) -> GenerationResult: ...

    async def image_to_image(
        self,
        prompt: str,
        reference_bytes: bytes,
        *,
        seed: int,
        strength: float = 0.6,
        size: tuple[int, int] = (1024, 1024),
    ) -> GenerationResult: ...

    async def edit(
        self,
        instruction: str,
        reference_bytes: bytes,
        *,
        seed: int,
        size: tuple[int, int] = (1024, 1024),
    ) -> GenerationResult: ...

    async def rotate_view(
        self,
        reference_bytes: bytes,
        *,
        horizontal_angle: float,
        seed: int,
        vertical_angle: float = 0.0,
    ) -> GenerationResult: ...


# ---------- Pollinations (free fallback) ----------------------------------

class PollinationsEngine:
    """Pollinations FLUX endpoint, free, no auth, GET-based."""

    name = "pollinations"
    supports_img2img = False
    supports_edit = False
    supports_turntable = False

    def __init__(self, base: str | None = None, model: str = "flux") -> None:
        self.base = (
            base
            or os.environ.get("POLLINATIONS_BASE")
            or "https://image.pollinations.ai/prompt"
        ).rstrip("/")
        self.model = model
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=15.0),
            follow_redirects=True,
            headers={"User-Agent": "BCU-Demo/1.0 (Hockley Mint AI Ring Studio)"},
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def text_to_image(
        self,
        prompt: str,
        *,
        seed: int,
        size: tuple[int, int] = (1024, 1024),
    ) -> GenerationResult:
        width, height = size
        url = (
            f"{self.base}/{quote(prompt, safe='')}"
            f"?model={self.model}&width={width}&height={height}"
            f"&seed={seed}&nologo=true&private=true&safe=true&enhance=true"
        )
        last_error: str | None = None
        for attempt in range(3):
            try:
                resp = await self._client.get(url)
            except httpx.RequestError as e:
                last_error = f"network error: {e.__class__.__name__}"
                await asyncio.sleep(1.5 * (attempt + 1))
                continue

            if resp.status_code == 200:
                content_type = resp.headers.get("content-type", "")
                if not content_type.startswith("image/"):
                    last_error = f"unexpected content-type {content_type}"
                    await asyncio.sleep(1.5 * (attempt + 1))
                    continue
                return GenerationResult(image_bytes=resp.content, seed=seed)

            if resp.status_code in (429, 500, 502, 503, 504):
                last_error = f"engine returned {resp.status_code}"
                await asyncio.sleep(2.0 * (attempt + 1))
                continue

            return self._fallback_image(seed)

        return self._fallback_image(seed)

    def _fallback_image(self, seed: int) -> GenerationResult:
        if not _FALLBACK_RENDER.is_file():
            raise EngineError(
                code="engine_unavailable",
                message="Pollinations failed and the local fallback render is missing.",
            )
        return GenerationResult(image_bytes=_FALLBACK_RENDER.read_bytes(), seed=seed)

    async def image_to_image(self, prompt, reference_bytes, *, seed, strength=0.6, size=(1024, 1024)):
        # Pollinations has no img2img endpoint, so we fall back to text-only.
        # The pipeline knows this via supports_img2img=False.
        return await self.text_to_image(prompt, seed=seed, size=size)

    async def edit(self, instruction, reference_bytes, *, seed, size=(1024, 1024)):
        return await self.text_to_image(instruction, seed=seed, size=size)

    async def rotate_view(
        self,
        reference_bytes: bytes,
        *,
        horizontal_angle: float,
        seed: int,
        vertical_angle: float = 0.0,
    ) -> GenerationResult:
        raise EngineError(
            code="turntable_unsupported",
            message="Pollinations cannot render turntable angle views.",
        )


# ---------- fal.ai shared helper ------------------------------------------

class _FalBase:
    """Common fal.ai HTTP client.

    fal.ai endpoints respond synchronously on POST /. The response JSON
    contains an `images` array with a `url` we then GET to fetch bytes.
    """

    QUEUE_BASE = "https://queue.fal.run"

    def __init__(self) -> None:
        key = os.environ.get("FAL_KEY") or os.environ.get("FAL_API_KEY")
        if not key:
            raise EngineError(
                code="fal_key_missing",
                message="FAL_KEY environment variable is required for fal.ai engines.",
            )
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(180.0, connect=15.0),
            headers={
                "Authorization": f"Key {key}",
                "Content-Type": "application/json",
                "User-Agent": "BCU-Demo/1.0 (Hockley Mint AI Ring Studio)",
            },
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _submit(self, endpoint: str, payload: dict) -> dict:
        """POST to the fal.ai queue, then poll until the result is ready."""
        url = f"{self.QUEUE_BASE}/{endpoint}"
        try:
            resp = await self._client.post(url, json=payload)
        except httpx.RequestError as e:
            raise EngineError(
                code="fal_network",
                message=f"fal.ai network error: {e.__class__.__name__}",
            )
        if resp.status_code == 401 or resp.status_code == 403:
            raise EngineError(
                code="fal_unauthorized",
                message=f"fal.ai rejected the API key (HTTP {resp.status_code}). Check FAL_KEY.",
            )
        if resp.status_code >= 400:
            raise EngineError(
                code=f"fal_{resp.status_code}",
                message=f"fal.ai returned HTTP {resp.status_code}: {resp.text[:200]}",
            )
        body = resp.json()
        # Queue mode: returns {request_id, status_url, response_url}. Poll until done.
        if "request_id" in body and "response_url" in body:
            return await self._poll(body["status_url"], body["response_url"])
        # Some endpoints return the result inline. Surface as-is.
        return body

    async def _poll(self, status_url: str, response_url: str) -> dict:
        delay = 0.4
        for _ in range(120):  # up to ~60s with backoff
            try:
                s = await self._client.get(status_url)
            except httpx.RequestError as e:
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
            delay = min(2.0, delay * 1.3)
        raise EngineError(
            code="fal_timeout",
            message="fal.ai job did not complete within the timeout window.",
        )

    async def _fetch_first_image(self, body: dict) -> bytes:
        images = body.get("images") or []
        if not images:
            raise EngineError(
                code="fal_no_image",
                message=f"fal.ai returned no images: {str(body)[:200]}",
            )
        item = images[0]
        url = item.get("url") if isinstance(item, dict) else None
        if not url:
            raise EngineError(
                code="fal_no_image_url",
                message="fal.ai response image is missing the url field.",
            )
        try:
            r = await self._client.get(url)
        except httpx.RequestError as e:
            raise EngineError(
                code="fal_image_fetch",
                message=f"Could not fetch generated image: {e.__class__.__name__}",
            )
        if r.status_code >= 400:
            raise EngineError(
                code=f"fal_image_fetch_{r.status_code}",
                message=f"Image fetch returned HTTP {r.status_code}",
            )
        return r.content

    @staticmethod
    def _data_url(reference_bytes: bytes, mime: str = "image/jpeg") -> str:
        b64 = base64.b64encode(reference_bytes).decode("ascii")
        return f"data:{mime};base64,{b64}"


# ---------- fal.ai FLUX Dev (quality hero) ---------------------------------

class FalFluxDevEngine(_FalBase):
    """FLUX.1 [dev] on fal.ai — higher fidelity than Schnell for hero product shots.

    Schnell (4 steps) is fast but often produces jagged metal and muddy fine detail
    on jewellery. Dev at 28 steps is the default hero engine for the studio.
    """

    name = "fal-flux-dev"
    supports_img2img = True
    supports_edit = False
    supports_turntable = False

    TXT2IMG_ENDPOINT = "fal-ai/flux/dev"
    IMG2IMG_ENDPOINT = "fal-ai/flux/dev/image-to-image"

    async def text_to_image(self, prompt, *, seed, size=(1024, 1024)):
        width, height = size
        payload = {
            "prompt": prompt,
            "image_size": {"width": width, "height": height},
            "num_inference_steps": 28,
            "guidance_scale": 4.0,
            "num_images": 1,
            "seed": seed,
            "enable_safety_checker": True,
            "output_format": "jpeg",
        }
        body = await self._submit(self.TXT2IMG_ENDPOINT, payload)
        return GenerationResult(
            image_bytes=await self._fetch_first_image(body), seed=seed
        )

    async def image_to_image(
        self, prompt, reference_bytes, *, seed, strength=0.6, size=(1024, 1024)
    ):
        width, height = size
        payload = {
            "prompt": prompt,
            "image_url": self._data_url(reference_bytes),
            "strength": float(strength),
            "image_size": {"width": width, "height": height},
            "num_inference_steps": 28,
            "guidance_scale": 3.5,
            "num_images": 1,
            "seed": seed,
            "enable_safety_checker": True,
            "output_format": "jpeg",
        }
        body = await self._submit(self.IMG2IMG_ENDPOINT, payload)
        return GenerationResult(
            image_bytes=await self._fetch_first_image(body), seed=seed
        )

    async def edit(self, instruction, reference_bytes, *, seed, size=(1024, 1024)):
        return await self.image_to_image(
            instruction, reference_bytes, seed=seed, strength=0.55, size=size
        )

    async def rotate_view(
        self,
        reference_bytes: bytes,
        *,
        horizontal_angle: float,
        seed: int,
        vertical_angle: float = 0.0,
    ) -> GenerationResult:
        raise EngineError(
            code="turntable_unsupported",
            message="FLUX Dev cannot render turntable angle views.",
        )


# ---------- fal.ai FLUX Schnell -------------------------------------------

class FalSchnellEngine(_FalBase):
    """FLUX.1 [schnell] on fal.ai, $0.003 per megapixel, sub-second on warm pool.

    Used for the hero (text-to-image) and sketch (image-to-image). Apache 2.0
    weights, commercial-safe.
    """

    name = "fal-schnell"
    supports_img2img = True
    supports_edit = False
    supports_turntable = False

    TXT2IMG_ENDPOINT = "fal-ai/flux/schnell"
    # Schnell has no prompt-driven img2img; FLUX dev image-to-image accepts prompt + strength.
    IMG2IMG_ENDPOINT = "fal-ai/flux/dev/image-to-image"

    async def text_to_image(self, prompt, *, seed, size=(1024, 1024)):
        width, height = size
        payload = {
            "prompt": prompt,
            "image_size": {"width": width, "height": height},
            "num_inference_steps": 4,
            "num_images": 1,
            "seed": seed,
            "enable_safety_checker": True,
            "output_format": "jpeg",
        }
        body = await self._submit(self.TXT2IMG_ENDPOINT, payload)
        return GenerationResult(
            image_bytes=await self._fetch_first_image(body), seed=seed
        )

    async def image_to_image(
        self, prompt, reference_bytes, *, seed, strength=0.6, size=(1024, 1024)
    ):
        width, height = size
        payload = {
            "prompt": prompt,
            "image_url": self._data_url(reference_bytes),
            "strength": float(strength),
            "image_size": {"width": width, "height": height},
            "num_inference_steps": 28,
            "num_images": 1,
            "seed": seed,
            "enable_safety_checker": True,
            "output_format": "jpeg",
        }
        body = await self._submit(self.IMG2IMG_ENDPOINT, payload)
        return GenerationResult(
            image_bytes=await self._fetch_first_image(body), seed=seed
        )

    async def edit(self, instruction, reference_bytes, *, seed, size=(1024, 1024)):
        # Schnell has no instruction-edit endpoint; emulate via image_to_image
        # with a moderate strength so the user's intent carries through.
        return await self.image_to_image(
            instruction, reference_bytes, seed=seed, strength=0.55, size=size
        )

    async def rotate_view(
        self,
        reference_bytes: bytes,
        *,
        horizontal_angle: float,
        seed: int,
        vertical_angle: float = 0.0,
    ) -> GenerationResult:
        raise EngineError(
            code="turntable_unsupported",
            message="FLUX Schnell cannot render turntable angle views.",
        )


# ---------- fal.ai FLUX Kontext Pro ---------------------------------------

class FalKontextEngine(_FalBase):
    """FLUX.1 Kontext [pro] on fal.ai, $0.04 per image, identity-preserving edit.

    Used for lighting variants where the ring identity has to stay locked while
    illumination changes. Different-angle views use the multi-angle LoRA model
    with explicit horizontal_angle degrees instead of Kontext text edits.
    """

    name = "fal-kontext"
    supports_img2img = True
    supports_edit = True
    supports_turntable = True

    EDIT_ENDPOINT = "fal-ai/flux-pro/kontext"
    MULTI_EDIT_ENDPOINT = "fal-ai/flux-pro/kontext/multi"
    MULTI_ANGLE_ENDPOINT = "fal-ai/flux-2-lora-gallery/multiple-angles"

    async def text_to_image(self, prompt, *, seed, size=(1024, 1024)):
        load_design_env()
        hero = (os.environ.get("DESIGN_HERO") or "dev").strip().lower()
        if hero != "schnell":
            return await FalFluxDevEngine().text_to_image(prompt, seed=seed, size=size)
        return await FalSchnellEngine().text_to_image(prompt, seed=seed, size=size)

    async def image_to_image(
        self, prompt, reference_bytes, *, seed, strength=0.6, size=(1024, 1024)
    ):
        return await self.edit(prompt, reference_bytes, seed=seed, size=size)

    async def edit(self, instruction, reference_bytes, *, seed, size=(1024, 1024)):
        payload = {
            "prompt": instruction,
            "image_url": self._data_url(reference_bytes),
            "num_inference_steps": 28,
            "guidance_scale": 3.5,
            "num_images": 1,
            "seed": seed,
            "output_format": "jpeg",
        }
        body = await self._submit(self.EDIT_ENDPOINT, payload)
        return GenerationResult(
            image_bytes=await self._fetch_first_image(body), seed=seed
        )

    async def multi_edit(
        self,
        instruction: str,
        references: list[bytes],
        *,
        seed: int,
        size: tuple[int, int] = (1024, 1024),
        guidance_scale: float = 3.5,
        enhance_prompt: bool = False,
    ) -> GenerationResult:
        """FLUX.1 Kontext [pro] multi-image composition.

        Used by virtual try-on: pass [hand_photo_bytes, ring_photo_bytes]
        as `references` and Kontext renders the ring from the second image
        worn on the hand in the first, preserving the identity of both.

        See: https://fal.ai/models/fal-ai/flux-pro/kontext/multi
        """
        if not references:
            raise EngineError(
                code="kontext_multi_empty",
                message="multi_edit requires at least one reference image.",
            )
        # Deliberately do NOT pass image_size — Kontext Multi anchors the
        # output aspect to the first reference image. Passing image_size
        # here returns squares regardless of input, which crops the hand.
        payload = {
            "prompt": instruction,
            "image_urls": [self._data_url(b) for b in references],
            "num_inference_steps": 28,
            "guidance_scale": guidance_scale,
            "enhance_prompt": enhance_prompt,
            "num_images": 1,
            "seed": seed,
            "output_format": "jpeg",
        }
        body = await self._submit(self.MULTI_EDIT_ENDPOINT, payload)
        return GenerationResult(
            image_bytes=await self._fetch_first_image(body), seed=seed
        )

    async def rotate_view(
        self,
        reference_bytes: bytes,
        *,
        horizontal_angle: float,
        seed: int,
        vertical_angle: float = 0.0,
    ) -> GenerationResult:
        """Render the same subject from an explicit camera azimuth (degrees)."""
        payload = {
            "image_urls": [self._data_url(reference_bytes)],
            "horizontal_angle": float(horizontal_angle),
            "vertical_angle": float(vertical_angle),
            "seed": seed,
            "output_format": "jpeg",
            "image_size": {"width": 1024, "height": 1024},
            "num_inference_steps": 40,
            "guidance_scale": 2.5,
            "acceleration": "none",
            "num_images": 1,
            "enable_safety_checker": True,
            "lora_scale": 1.0,
            "zoom": 5,
        }
        body = await self._submit(self.MULTI_ANGLE_ENDPOINT, payload)
        return GenerationResult(
            image_bytes=await self._fetch_first_image(body), seed=seed
        )


# ---------- Composite engine ----------------------------------------------

class CompositeEngine:
    """Routes calls to the right underlying engine.

    Hero uses FLUX Dev by default (DESIGN_HERO=dev), angle views use the numeric
    multi-angle endpoint, and lighting uses Kontext. Set DESIGN_HERO=schnell for
    the fast cheap path.
    """

    name = "fal-composite"
    supports_img2img = True
    supports_edit = True
    supports_turntable = True

    def __init__(self) -> None:
        load_design_env()
        self.fast = FalSchnellEngine()
        self.precise = FalKontextEngine()
        hero = (os.environ.get("DESIGN_HERO") or "dev").strip().lower()
        self._hero: Engine = self.fast if hero == "schnell" else FalFluxDevEngine()

    async def aclose(self) -> None:
        await self.fast.aclose()
        await self.precise.aclose()
        if self._hero is not self.fast:
            await self._hero.aclose()

    async def text_to_image(self, prompt, *, seed, size=(1024, 1024)):
        return await self._hero.text_to_image(prompt, seed=seed, size=size)

    async def image_to_image(
        self, prompt, reference_bytes, *, seed, strength=0.6, size=(1024, 1024)
    ):
        return await self.fast.image_to_image(
            prompt, reference_bytes, seed=seed, strength=strength, size=size
        )

    async def edit(self, instruction, reference_bytes, *, seed, size=(1024, 1024)):
        return await self.precise.edit(
            instruction, reference_bytes, seed=seed, size=size
        )

    async def multi_edit(
        self,
        instruction: str,
        references: list[bytes],
        *,
        seed: int,
        size: tuple[int, int] = (1024, 1024),
        guidance_scale: float = 3.5,
        enhance_prompt: bool = False,
    ) -> GenerationResult:
        """Forward to FLUX Kontext Pro Multi (try-on uses this)."""
        return await self.precise.multi_edit(
            instruction,
            references,
            seed=seed,
            size=size,
            guidance_scale=guidance_scale,
            enhance_prompt=enhance_prompt,
        )

    async def rotate_view(
        self,
        reference_bytes: bytes,
        *,
        horizontal_angle: float,
        seed: int,
        vertical_angle: float = 0.0,
    ) -> GenerationResult:
        return await self.precise.rotate_view(
            reference_bytes,
            horizontal_angle=horizontal_angle,
            seed=seed,
            vertical_angle=vertical_angle,
        )


# ---------- Factory --------------------------------------------------------

def make_engine() -> Engine:
    """Factory respecting DESIGN_ENGINE env var.

    Order of preference:
      fal-composite  FLUX Dev hero (default), numeric angles, Kontext lighting
      fal-schnell    Schnell only, cheaper, drift on angles
      fal-kontext    Kontext only
      pollinations   free, slow, text-only
    """
    load_design_env()
    name = os.environ.get("DESIGN_ENGINE", "pollinations").lower()
    if name in ("fal", "fal-composite"):
        return CompositeEngine()
    if name == "fal-schnell":
        return FalSchnellEngine()
    if name == "fal-kontext":
        return FalKontextEngine()
    if name == "pollinations":
        return PollinationsEngine()
    raise EngineError(
        code="engine_not_configured",
        message=f"Engine {name!r} is not implemented in this build",
    )


def seed_from(job_id: str, salt: str) -> int:
    """Deterministic per-stage seed so re-runs reproduce the same image."""
    h = 0
    for ch in f"{job_id}::{salt}":
        h = (h * 33 + ord(ch)) & 0xFFFFFFFF
    return h % 2_000_000_000 or random.randint(1, 2_000_000_000)
