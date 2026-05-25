"""SQLite history index keyed by browser device id."""
from __future__ import annotations

import json
import time
import uuid
from typing import Any

from ..design.jobs import _connect, _lock
from ..design.prompts import ring_type_label
from ..design.schemas import DesignBrief

_HISTORY_DDL = """
CREATE TABLE IF NOT EXISTS history_entries (
  entry_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('design','tryon')),
  ref_id TEXT NOT NULL,
  title TEXT NOT NULL,
  preview_url TEXT,
  status TEXT NOT NULL,
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at REAL NOT NULL,
  updated_at REAL NOT NULL,
  UNIQUE(device_id, kind, ref_id)
);
CREATE INDEX IF NOT EXISTS idx_history_device_created
  ON history_entries(device_id, created_at DESC);
"""


def ensure_history_schema() -> None:
    with _lock:
        _connect().executescript(_HISTORY_DDL)


def _title_for_brief(brief: DesignBrief) -> str:
    ring = ring_type_label(brief.ringType)
    metal = (brief.metal or "").replace("-", " ").strip()
    if metal:
        return f"{ring} · {metal.title()}"
    return ring


def upsert_design(
    device_id: str,
    *,
    job_id: str,
    design_id: str,
    brief: DesignBrief,
    status: str = "queued",
    preview_url: str | None = None,
) -> None:
    ensure_history_schema()
    now = time.time()
    title = _title_for_brief(brief)
    meta = json.dumps({"design_id": design_id})
    with _lock:
        conn = _connect()
        row = conn.execute(
            "SELECT entry_id, created_at FROM history_entries"
            " WHERE device_id=? AND kind='design' AND ref_id=?",
            (device_id, job_id),
        ).fetchone()
        if row:
            conn.execute(
                "UPDATE history_entries SET title=?, preview_url=COALESCE(?, preview_url),"
                " status=?, meta_json=?, updated_at=? WHERE entry_id=?",
                (title, preview_url, status, meta, now, row[0]),
            )
            return
        conn.execute(
            "INSERT INTO history_entries"
            " (entry_id, device_id, kind, ref_id, title, preview_url, status, meta_json,"
            "  created_at, updated_at)"
            " VALUES (?,?,?,?,?,?,?,?,?,?)",
            (
                uuid.uuid4().hex,
                device_id,
                "design",
                job_id,
                title,
                preview_url,
                status,
                meta,
                now,
                now,
            ),
        )


def update_design(
    job_id: str,
    *,
    status: str | None = None,
    preview_url: str | None = None,
) -> None:
    ensure_history_schema()
    now = time.time()
    with _lock:
        conn = _connect()
        if status is not None and preview_url is not None:
            conn.execute(
                "UPDATE history_entries SET status=?, preview_url=?, updated_at=?"
                " WHERE kind='design' AND ref_id=?",
                (status, preview_url, now, job_id),
            )
        elif status is not None:
            conn.execute(
                "UPDATE history_entries SET status=?, updated_at=?"
                " WHERE kind='design' AND ref_id=?",
                (status, now, job_id),
            )
        elif preview_url is not None:
            conn.execute(
                "UPDATE history_entries SET preview_url=?, updated_at=?"
                " WHERE kind='design' AND ref_id=?",
                (preview_url, now, job_id),
            )


def insert_tryon(
    device_id: str,
    *,
    render_id: str,
    ring_image_url: str,
    preview_url: str,
) -> None:
    ensure_history_schema()
    now = time.time()
    title = "Photoreal try-on"
    meta = json.dumps({"ring_image_url": ring_image_url})
    with _lock:
        conn = _connect()
        row = conn.execute(
            "SELECT entry_id FROM history_entries"
            " WHERE device_id=? AND kind='tryon' AND ref_id=?",
            (device_id, render_id),
        ).fetchone()
        if row:
            conn.execute(
                "UPDATE history_entries SET preview_url=?, status='succeeded',"
                " meta_json=?, updated_at=? WHERE entry_id=?",
                (preview_url, meta, now, row[0]),
            )
            return
        conn.execute(
            "INSERT INTO history_entries"
            " (entry_id, device_id, kind, ref_id, title, preview_url, status, meta_json,"
            "  created_at, updated_at)"
            " VALUES (?,?,?,?,?,?,?,?,?,?)",
            (
                uuid.uuid4().hex,
                device_id,
                "tryon",
                render_id,
                title,
                preview_url,
                "succeeded",
                meta,
                now,
                now,
            ),
        )


def backfill_orphan_generations(device_id: str) -> int:
    """Attach pre-history jobs on this server to the requesting device (demo migration)."""
    from ..design.schemas import DesignBrief
    from ..design.storage import PACKS_DIR

    ensure_history_schema()
    imported = 0
    with _lock:
        conn = _connect()
        rows = conn.execute(
            "SELECT job_id, design_id, status, brief_json FROM generations"
            " WHERE device_id IS NULL OR device_id = ''"
        ).fetchall()
    for job_id, design_id, status, brief_json in rows:
        brief = DesignBrief.model_validate_json(brief_json)
        preview = None
        hero = PACKS_DIR / job_id / "hero.jpg"
        if hero.is_file():
            preview = f"/api/design/assets/{job_id}/hero.jpg"
        upsert_design(
            device_id,
            job_id=job_id,
            design_id=design_id,
            brief=brief,
            status=status,
            preview_url=preview,
        )
        with _lock:
            _connect().execute(
                "UPDATE generations SET device_id = ? WHERE job_id = ?",
                (device_id, job_id),
            )
        imported += 1
    return imported


def list_for_device(device_id: str, *, limit: int = 48) -> list[dict[str, Any]]:
    ensure_history_schema()
    backfill_orphan_generations(device_id)
    with _lock:
        rows = _connect().execute(
            "SELECT entry_id, kind, ref_id, title, preview_url, status, created_at, updated_at"
            " FROM history_entries WHERE device_id=?"
            " ORDER BY updated_at DESC LIMIT ?",
            (device_id, limit),
        ).fetchall()
    return [
        {
            "entry_id": r[0],
            "kind": r[1],
            "ref_id": r[2],
            "title": r[3],
            "preview_url": r[4],
            "status": r[5],
            "created_at": r[6],
            "updated_at": r[7],
        }
        for r in rows
    ]


def delete_for_device(device_id: str) -> int:
    ensure_history_schema()
    with _lock:
        cur = _connect().execute(
            "DELETE FROM history_entries WHERE device_id=?", (device_id,)
        )
        return cur.rowcount


def delete_entry(device_id: str, entry_id: str) -> bool:
    ensure_history_schema()
    with _lock:
        cur = _connect().execute(
            "DELETE FROM history_entries WHERE device_id=? AND entry_id=?",
            (device_id, entry_id),
        )
        return cur.rowcount > 0
