"""Filesystem path helpers for /api/design.

Layout under apps/api/storage/:
    generations.db
    uploads/{upload_id}/{filename}
    packs/{job_id}/{stage}.jpg
"""
from __future__ import annotations

import shutil
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent
STORAGE_ROOT = API_DIR / "storage"
DB_PATH = STORAGE_ROOT / "generations.db"
UPLOADS_DIR = STORAGE_ROOT / "uploads"
PACKS_DIR = STORAGE_ROOT / "packs"


def ensure_dirs() -> None:
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    PACKS_DIR.mkdir(parents=True, exist_ok=True)


def upload_dir(upload_id: str) -> Path:
    p = UPLOADS_DIR / upload_id
    p.mkdir(parents=True, exist_ok=True)
    return p


def pack_dir(job_id: str) -> Path:
    p = PACKS_DIR / job_id
    p.mkdir(parents=True, exist_ok=True)
    return p


def is_within(child: Path, parent: Path) -> bool:
    """True iff `child` resolves inside `parent`. Mirrors main._is_within."""
    try:
        child.resolve().relative_to(parent.resolve())
    except ValueError:
        return False
    return True


def _safe_id(name: str) -> str | None:
    """Reject path traversal in storage ids (job_id, upload_id)."""
    safe = Path(name).name
    return safe if safe == name and safe not in ("", ".", "..") else None


def remove_pack(job_id: str) -> None:
    safe = _safe_id(job_id)
    if not safe:
        return
    p = (PACKS_DIR / safe).resolve()
    if is_within(p, PACKS_DIR) and p.exists():
        shutil.rmtree(p, ignore_errors=True)


def remove_upload_tree(upload_id: str) -> None:
    safe = _safe_id(upload_id)
    if not safe:
        return
    p = (UPLOADS_DIR / safe).resolve()
    if is_within(p, UPLOADS_DIR) and p.exists():
        shutil.rmtree(p, ignore_errors=True)


def purge_all_packs() -> None:
    ensure_dirs()
    for child in PACKS_DIR.iterdir():
        if child.is_dir() and is_within(child.resolve(), PACKS_DIR):
            shutil.rmtree(child, ignore_errors=True)


def purge_packs_for_job_ids(job_ids: list[str]) -> None:
    for job_id in job_ids:
        remove_pack(job_id)


def purge_all_upload_dirs() -> None:
    ensure_dirs()
    for child in UPLOADS_DIR.iterdir():
        if child.is_dir() and is_within(child.resolve(), UPLOADS_DIR):
            shutil.rmtree(child, ignore_errors=True)
