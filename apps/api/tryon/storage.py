"""Filesystem helpers for refined try-on renders.

Layout: apps/api/storage/tryon/{render_id}.jpg

Stays simple on purpose — try-on doesn't have multi-stage assets like
Design's pack/{job_id}/* tree.
"""
from __future__ import annotations

import shutil
from pathlib import Path

from ..design.storage import STORAGE_ROOT, is_within

TRYON_DIR = STORAGE_ROOT / "tryon"


def ensure_dirs() -> None:
    TRYON_DIR.mkdir(parents=True, exist_ok=True)


def save_render(render_id: str, data: bytes) -> Path:
    ensure_dirs()
    safe = Path(render_id).name
    if safe != render_id or safe in ("", ".", ".."):
        raise ValueError("Unsafe render id")
    target = (TRYON_DIR / f"{safe}.jpg").resolve()
    if not is_within(target, TRYON_DIR):
        raise ValueError("Render path escaped storage root")
    target.write_bytes(data)
    return target


def purge_all_renders() -> int:
    """Remove every refined render. Returns count removed."""
    if not TRYON_DIR.exists():
        return 0
    n = 0
    for child in TRYON_DIR.iterdir():
        if child.is_file() and is_within(child.resolve(), TRYON_DIR):
            try:
                child.unlink()
                n += 1
            except OSError:
                continue
        elif child.is_dir() and is_within(child.resolve(), TRYON_DIR):
            shutil.rmtree(child, ignore_errors=True)
    return n
