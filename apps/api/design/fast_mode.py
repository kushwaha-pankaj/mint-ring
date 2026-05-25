"""Fast design-pack profile — fewer API calls, quicker 3D when mesh is on."""
from __future__ import annotations

import os

from .engine import load_design_env


def design_fast_mode() -> bool:
    load_design_env()
    flag = (os.environ.get("DESIGN_FAST") or "1").strip().lower()
    return flag not in ("0", "false", "no", "off")


def angle_generation_mode() -> str:
    """Angle renderer mode.

    turntable uses fal's numeric multi-angle endpoint. edit keeps the old
    prompt-edit fallback for engines without explicit camera control.
    """
    load_design_env()
    mode = (os.environ.get("DESIGN_ANGLES") or "turntable").strip().lower()
    if mode in ("lora", "turntable", "multi-angle", "multi_angle"):
        return "turntable"
    if mode in ("kontext", "edit", "prompt-edit", "prompt_edit"):
        return "edit"
    return "turntable"


def angles_use_lora() -> bool:
    """Backward-compatible name for the numeric turntable path."""
    return angle_generation_mode() == "turntable"


def mesh_auto_uses_fast_provider() -> bool:
    """TripoSR fast path — only when explicitly opted in via DESIGN_MESH=triposr."""
    load_design_env()
    flag = (os.environ.get("DESIGN_MESH") or "auto").strip().lower()
    return flag == "triposr"
