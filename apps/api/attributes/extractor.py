"""
Zero-shot ring attribute extraction with SigLIP.

For each attribute group (metal, setting, centre stone, band profile)
we hold a short list of natural-language prompts. SigLIP scores
the image against every prompt; the highest-scoring prompt wins.

Why this beats calling a VLM:
  * Runs locally on Mac MPS in ~300 ms per image — no API key, no
    network, no per-call cost.
  * Confidence falls out of the score distribution for free.
  * Fine-tunable: when the KTP catalogues real Hockley Mint photographs,
    we replace the text-embedding cache with prompts that match the
    house vocabulary, and optionally LoRA-tune SigLIP itself.

Model: google/siglip-base-patch16-224 (203 M params). The KTP roadmap
swaps to a Hockley-Mint-fine-tuned variant in month 2 — same interface,
different weights.
"""

from __future__ import annotations

# Silence cosmetic third-party noise that the demo terminal echoes through:
#   * transformers' bos/eos token-id warnings on SigLIP (known transformers 5.x quirk)
#   * HuggingFace Hub's "unauthenticated requests" tip
# Must be set BEFORE importing transformers.
import logging
import os
import warnings

os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")
os.environ.setdefault("TRANSFORMERS_NO_ADVISORY_WARNINGS", "1")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("HF_HUB_DISABLE_IMPLICIT_TOKEN", "1")
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
os.environ.setdefault("HF_HUB_VERBOSITY", "error")
warnings.filterwarnings("ignore", message=".*bos_token_id.*")
warnings.filterwarnings("ignore", message=".*eos_token_id.*")
warnings.filterwarnings("ignore", message=".*unauthenticated requests.*")
warnings.filterwarnings("ignore", category=UserWarning, module="huggingface_hub.*")
logging.getLogger("transformers").setLevel(logging.ERROR)
logging.getLogger("huggingface_hub").setLevel(logging.ERROR)

# Best-effort additional silencing via the libraries' own APIs. These imports
# can fail in weird shapes across versions, so each is guarded.
try:
    import transformers as _tx
    _tx.logging.set_verbosity_error()
    if hasattr(_tx, "utils") and hasattr(_tx.utils, "logging"):
        _tx.utils.logging.disable_progress_bar()
        _tx.utils.logging.disable_default_handler()
except Exception:
    pass
try:
    import huggingface_hub as _hf
    if hasattr(_hf, "logging"):
        _hf.logging.set_verbosity_error()
    if hasattr(_hf, "utils") and hasattr(_hf.utils, "logging"):
        _hf.utils.logging.set_verbosity_error()
        _hf.utils.logging.disable_progress_bars()
except Exception:
    pass

import time
from dataclasses import dataclass, asdict
from typing import Optional

import torch
import torch.nn.functional as F
from PIL import Image

MODEL_ID = "google/siglip-base-patch16-224"


# ------- Prompt bank ---------------------------------------------------------

# Each group: ordered list of (label, prompt). Label is what the UI shows;
# prompt is what SigLIP scores. Prompts are deliberately written as "a photo
# of <description>" — SigLIP responds well to caption-shaped text.

ATTRIBUTE_GROUPS: list[tuple[str, str, list[tuple[str, str]]]] = [
    (
        "metal",
        "Metal",
        [
            ("Yellow gold", "a photo of a yellow gold ring"),
            ("White gold", "a photo of a white gold ring"),
            ("Rose gold", "a photo of a rose gold ring"),
            ("Platinum", "a photo of a platinum ring"),
            ("Silver", "a photo of a silver ring"),
        ],
    ),
    (
        "setting",
        "Setting",
        [
            ("Plain band", "a plain wedding band with no stones"),
            ("Solitaire", "a solitaire ring with a single centre stone"),
            ("Halo", "a halo ring with small diamonds around the centre stone"),
            ("Three stone", "a three-stone ring with one large centre stone"),
            ("Pavé", "a pavé band with small diamonds along it"),
            ("Channel", "a channel-set ring with stones inset into the band"),
        ],
    ),
    (
        "stone",
        "Centre stone",
        [
            ("None", "a ring with no stones"),
            ("Round brilliant", "a ring with a round brilliant diamond"),
            ("Oval", "a ring with an oval shaped diamond"),
            ("Princess", "a ring with a princess cut diamond"),
            ("Cushion", "a ring with a cushion cut diamond"),
            ("Emerald cut", "a ring with an emerald cut diamond"),
            ("Pear", "a ring with a pear shaped diamond"),
            ("Marquise", "a ring with a marquise diamond"),
        ],
    ),
    (
        "band",
        "Band profile",
        [
            ("Court", "a court profile wedding band, rounded inside and outside"),
            ("D-shape", "a D-shape wedding band, flat inside and rounded outside"),
            ("Flat", "a flat wedding band, rectangular profile"),
            ("Half round", "a half-round wedding band"),
            ("Knife edge", "a knife-edge wedding band with a ridge along the top"),
        ],
    ),
]


# ------- Result schema -------------------------------------------------------

@dataclass
class Candidate:
    label: str
    score: float


@dataclass
class AttributeResult:
    key: str        # e.g. "metal"
    title: str      # e.g. "Metal"
    top: str        # winning label
    candidates: list[Candidate]   # ranked, all included for /technical detail


# ------- Lazy state ----------------------------------------------------------

class _State:
    model = None
    processor = None
    text_features: Optional[torch.Tensor] = None     # (P, D) L2-normalised
    logit_scale: Optional[torch.Tensor] = None
    logit_bias: Optional[torch.Tensor] = None
    flat_prompts: list[tuple[str, str, str]] = []    # (group_key, label, prompt)
    boot_seconds: float = 0.0
    device: str = "cpu"


_state = _State()


def _ensure_loaded() -> None:
    """Load SigLIP and precompute text embeddings on first call."""
    if _state.model is not None:
        return

    t0 = time.perf_counter()
    # Import here so a server that never calls /api/analyse doesn't pay the
    # transformers import cost.
    from transformers import SiglipModel, SiglipProcessor

    _state.device = "mps" if torch.backends.mps.is_available() else "cpu"
    model = SiglipModel.from_pretrained(MODEL_ID).to(_state.device).eval()
    processor = SiglipProcessor.from_pretrained(MODEL_ID)

    # Flatten every prompt across every group so we can encode them all in
    # one batch. Keep the (group, label) mapping so we can demux later.
    flat: list[tuple[str, str, str]] = []
    for group_key, _title, choices in ATTRIBUTE_GROUPS:
        for label, prompt in choices:
            flat.append((group_key, label, prompt))

    prompts = [p for _, _, p in flat]
    with torch.no_grad():
        text_inputs = processor(text=prompts, return_tensors="pt", padding="max_length").to(_state.device)
        # transformers 5.x: get_text_features returns BaseModelOutputWithPooling;
        # the tensor we want is pooler_output. SigLIP has no separate projection
        # layer, so this IS the final text embedding.
        text_embeds = model.get_text_features(**text_inputs).pooler_output
        text_embeds = F.normalize(text_embeds, dim=-1)

    _state.model = model
    _state.processor = processor
    _state.text_features = text_embeds
    _state.logit_scale = model.logit_scale.exp().detach()
    _state.logit_bias = model.logit_bias.detach()
    _state.flat_prompts = flat
    _state.boot_seconds = time.perf_counter() - t0


# ------- Public API ----------------------------------------------------------

def extract(image: Image.Image) -> tuple[list[AttributeResult], int]:
    """
    Run zero-shot attribute extraction on a PIL image.

    Returns a list of AttributeResult (one per group, in declaration order)
    and the inference latency in milliseconds.
    """
    _ensure_loaded()
    assert _state.model is not None and _state.processor is not None
    assert _state.text_features is not None and _state.logit_scale is not None
    assert _state.logit_bias is not None

    t0 = time.perf_counter()
    with torch.no_grad():
        inputs = _state.processor(images=image, return_tensors="pt").to(_state.device)
        img_embed = _state.model.get_image_features(**inputs).pooler_output
        img_embed = F.normalize(img_embed, dim=-1)
        logits = (img_embed @ _state.text_features.T) * _state.logit_scale + _state.logit_bias
        probs = torch.sigmoid(logits)[0].tolist()

    # Demux back into groups.
    grouped: dict[str, list[Candidate]] = {}
    for (group_key, label, _prompt), score in zip(_state.flat_prompts, probs):
        grouped.setdefault(group_key, []).append(Candidate(label=label, score=float(score)))

    results: list[AttributeResult] = []
    for group_key, title, _choices in ATTRIBUTE_GROUPS:
        cands = sorted(grouped[group_key], key=lambda c: c.score, reverse=True)
        results.append(
            AttributeResult(
                key=group_key,
                title=title,
                top=cands[0].label,
                candidates=cands,
            )
        )

    latency_ms = int((time.perf_counter() - t0) * 1000)
    return results, latency_ms


def metadata() -> dict:
    """Runtime metadata for /api/analyse responses."""
    _ensure_loaded()
    return {
        "model": MODEL_ID,
        "device": _state.device,
        "prompt_count": len(_state.flat_prompts),
    }


def status() -> dict:
    """Lightweight introspection for /api/health."""
    return {
        "loaded": _state.model is not None,
        "device": _state.device if _state.model is not None else None,
        "boot_seconds": round(_state.boot_seconds, 2) if _state.model is not None else None,
        "groups": [g for g, _t, _c in ATTRIBUTE_GROUPS],
        "prompt_count": len(_state.flat_prompts),
        "model": MODEL_ID,
    }


def to_jsonable(results: list[AttributeResult]) -> list[dict]:
    """Convert the dataclasses to plain dicts for FastAPI response."""
    out: list[dict] = []
    for r in results:
        out.append({
            "key": r.key,
            "title": r.title,
            "top": r.top,
            "candidates": [asdict(c) for c in r.candidates],
        })
    return out
