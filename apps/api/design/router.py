"""FastAPI router for /api/design/*."""
from __future__ import annotations

import asyncio
import io
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, Response
from PIL import Image

from . import gallery, jobs, pipeline, prompts
from .engine import Engine, EngineError, make_engine
from .schemas import (
    AttributeGroup,
    AttributeCandidate,
    DesignBrief,
    GenerateRequest,
    GenerateResponse,
    InspirationUpload,
    JobSnapshot,
    MAX_INSPIRATION_UPLOADS,
)
from ..history import store as history_store
from ..history.device import (
    device_id_from_request,
    gallery_device_scope,
    reconcile_ip_owned_jobs,
    require_device_id,
)
from .storage import (
    PACKS_DIR,
    UPLOADS_DIR,
    ensure_dirs,
    is_within,
    purge_packs_for_job_ids,
    purge_all_upload_dirs,
    remove_upload_tree,
    upload_dir,
)


MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB cap matches the frontend tip copy.


def _upload_url(upload_id: str, filename: str) -> str:
    return f"/api/design/uploads/{upload_id}/{filename}"


def _safe_filename(name: str) -> str:
    # Strip path components defensively before any filesystem op.
    base = Path(name or "image").name
    if not base or base in (".", ".."):
        base = "image"
    return base


def _attribute_groups_from_extractor(results: list) -> list[AttributeGroup]:
    """Map apps/api/attributes/extractor.AttributeResult → schemas.AttributeGroup."""
    out: list[AttributeGroup] = []
    for r in results:
        out.append(
            AttributeGroup(
                key=r.key,
                title=r.title,
                top=r.top,
                candidates=[
                    AttributeCandidate(label=c.label, score=float(c.score))
                    for c in r.candidates
                ],
            )
        )
    return out


def build_router(engine_provider) -> APIRouter:
    """`engine_provider` is a zero-arg callable returning the shared Engine.

    Passing a provider lets main.py own the engine lifecycle (create on
    startup, close on shutdown) without circular imports.
    """
    router = APIRouter(prefix="/api/design", tags=["design"])

    # ---- Uploads -------------------------------------------------------------

    @router.post("/uploads")
    async def upload_inspiration(image: UploadFile = File(...)) -> dict:
        contents = await image.read()
        if not contents:
            raise HTTPException(400, "Empty file")
        if len(contents) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "File too large (8 MB max)")
        try:
            pil = Image.open(io.BytesIO(contents)).convert("RGB")
        except Exception:
            raise HTTPException(400, "Not a valid image")

        # Persist to disk
        ensure_dirs()
        upload_id = uuid.uuid4().hex
        filename = _safe_filename(image.filename or "image.jpg")
        target = upload_dir(upload_id) / filename
        target.write_bytes(contents)

        # Extract attributes via the existing SigLIP analyser
        from ..attributes import extractor as attribute_extractor  # local import to avoid cycle

        results, _latency_ms = attribute_extractor.extract(pil)
        attrs = _attribute_groups_from_extractor(results)

        url = _upload_url(upload_id, filename)
        jobs.insert_upload(upload_id, filename, str(target), url, attrs)

        return {
            "upload_id": upload_id,
            "filename": filename,
            "url": url,
            "attributes": [a.model_dump() for a in attrs],
        }

    @router.delete("/uploads/{upload_id}")
    def remove_inspiration(upload_id: str) -> dict:
        record = jobs.get_upload(upload_id)
        if not record:
            raise HTTPException(404, "Upload not found")
        remove_upload_tree(upload_id)
        jobs.delete_upload(upload_id)
        return {"ok": True}

    @router.delete("/session")
    def reset_design_session(request: Request) -> dict:
        """Remove this device's design jobs, packs, uploads, and history."""
        device_id = device_id_from_request(request)
        ensure_dirs()
        job_ids = jobs.list_job_ids_for_device(device_id)
        cancelled = jobs.cancel_active_jobs_for_device(device_id)
        deleted_jobs = jobs.delete_jobs_for_device(device_id)
        deleted_history = history_store.delete_for_device(device_id)
        deleted_uploads = jobs.delete_all_uploads()
        purge_packs_for_job_ids(job_ids)
        purge_all_upload_dirs()
        return {
            "ok": True,
            "device_id": device_id,
            "cancelled_jobs": cancelled,
            "deleted_jobs": deleted_jobs,
            "deleted_history": deleted_history,
            "deleted_uploads": deleted_uploads,
        }

    @router.get("/uploads/{upload_id}/{filename}")
    def get_upload_file(upload_id: str, filename: str) -> FileResponse:
        record = jobs.get_upload(upload_id)
        if not record:
            raise HTTPException(404, "Not found")
        candidate = Path(record["stored_path"]).resolve()
        if not is_within(candidate, UPLOADS_DIR):
            raise HTTPException(404, "Not found")
        if Path(filename).name != Path(record["filename"]).name:
            raise HTTPException(404, "Not found")
        if not candidate.is_file():
            raise HTTPException(404, "Not found")
        return FileResponse(candidate)

    # ---- Gallery (today's packs) ---------------------------------------------

    @router.get("/gallery")
    def gallery_for_device(request: Request) -> dict:
        """Ordered, categorized assets for this browser and machine (see gallery_device_scope)."""
        scope = gallery_device_scope(request)
        reconcile_ip_owned_jobs(scope.primary, request)
        return gallery.build_device_gallery(
            primary=scope.primary,
            query_ids=scope.query_ids,
            loopback=scope.loopback,
        )

    @router.get("/gallery/today")
    def gallery_today() -> dict:
        """Today's packs only (all devices on this server), grouped by date."""
        return gallery.build_today_gallery()

    @router.get("/gallery/archive")
    def gallery_archive() -> dict:
        """All packs on this server through today, grouped by date."""
        return gallery.build_archive_gallery()

    # ---- Generation ----------------------------------------------------------

    @router.post("/generate", response_model=GenerateResponse)
    async def start_generation(
        payload: GenerateRequest,
        background: BackgroundTasks,
        request: Request,
    ) -> GenerateResponse:
        brief = payload.brief

        if not prompts.is_brief_ready(brief):
            raise HTTPException(
                422,
                "Brief missing required fields (ringType, metal, setting).",
            )
        if not brief.outputPack:
            raise HTTPException(422, "Choose at least one item for the output pack.")
        if len(brief.inspirationUploadIds) > MAX_INSPIRATION_UPLOADS:
            raise HTTPException(
                422,
                f"Up to {MAX_INSPIRATION_UPLOADS} inspiration images are allowed.",
            )

        inspirations = jobs.lookup_inspirations(brief.inspirationUploadIds)
        # Surface a clear error if the client claims an upload id we don't have.
        if len(inspirations) != len(brief.inspirationUploadIds):
            missing = [
                uid for uid in brief.inspirationUploadIds
                if not any(i.upload_id == uid for i in inspirations)
            ]
            raise HTTPException(
                422,
                f"Unknown inspiration upload ids: {', '.join(missing)}",
            )

        # Merge top-attribute per group across all inspirations into a single
        # AttributeGroup list (collapse by key, keep the highest-scoring top).
        inspiration_attrs = _merge_inspiration_attrs(inspirations)

        engine = engine_provider()
        prompt = prompts.build_prompt(brief, inspiration_attrs)
        sketch_prompt = prompts.build_sketch_prompt(brief, inspiration_attrs)
        design_id = prompts.design_id_for(brief)
        device_id = device_id_from_request(request)
        job_id = jobs.create_job(
            brief=brief,
            design_id=design_id,
            prompt=prompt,
            sketch_prompt=sketch_prompt,
            inspiration_attrs=inspiration_attrs,
            engine=engine.name,
            device_id=device_id,
        )
        history_store.upsert_design(
            device_id,
            job_id=job_id,
            design_id=design_id,
            brief=brief,
            status="queued",
        )

        background.add_task(pipeline.run_pipeline, job_id, engine)

        return GenerateResponse(job_id=job_id, design_id=design_id, status="queued")

    @router.get("/generate/{job_id}", response_model=JobSnapshot)
    def get_job_snapshot(job_id: str) -> JobSnapshot:
        snap = jobs.get_job(job_id)
        if not snap:
            raise HTTPException(404, "Job not found")
        return snap

    @router.post("/generate/{job_id}/cancel")
    def cancel_generation(job_id: str) -> dict:
        ok = jobs.set_cancel_requested(job_id)
        if not ok:
            raise HTTPException(409, "Job is not cancellable (missing or already finished)")
        return {"ok": True}

    # ---- Pack assets ---------------------------------------------------------

    @router.get("/assets/{job_id}/{filename}")
    def get_asset(job_id: str, filename: str) -> Response:
        safe_job = Path(job_id).name
        safe_file = Path(filename).name
        if safe_job != job_id or safe_file != filename:
            raise HTTPException(404, "Not found")
        target = (PACKS_DIR / safe_job / safe_file).resolve()
        if not is_within(target, PACKS_DIR):
            raise HTTPException(404, "Not found")
        if not target.is_file():
            raise HTTPException(404, "Not found")
        return FileResponse(target, media_type=_media_type(target))

    return router


def _merge_inspiration_attrs(uploads: list[InspirationUpload]) -> list[AttributeGroup]:
    """For each group (metal, stone, …) pick the highest-scoring top label
    across all uploaded images. Output is ordered by first appearance.
    """
    best: dict[str, AttributeGroup] = {}
    best_top_score: dict[str, float] = {}
    order: list[str] = []
    for upload in uploads:
        for group in upload.attributes:
            top_score = group.candidates[0].score if group.candidates else 0.0
            if group.key not in best or top_score > best_top_score.get(group.key, -1.0):
                best[group.key] = group
                best_top_score[group.key] = top_score
                if group.key not in order:
                    order.append(group.key)
    return [best[k] for k in order]


def _media_type(p: Path) -> str:
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".glb": "model/gltf-binary",
    }.get(p.suffix.lower(), "application/octet-stream")
