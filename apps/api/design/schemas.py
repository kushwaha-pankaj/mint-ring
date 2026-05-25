"""Pydantic v2 request/response models for /api/design/*.

The DesignBrief mirrors apps/web/src/lib/design-brief.ts so the client
and server agree on the shape that flows through generation.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

# Output pack ids must stay in lockstep with PACK_STAGES in design-brief.ts.
OutputPackId = Literal["sketch", "hero", "mesh", "angles", "lighting", "spec"]
StageStatus = Literal["pending", "running", "done", "skipped", "failed"]
JobStatus = Literal["queued", "running", "succeeded", "failed", "cancelled"]


PROMPT_MAX_CHARS = 500
MAX_INSPIRATION_UPLOADS = 8


class DesignBrief(BaseModel):
    """Mirror of the TypeScript DesignBrief — fields kept name-for-name."""

    ringType: str = ""
    metal: str = ""
    setting: str = ""
    stone: str = ""
    band: str = ""
    bandStyle: str = ""
    finish: str = ""
    mood: str = ""
    moods: list[str] = Field(default_factory=list)
    optionalDetails: list[str] = Field(default_factory=list)
    notes: str = ""
    outputPack: list[OutputPackId] = Field(default_factory=list)
    # Frontend posts upload_ids returned from /api/design/uploads; the server
    # uses those to look up the on-disk files and attribute metadata.
    inspirationUploadIds: list[str] = Field(default_factory=list)

    @field_validator("notes")
    @classmethod
    def _notes_length(cls, v: str) -> str:
        if len(v) > PROMPT_MAX_CHARS:
            raise ValueError(f"notes exceed {PROMPT_MAX_CHARS} characters")
        return v

    @field_validator("outputPack")
    @classmethod
    def _output_pack_unique(cls, v: list[str]) -> list[str]:
        seen: list[str] = []
        for item in v:
            if item not in seen:
                seen.append(item)
        return seen


class GenerateRequest(BaseModel):
    brief: DesignBrief


class AttributeCandidate(BaseModel):
    label: str
    score: float


class AttributeGroup(BaseModel):
    key: str
    title: str
    top: str
    candidates: list[AttributeCandidate]


class InspirationUpload(BaseModel):
    upload_id: str
    url: str
    filename: str
    attributes: list[AttributeGroup] = Field(default_factory=list)


class StageState(BaseModel):
    status: StageStatus
    asset_url: str | None = None
    angle_urls: list[dict] | None = None  # [{label, degrees, url}]
    lighting_urls: list[dict] | None = None
    spec_rows: list[dict] | None = None  # [{key, value}]
    # Live progress fields, driven by the pipeline as work happens.
    progress_completed: int = 0
    progress_total: int = 1
    progress_label: str | None = None
    started_at: float | None = None
    duration_estimate_s: float | None = None
    error_code: str | None = None
    error_message: str | None = None


class JobSnapshot(BaseModel):
    job_id: str
    design_id: str
    status: JobStatus
    current_stage: str | None
    stages: dict[str, StageState]
    prompt: str
    sketch_prompt: str
    inspiration_attrs: list[AttributeGroup] = Field(default_factory=list)
    error_code: str | None = None
    error_message: str | None = None
    engine: str
    latency_ms: int
    created_at: float
    updated_at: float


class GenerateResponse(BaseModel):
    job_id: str
    design_id: str
    status: JobStatus
