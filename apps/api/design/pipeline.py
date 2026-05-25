"""Pipeline orchestrator: turn a job into a consistent design pack.

Flow (hero-anchored, identity preserving):
  1. hero      realistic render first (canonical ring)
  2. sketch    pencil concept from the hero
  3. angles    4 parallel turntable views from the hero (90° steps)
  4. mesh      Meshy v5 GLB from 0°/90°/180°/270° (needs angles done)
  5. lighting  4 parallel relights from the hero (runs with mesh when both on)
  6. spec      derived locally from the brief

Stages 4–5 overlap (asyncio.gather) so lighting does not wait for a 5–7 min mesh.

Every stage reports live progress so the frontend percentage bars update as
work completes. Hero is the spine, its failure fails the whole job. Angles
and lighting are best-effort: a single failed variant is dropped rather than
killing the pack.
"""
from __future__ import annotations

import asyncio
import time
import traceback
from typing import Any

from . import jobs, mesh, prompts
from .engine import Engine, EngineError, seed_from
from .fast_mode import angle_generation_mode, mesh_auto_uses_fast_provider
from .schemas import StageState
from .storage import pack_dir


# Wall-clock estimates per stage, used by the frontend to animate progress
# bars between server polls. They are deliberately a little pessimistic.


def _mesh_duration_estimate_s() -> float:
    return 90.0 if mesh_auto_uses_fast_provider() else 420.0


def _stage_duration_s(stage: str) -> float | None:
    if stage == "mesh":
        return _mesh_duration_estimate_s()
    return STAGE_DURATIONS_S.get(stage)


STAGE_DURATIONS_S = {
    "hero": 18.0,
    "mesh": 420.0,
    "sketch": 4.0,
    "angles": 12.0,
    "lighting": 14.0,
    "spec": 0.5,
}

# 4:5 portrait — matches paired sketch/render panels in the results grid.
HERO_SIZE = (1024, 1280)
SKETCH_SIZE = (1024, 1280)
ANGLE_SIZE = (1024, 1024)
LIGHTING_SIZE = (1024, 1024)


def asset_url(job_id: str, filename: str) -> str:
    return f"/api/design/assets/{job_id}/{filename}"


async def run_pipeline(job_id: str, engine: Engine) -> None:
    """Top-level driver. Catches every exception so the background task
    never dies silently."""
    try:
        await _run(job_id, engine)
    except Exception as e:
        traceback.print_exc()
        jobs.finish_job(job_id, "failed", error=("pipeline_crash", str(e)))


async def _run(job_id: str, engine: Engine) -> None:
    snapshot = jobs.get_job(job_id)
    if snapshot is None:
        return
    if jobs.get_status(job_id) == "cancelled":
        return

    jobs.mark_running(job_id)

    brief = jobs.get_brief(job_id)
    if brief is None:
        jobs.finish_job(job_id, "failed", error=("job_corrupt", "brief missing"))
        return

    base_prompt = snapshot.prompt
    pack_dir(job_id)

    # Hero is the spine. No hero, no consistent pack.
    hero_bytes: bytes | None = None
    if _is_active(snapshot.stages, "hero"):
        hero_bytes = await _run_hero(job_id, engine, base_prompt)
        if hero_bytes is None:
            return
        if _cancelled(job_id):
            return

    # Sketch is a style transformation from the hero. Prefer instruction-edit
    # engines so the exact ring identity stays locked while the output becomes
    # a pencil-and-paper concept sketch.
    if _is_active(snapshot.stages, "sketch"):
        await _run_sketch(job_id, engine, base_prompt, hero_bytes)
        if _cancelled(job_id):
            return

    # Angles and lighting are identity-preserving edits from the hero.
    if _is_active(snapshot.stages, "angles") and hero_bytes is not None:
        await _run_angles(job_id, engine, hero_bytes)
        if _cancelled(job_id):
            return

    # Mesh (slow), lighting (fast), and spec (instant/local) overlap after angles.
    mesh_on = _is_active(snapshot.stages, "mesh") and hero_bytes is not None
    lighting_on = _is_active(snapshot.stages, "lighting") and hero_bytes is not None
    spec_on = _is_active(snapshot.stages, "spec")
    if mesh_on or lighting_on or spec_on:
        angles_active = _is_active(snapshot.stages, "angles")

        async def _mesh_task() -> None:
            if mesh_on:
                await _run_mesh(job_id, hero_bytes, angles_active=angles_active)

        async def _lighting_task() -> None:
            if lighting_on:
                await _run_lighting(job_id, engine, hero_bytes)

        async def _spec_task() -> None:
            if spec_on:
                _run_spec(job_id, brief)

        await asyncio.gather(_mesh_task(), _lighting_task(), _spec_task())
        if _cancelled(job_id):
            return

    if _cancelled(job_id):
        return
    jobs.finish_job(job_id, "succeeded")


# ----- Helpers ------------------------------------------------------------

def _is_active(stages: dict, key: str) -> bool:
    state = stages.get(key)
    if state is None:
        return False
    return state.status != "skipped"


def _cancelled(job_id: str) -> bool:
    return jobs.get_status(job_id) == "cancelled"


def _mark_running(job_id: str, stage: str, total: int, label: str) -> None:
    jobs.update_stage(
        job_id,
        stage,
        StageState(
            status="running",
            progress_completed=0,
            progress_total=max(1, total),
            progress_label=label,
            started_at=time.time(),
            duration_estimate_s=_stage_duration_s(stage),
        ),
    )


def _bump_running(
    job_id: str,
    stage: str,
    completed: int,
    total: int,
    label: str,
    *,
    angle_urls: list[dict] | None = None,
    lighting_urls: list[dict] | None = None,
) -> None:
    """Update a running stage with the latest progress."""
    state = StageState(
        status="running",
        progress_completed=completed,
        progress_total=max(1, total),
        progress_label=label,
        duration_estimate_s=_stage_duration_s(stage),
    )
    if angle_urls is not None:
        state.angle_urls = angle_urls
    if lighting_urls is not None:
        state.lighting_urls = lighting_urls
    jobs.update_stage(job_id, stage, state)


# ----- Stage: hero --------------------------------------------------------

async def _run_hero(job_id: str, engine: Engine, prompt: str) -> bytes | None:
    _mark_running(job_id, "hero", total=1, label="Painting the hero render")
    try:
        result = await engine.text_to_image(
            prompt, seed=seed_from(job_id, "hero"), size=HERO_SIZE
        )
    except EngineError as e:
        jobs.update_stage(
            job_id,
            "hero",
            StageState(
                status="failed",
                progress_completed=0,
                progress_total=1,
                error_code=e.code,
                error_message=e.message,
            ),
        )
        jobs.finish_job(job_id, "failed", error=(e.code, e.message))
        return None
    except Exception as e:
        jobs.update_stage(
            job_id,
            "hero",
            StageState(
                status="failed",
                progress_completed=0,
                progress_total=1,
                error_code="pipeline_error",
                error_message=str(e),
            ),
        )
        jobs.finish_job(job_id, "failed", error=("pipeline_error", str(e)))
        return None

    filename = "hero.jpg"
    (pack_dir(job_id) / filename).write_bytes(result.image_bytes)
    hero_asset = asset_url(job_id, filename)
    jobs.update_stage(
        job_id,
        "hero",
        StageState(
            status="done",
            asset_url=hero_asset,
            progress_completed=1,
            progress_total=1,
        ),
    )
    try:
        from ..history import store as history_store

        history_store.update_design(job_id, preview_url=hero_asset)
    except Exception:
        pass
    return result.image_bytes


# ----- Stage: mesh (fal Meshy / Tripo, best-effort) ------------------------

def _collect_angle_images(job_id: str) -> dict[int, bytes]:
    """Map turntable degree → JPEG bytes for completed angle variants."""
    out: dict[int, bytes] = {}
    pdir = pack_dir(job_id)
    for idx, (degrees, _, _) in enumerate(prompts.ANGLE_FRAMES):
        path = pdir / f"angle-{idx:02d}.jpg"
        if path.is_file():
            out[degrees] = path.read_bytes()
    return out


async def _run_mesh(job_id: str, hero_bytes: bytes, *, angles_active: bool) -> None:
    if not mesh.mesh_stage_enabled():
        jobs.update_stage(
            job_id,
            "mesh",
            StageState(
                status="skipped",
                progress_completed=0,
                progress_total=1,
                progress_label="Research 3D mesh",
                error_message="Set DESIGN_MESH=auto and FAL_KEY to enable.",
            ),
        )
        return

    angles_by_degree = _collect_angle_images(job_id) if angles_active else {}
    cardinal_views = (
        mesh.count_cardinal_views(hero_bytes, angles_by_degree)
        if angles_by_degree
        else 0
    )
    distinct_cardinal = (
        mesh.count_distinct_views(hero_bytes, angles_by_degree)
        if angles_by_degree
        else 0
    )
    provider = mesh.resolve_provider(
        angles_in_pack=angles_active,
        angle_count=len(angles_by_degree),
        cardinal_view_count=cardinal_views,
        distinct_cardinal_count=distinct_cardinal,
    )
    label = mesh.provider_label(provider)
    _mark_running(job_id, "mesh", total=1, label=f"Building {label}")
    snapshot = jobs.get_job(job_id)
    texture_prompt = mesh.texture_prompt_for_pack(
        design_prompt=snapshot.prompt if snapshot else None,
    )
    try:
        glb_bytes = await mesh.build_pack_glb(
            hero_bytes,
            angles_by_degree,
            provider=provider,
            texture_prompt=texture_prompt,
        )
    except EngineError as e:
        jobs.update_stage(
            job_id,
            "mesh",
            StageState(
                status="failed",
                progress_completed=0,
                progress_total=1,
                progress_label="Research 3D mesh",
                error_code=e.code,
                error_message=e.message,
            ),
        )
        return
    except Exception as e:
        jobs.update_stage(
            job_id,
            "mesh",
            StageState(
                status="failed",
                progress_completed=0,
                progress_total=1,
                progress_label="Research 3D mesh",
                error_code="mesh_error",
                error_message=str(e),
            ),
        )
        return

    filename = mesh.MESH_FILENAME
    (pack_dir(job_id) / filename).write_bytes(glb_bytes)
    jobs.update_stage(
        job_id,
        "mesh",
        StageState(
            status="done",
            asset_url=asset_url(job_id, filename),
            progress_completed=1,
            progress_total=1,
            progress_label=label,
        ),
    )


# ----- Stage: sketch ------------------------------------------------------

async def _run_sketch(
    job_id: str, engine: Engine, base_prompt: str, hero_bytes: bytes | None
) -> None:
    _mark_running(job_id, "sketch", total=1, label="Drafting the pencil sketch")
    sketch_prompt = prompts.img2img_sketch_prompt(base_prompt)
    seed = seed_from(job_id, "sketch")
    try:
        if engine.supports_img2img and hero_bytes is not None:
            # Kontext edit — reliable pencil sketch from hero (Schnell img2img endpoint 404s).
            if engine.supports_edit:
                result = await engine.edit(
                    sketch_prompt,
                    hero_bytes,
                    seed=seed,
                    size=SKETCH_SIZE,
                )
            else:
                result = await engine.image_to_image(
                    sketch_prompt,
                    hero_bytes,
                    seed=seed,
                    strength=0.75,
                    size=SKETCH_SIZE,
                )
        else:
            # Pollinations fallback path.
            result = await engine.text_to_image(
                sketch_prompt, seed=seed, size=SKETCH_SIZE
            )
    except EngineError as e:
        jobs.update_stage(
            job_id,
            "sketch",
            StageState(
                status="failed",
                progress_completed=0,
                progress_total=1,
                error_code=e.code,
                error_message=e.message,
            ),
        )
        return
    except Exception as e:
        jobs.update_stage(
            job_id,
            "sketch",
            StageState(
                status="failed",
                progress_completed=0,
                progress_total=1,
                error_code="pipeline_error",
                error_message=str(e),
            ),
        )
        return

    filename = "sketch.jpg"
    (pack_dir(job_id) / filename).write_bytes(result.image_bytes)
    jobs.update_stage(
        job_id,
        "sketch",
        StageState(
            status="done",
            asset_url=asset_url(job_id, filename),
            progress_completed=1,
            progress_total=1,
        ),
    )


# ----- Stage: angles (parallel) -------------------------------------------

async def _run_angles(job_id: str, engine: Engine, hero_bytes: bytes) -> None:
    frames = prompts.ANGLE_FRAMES
    total = len(frames)

    if not engine.supports_turntable and not engine.supports_edit and not engine.supports_img2img:
        jobs.update_stage(
            job_id,
            "angles",
            StageState(
                status="failed",
                progress_completed=0,
                progress_total=total,
                error_code="angles_require_reference",
                error_message=(
                    "Different angle views need a reference-aware engine (DESIGN_ENGINE=fal). "
                    "Pollinations text-only mode cannot preserve the hero ring identity."
                ),
            ),
        )
        return

    _mark_running(
        job_id,
        "angles",
        total=total,
        label=f"Rendering 0 of {total} different angle views",
    )

    items: list[dict] = []
    completed = 0
    lock = asyncio.Lock()
    angle_mode = angle_generation_mode()

    async def _render_angle(
        idx: int, degrees: int, label: str, phrase: str
    ) -> dict | None:
        filename = f"angle-{idx:02d}.jpg"
        angle_seed = seed_from(job_id, f"angles-{degrees}")
        try:
            if engine.supports_turntable and angle_mode == "turntable":
                result = await engine.rotate_view(
                    hero_bytes,
                    horizontal_angle=float(degrees),
                    seed=angle_seed,
                )
            elif engine.supports_edit:
                instruction = prompts.angle_edit_instruction(label, phrase, degrees)
                result = await engine.edit(
                    instruction,
                    hero_bytes,
                    seed=angle_seed,
                    size=ANGLE_SIZE,
                )
            elif engine.supports_turntable:
                result = await engine.rotate_view(
                    hero_bytes,
                    horizontal_angle=float(degrees),
                    seed=angle_seed,
                )
            else:
                instruction = prompts.angle_edit_instruction(label, phrase, degrees)
                result = await engine.image_to_image(
                    instruction,
                    hero_bytes,
                    seed=angle_seed,
                    strength=0.42,
                    size=ANGLE_SIZE,
                )
        except EngineError:
            return None
        except Exception:
            return None

        (pack_dir(job_id) / filename).write_bytes(result.image_bytes)
        return {
            "label": label,
            "degrees": degrees,
            "url": asset_url(job_id, filename),
        }

    tasks = [
        asyncio.create_task(_render_angle(idx, degrees, label, phrase))
        for idx, (degrees, label, phrase) in enumerate(frames)
    ]

    for coro in asyncio.as_completed(tasks):
        if _cancelled(job_id):
            for task in tasks:
                task.cancel()
            return

        result = await coro
        async with lock:
            completed += 1
            if result is not None:
                items.append(result)
            items.sort(key=lambda item: item["degrees"])
            public_items = [
                {"label": item["label"], "degrees": item["degrees"], "url": item["url"]}
                for item in items
            ]
            _bump_running(
                job_id,
                "angles",
                completed=completed,
                total=total,
                label=f"Preparing {completed} of {total} different angle views",
                angle_urls=public_items,
            )

    public_items = [
        {"label": item["label"], "degrees": item["degrees"], "url": item["url"]}
        for item in sorted(items, key=lambda item: item["degrees"])
    ]
    jobs.update_stage(
        job_id,
        "angles",
        StageState(
            status="done" if public_items else "failed",
            angle_urls=public_items,
            progress_completed=len(public_items),
            progress_total=total,
            error_code=None if public_items else "angles_all_failed",
            error_message=None
            if public_items
            else "Every different angle view failed to render.",
        ),
    )


# ----- Stage: lighting (parallel) -----------------------------------------

async def _run_lighting(job_id: str, engine: Engine, hero_bytes: bytes) -> None:
    variants = prompts.LIGHTING_VARIANTS
    total = len(variants)
    _mark_running(
        job_id, "lighting", total=total, label=f"Lighting 0 of {total} variants"
    )

    items: list[dict] = []
    completed = 0
    lock = asyncio.Lock()

    async def _render_light(
        idx: int, label: str, instruction: str, tint: str
    ) -> dict | None:
        filename = f"light-{idx:02d}.jpg"
        prompt = prompts.lighting_edit_instruction(instruction)
        try:
            if engine.supports_edit:
                result = await engine.edit(
                    prompt,
                    hero_bytes,
                    seed=seed_from(job_id, f"lighting-{tint}"),
                    size=LIGHTING_SIZE,
                )
            elif engine.supports_img2img:
                result = await engine.image_to_image(
                    prompt,
                    hero_bytes,
                    seed=seed_from(job_id, f"lighting-{tint}"),
                    strength=0.38,
                    size=LIGHTING_SIZE,
                )
            else:
                result = await engine.text_to_image(
                    prompt,
                    seed=seed_from(job_id, f"lighting-{tint}"),
                    size=LIGHTING_SIZE,
                )
        except EngineError:
            return None
        except Exception:
            return None

        (pack_dir(job_id) / filename).write_bytes(result.image_bytes)
        return {
            "idx": idx,
            "label": label,
            "url": asset_url(job_id, filename),
            "tint": tint,
        }

    tasks = [
        asyncio.create_task(_render_light(idx, label, instruction, tint))
        for idx, (label, instruction, tint) in enumerate(variants)
    ]

    by_idx: dict[int, dict] = {}

    for coro in asyncio.as_completed(tasks):
        if _cancelled(job_id):
            for task in tasks:
                task.cancel()
            return

        result = await coro
        async with lock:
            completed += 1
            if result is not None:
                by_idx[result["idx"]] = result
            items = [
                {k: v for k, v in by_idx[i].items() if k != "idx"}
                for i in sorted(by_idx)
            ]
            _bump_running(
                job_id,
                "lighting",
                completed=completed,
                total=total,
                label=f"Preparing {completed} of {total} lighting views",
                lighting_urls=items,
            )

    jobs.update_stage(
        job_id,
        "lighting",
        StageState(
            status="done" if items else "failed",
            lighting_urls=items,
            progress_completed=len(items),
            progress_total=total,
            error_code=None if items else "lighting_all_failed",
            error_message=None
            if items
            else "Every lighting variant failed to render.",
        ),
    )


# ----- Stage: spec (local) ------------------------------------------------

def _run_spec(job_id: str, brief: Any) -> None:
    _mark_running(job_id, "spec", total=1, label="Estimating specifications")
    rows = prompts.spec_rows(brief)
    jobs.update_stage(
        job_id,
        "spec",
        StageState(
            status="done",
            spec_rows=rows,
            progress_completed=1,
            progress_total=1,
        ),
    )
