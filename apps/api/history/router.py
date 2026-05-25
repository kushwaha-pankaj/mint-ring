"""FastAPI router for /api/history — per-device generation index."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from . import store
from .device import require_device_id
from .schemas import HistoryEntry, HistoryListResponse

router = APIRouter(prefix="/api/history", tags=["history"])


def _href(kind: str, ref_id: str) -> str:
    if kind == "design":
        return f"/design?job_id={ref_id}"
    return f"/try-on?render_id={ref_id}"


@router.get("/", response_model=HistoryListResponse)
def list_history(device_id: str = Depends(require_device_id)) -> HistoryListResponse:
    rows = store.list_for_device(device_id)
    entries = [
        HistoryEntry(
            entry_id=r["entry_id"],
            kind=r["kind"],
            ref_id=r["ref_id"],
            title=r["title"],
            preview_url=r["preview_url"],
            status=r["status"],
            href=_href(r["kind"], r["ref_id"]),
            created_at=r["created_at"],
            updated_at=r["updated_at"],
        )
        for r in rows
    ]
    return HistoryListResponse(device_id=device_id, entries=entries)


@router.delete("/{entry_id}")
def remove_history_entry(
    entry_id: str, device_id: str = Depends(require_device_id)
) -> dict:
    if not store.delete_entry(device_id, entry_id):
        raise HTTPException(404, "History entry not found")
    return {"ok": True}
