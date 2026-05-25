"""Pydantic models for /api/history."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

HistoryKind = Literal["design", "tryon"]
HistoryStatus = Literal["queued", "running", "succeeded", "failed", "cancelled"]


class HistoryEntry(BaseModel):
    entry_id: str
    kind: HistoryKind
    ref_id: str
    title: str
    preview_url: str | None = None
    status: HistoryStatus
    href: str
    created_at: float
    updated_at: float


class HistoryListResponse(BaseModel):
    device_id: str
    entries: list[HistoryEntry] = Field(default_factory=list)
