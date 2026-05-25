"""SQLite job store for /api/design generation jobs.

Single-file demo persistence — survives uvicorn reload but is intentionally
minimal. The job row is the source of truth for the frontend's polling.
"""
from __future__ import annotations

import json
import sqlite3
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from .schemas import (
    AttributeGroup,
    DesignBrief,
    InspirationUpload,
    JobSnapshot,
    JobStatus,
    StageState,
)
from .storage import DB_PATH, ensure_dirs

_DDL = """
CREATE TABLE IF NOT EXISTS uploads (
  upload_id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  url TEXT NOT NULL,
  attrs_json TEXT NOT NULL,
  created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS generations (
  job_id TEXT PRIMARY KEY,
  design_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  brief_json TEXT NOT NULL,
  prompt TEXT NOT NULL,
  sketch_prompt TEXT NOT NULL,
  inspiration_attrs_json TEXT NOT NULL,
  current_stage TEXT,
  stages_json TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  engine TEXT NOT NULL,
  started_at REAL,
  finished_at REAL,
  created_at REAL NOT NULL,
  updated_at REAL NOT NULL,
  device_id TEXT
);
"""


def _migrate_schema(conn: sqlite3.Connection) -> None:
    cols = {row[1] for row in conn.execute("PRAGMA table_info(generations)").fetchall()}
    if "device_id" not in cols:
        conn.execute("ALTER TABLE generations ADD COLUMN device_id TEXT")
    conn.executescript(
        """
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
    )

# One global lock + connection. SQLite handles concurrency adequately for a
# demo with one operator; we serialise writes to avoid `database is locked`.
_lock = threading.RLock()
_conn: sqlite3.Connection | None = None


def _connect() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        ensure_dirs()
        _conn = sqlite3.connect(DB_PATH, check_same_thread=False, isolation_level=None)
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.executescript(_DDL)
        _migrate_schema(_conn)
    return _conn


def reset_for_tests(db_path: Path) -> None:
    """Repoint the module at a different DB. Test helper only."""
    global _conn
    with _lock:
        if _conn is not None:
            _conn.close()
            _conn = None
        # Re-seed DB_PATH? Storage module owns the constant — we just rely on
        # the caller monkeypatching storage.DB_PATH before this.


# ----- Uploads -----------------------------------------------------------

def insert_upload(
    upload_id: str,
    filename: str,
    stored_path: str,
    url: str,
    attrs: list[AttributeGroup],
) -> None:
    with _lock:
        _connect().execute(
            "INSERT INTO uploads(upload_id, filename, stored_path, url, attrs_json, created_at)"
            " VALUES (?,?,?,?,?,?)",
            (
                upload_id,
                filename,
                stored_path,
                url,
                json.dumps([a.model_dump() for a in attrs]),
                time.time(),
            ),
        )


def get_upload(upload_id: str) -> dict | None:
    with _lock:
        row = _connect().execute(
            "SELECT upload_id, filename, stored_path, url, attrs_json"
            " FROM uploads WHERE upload_id = ?",
            (upload_id,),
        ).fetchone()
    if not row:
        return None
    return {
        "upload_id": row[0],
        "filename": row[1],
        "stored_path": row[2],
        "url": row[3],
        "attributes": json.loads(row[4]),
    }


def delete_upload(upload_id: str) -> bool:
    with _lock:
        cur = _connect().execute(
            "DELETE FROM uploads WHERE upload_id = ?", (upload_id,)
        )
        return cur.rowcount > 0


def delete_job(job_id: str) -> bool:
    with _lock:
        cur = _connect().execute(
            "DELETE FROM generations WHERE job_id = ?", (job_id,)
        )
        return cur.rowcount > 0


def cancel_all_active_jobs() -> int:
    now = time.time()
    with _lock:
        cur = _connect().execute(
            "UPDATE generations SET status='cancelled', finished_at=?, updated_at=?"
            " WHERE status IN ('queued', 'running')",
            (now, now),
        )
        return cur.rowcount


def delete_all_jobs() -> int:
    with _lock:
        cur = _connect().execute("DELETE FROM generations")
        return cur.rowcount


def list_job_ids_for_device(device_id: str) -> list[str]:
    with _lock:
        rows = _connect().execute(
            "SELECT job_id FROM generations WHERE device_id = ?", (device_id,)
        ).fetchall()
    return [r[0] for r in rows]


def delete_jobs_for_device(device_id: str) -> int:
    with _lock:
        cur = _connect().execute(
            "DELETE FROM generations WHERE device_id = ?", (device_id,)
        )
        return cur.rowcount


def cancel_active_jobs_for_device(device_id: str) -> int:
    now = time.time()
    with _lock:
        cur = _connect().execute(
            "UPDATE generations SET status='cancelled', finished_at=?, updated_at=?"
            " WHERE device_id = ? AND status IN ('queued', 'running')",
            (now, now, device_id),
        )
        return cur.rowcount


def delete_all_uploads() -> int:
    with _lock:
        cur = _connect().execute("DELETE FROM uploads")
        return cur.rowcount


def lookup_inspirations(upload_ids: list[str]) -> list[InspirationUpload]:
    out: list[InspirationUpload] = []
    for uid in upload_ids:
        row = get_upload(uid)
        if not row:
            continue
        attrs = [AttributeGroup(**a) for a in row["attributes"]]
        out.append(
            InspirationUpload(
                upload_id=row["upload_id"],
                url=row["url"],
                filename=row["filename"],
                attributes=attrs,
            )
        )
    return out


# ----- Jobs --------------------------------------------------------------

def _initial_stages(brief: DesignBrief) -> dict[str, StageState]:
    selected = set(brief.outputPack)
    stages: dict[str, StageState] = {}
    for stage in ("hero", "sketch", "angles", "mesh", "lighting", "spec"):
        if stage in selected:
            stages[stage] = StageState(status="pending")
        else:
            stages[stage] = StageState(status="skipped")
    return stages


def create_job(
    brief: DesignBrief,
    design_id: str,
    prompt: str,
    sketch_prompt: str,
    inspiration_attrs: list[AttributeGroup],
    engine: str,
    device_id: str | None = None,
) -> str:
    job_id = uuid.uuid4().hex
    now = time.time()
    stages = _initial_stages(brief)
    with _lock:
        _connect().execute(
            "INSERT INTO generations(job_id, design_id, status, brief_json, prompt, sketch_prompt,"
            " inspiration_attrs_json, current_stage, stages_json, engine, created_at, updated_at,"
            " device_id)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                job_id,
                design_id,
                "queued",
                brief.model_dump_json(),
                prompt,
                sketch_prompt,
                json.dumps([a.model_dump() for a in inspiration_attrs]),
                None,
                json.dumps({k: v.model_dump() for k, v in stages.items()}),
                engine,
                now,
                now,
                device_id,
            ),
        )
    return job_id


def _row_to_snapshot(row: tuple) -> JobSnapshot:
    (
        job_id, design_id, status, brief_json, prompt, sketch_prompt,
        inspiration_attrs_json, current_stage, stages_json, error_code,
        error_message, engine, started_at, finished_at, created_at, updated_at,
    ) = row
    stages_raw = json.loads(stages_json)
    stages = {k: StageState(**v) for k, v in stages_raw.items()}
    inspiration_attrs = [AttributeGroup(**a) for a in json.loads(inspiration_attrs_json or "[]")]
    end = finished_at or updated_at
    start = started_at or created_at
    latency_ms = int(max(0.0, end - start) * 1000) if end and start else 0
    return JobSnapshot(
        job_id=job_id,
        design_id=design_id,
        status=status,
        current_stage=current_stage,
        stages=stages,
        prompt=prompt,
        sketch_prompt=sketch_prompt,
        inspiration_attrs=inspiration_attrs,
        error_code=error_code,
        error_message=error_message,
        engine=engine,
        latency_ms=latency_ms,
        created_at=created_at,
        updated_at=updated_at,
    )


def list_jobs_for_device(device_id: str) -> list[tuple]:
    """All generation rows for a device, newest last in list (caller may reverse)."""
    return list_jobs_for_devices([device_id])


def list_jobs_for_devices(device_ids: list[str]) -> list[tuple]:
    """All generation rows for any of the given device ids (oldest first)."""
    ids = [d for d in dict.fromkeys(device_ids) if d]
    if not ids:
        return []
    placeholders = ",".join("?" * len(ids))
    with _lock:
        rows = _connect().execute(
            "SELECT job_id, design_id, status, created_at, brief_json"
            f" FROM generations WHERE device_id IN ({placeholders})"
            " ORDER BY created_at ASC",
            ids,
        ).fetchall()
    return list(rows)


def reassign_device_id(*, from_id: str, to_id: str) -> int:
    """Retag generations from one device id to another (gallery reconciliation)."""
    if not from_id or from_id == to_id:
        return 0
    with _lock:
        cur = _connect().execute(
            "UPDATE generations SET device_id = ? WHERE device_id = ?",
            (to_id, from_id),
        )
        return cur.rowcount


def list_jobs_with_pack_dirs() -> list[tuple]:
    """Every generation row that still has a pack folder on disk (local studio)."""
    from .storage import PACKS_DIR

    if not PACKS_DIR.is_dir():
        return []
    pack_ids = {p.name for p in PACKS_DIR.iterdir() if p.is_dir()}
    if not pack_ids:
        return []
    placeholders = ",".join("?" * len(pack_ids))
    with _lock:
        rows = _connect().execute(
            "SELECT job_id, design_id, status, created_at, brief_json"
            f" FROM generations WHERE job_id IN ({placeholders})"
            " ORDER BY created_at ASC",
            tuple(pack_ids),
        ).fetchall()
    return list(rows)


def list_jobs_since(since: float) -> list[tuple]:
    """Raw generation rows with created_at >= since, oldest first."""
    with _lock:
        rows = _connect().execute(
            "SELECT job_id, design_id, status, created_at, brief_json"
            " FROM generations WHERE created_at >= ? ORDER BY created_at ASC",
            (since,),
        ).fetchall()
    return list(rows)


def list_jobs_until(until_ts: float) -> list[tuple]:
    """All generation rows with created_at <= until_ts, oldest first."""
    with _lock:
        rows = _connect().execute(
            "SELECT job_id, design_id, status, created_at, brief_json"
            " FROM generations WHERE created_at <= ? ORDER BY created_at ASC",
            (until_ts,),
        ).fetchall()
    return list(rows)


def get_job(job_id: str) -> JobSnapshot | None:
    with _lock:
        row = _connect().execute(
            "SELECT job_id, design_id, status, brief_json, prompt, sketch_prompt,"
            " inspiration_attrs_json, current_stage, stages_json, error_code,"
            " error_message, engine, started_at, finished_at, created_at, updated_at"
            " FROM generations WHERE job_id = ?",
            (job_id,),
        ).fetchone()
    if not row:
        return None
    return _row_to_snapshot(row)


def get_brief(job_id: str) -> DesignBrief | None:
    with _lock:
        row = _connect().execute(
            "SELECT brief_json FROM generations WHERE job_id = ?", (job_id,)
        ).fetchone()
    if not row:
        return None
    return DesignBrief.model_validate_json(row[0])


def get_status(job_id: str) -> JobStatus | None:
    with _lock:
        row = _connect().execute(
            "SELECT status FROM generations WHERE job_id = ?", (job_id,)
        ).fetchone()
    return row[0] if row else None


def mark_running(job_id: str) -> None:
    now = time.time()
    with _lock:
        _connect().execute(
            "UPDATE generations SET status='running', started_at=?, updated_at=? WHERE job_id=?",
            (now, now, job_id),
        )
    try:
        from ..history import store as history_store

        history_store.update_design(job_id, status="running")
    except Exception:
        pass


def update_stage(job_id: str, stage: str, new_state: StageState) -> None:
    now = time.time()
    with _lock:
        conn = _connect()
        row = conn.execute(
            "SELECT stages_json FROM generations WHERE job_id=?", (job_id,)
        ).fetchone()
        if not row:
            return
        stages = json.loads(row[0])
        stages[stage] = new_state.model_dump()
        conn.execute(
            "UPDATE generations SET stages_json=?, current_stage=?, updated_at=? WHERE job_id=?",
            (json.dumps(stages), stage, now, job_id),
        )


def finish_job(job_id: str, status: JobStatus, error: tuple[str, str] | None = None) -> None:
    now = time.time()
    code = error[0] if error else None
    message = error[1] if error else None
    with _lock:
        _connect().execute(
            "UPDATE generations SET status=?, current_stage=NULL, finished_at=?, updated_at=?,"
            " error_code=?, error_message=? WHERE job_id=?",
            (status, now, now, code, message, job_id),
        )
    try:
        from ..history import store as history_store

        history_store.update_design(job_id, status=status)
    except Exception:
        pass


def set_cancel_requested(job_id: str) -> bool:
    """Marks the job cancelled — pipeline checks status between stages.

    Returns True if the job exists and was not already in a terminal state.
    """
    now = time.time()
    with _lock:
        row = _connect().execute(
            "SELECT status FROM generations WHERE job_id=?", (job_id,)
        ).fetchone()
        if not row:
            return False
        status = row[0]
        if status in ("succeeded", "failed", "cancelled"):
            return False
        _connect().execute(
            "UPDATE generations SET status='cancelled', updated_at=?, finished_at=? WHERE job_id=?",
            (now, now, job_id),
        )
    return True
