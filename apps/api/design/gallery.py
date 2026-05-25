"""Build ordered, categorized asset manifests for the gallery page."""
from __future__ import annotations

import datetime
from pathlib import Path
from typing import Any

from . import jobs
from .prompts import ANGLE_FRAMES, LIGHTING_VARIANTS, ring_type_label
from .schemas import DesignBrief
from .storage import PACKS_DIR, is_within
from ..tryon.storage import TRYON_DIR

# Keep in sync with PACK_STAGES in design-brief.ts (visual order on gallery page).
SECTION_ORDER = ("hero", "sketch", "angles", "lighting", "mesh")

SECTION_LABELS = {
    "hero": "Realistic render",
    "sketch": "Concept sketch",
    "angles": "Angle views",
    "lighting": "Lighting variants",
    "mesh": "3D mesh",
}

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def _start_of_local_day() -> float:
    now = datetime.datetime.now()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return start.timestamp()


def _end_of_today_ts() -> float:
    now = datetime.datetime.now()
    end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    return end.timestamp()


def _date_key(ts: float) -> str:
    return datetime.datetime.fromtimestamp(ts).strftime("%Y-%m-%d")


def _date_label(ts: float) -> str:
    d = datetime.datetime.fromtimestamp(ts)
    today = datetime.datetime.now().date()
    day = d.date()
    formatted = d.strftime("%A %d %B %Y")
    if day == today:
        return f"Today · {formatted}"
    yesterday = today - datetime.timedelta(days=1)
    if day == yesterday:
        return f"Yesterday · {formatted}"
    return formatted


def _range_through_today_label() -> str:
    today = datetime.datetime.now()
    return f"Through {today.strftime('%A %d %B %Y')}"


def _title_for_brief(brief: DesignBrief) -> str:
    ring = ring_type_label(brief.ringType)
    metal = (brief.metal or "").replace("-", " ").strip()
    if metal:
        return f"{ring} · {metal.title()}"
    return ring


def _asset_item(
    job_id: str,
    filename: str,
    *,
    caption: str,
    degrees: int | None = None,
    media_type: str = "image/jpeg",
) -> dict[str, Any]:
    return {
        "filename": filename,
        "url": f"/api/design/assets/{job_id}/{filename}",
        "caption": caption,
        "degrees": degrees,
        "media_type": media_type,
    }


def _scan_pack_sections(job_id: str, brief: DesignBrief | None) -> list[dict[str, Any]]:
    pack_path = (PACKS_DIR / job_id).resolve()
    if not is_within(pack_path, PACKS_DIR) or not pack_path.is_dir():
        return []

    files = {p.name: p for p in pack_path.iterdir() if p.is_file()}
    sections: list[dict[str, Any]] = []

    if "hero.jpg" in files:
        sections.append(
            {
                "id": "hero",
                "label": SECTION_LABELS["hero"],
                "items": [_asset_item(job_id, "hero.jpg", caption="Hero render")],
            }
        )

    if "sketch.jpg" in files:
        sections.append(
            {
                "id": "sketch",
                "label": SECTION_LABELS["sketch"],
                "items": [_asset_item(job_id, "sketch.jpg", caption="Concept sketch")],
            }
        )

    angle_items: list[dict[str, Any]] = []
    for idx, (degrees, label, _) in enumerate(ANGLE_FRAMES):
        name = f"angle-{idx:02d}.jpg"
        if name in files:
            angle_items.append(
                _asset_item(job_id, name, caption=label, degrees=degrees)
            )
    if angle_items:
        sections.append(
            {
                "id": "angles",
                "label": SECTION_LABELS["angles"],
                "items": angle_items,
            }
        )

    light_items: list[dict[str, Any]] = []
    for idx, (label, _, _) in enumerate(LIGHTING_VARIANTS):
        name = f"light-{idx:02d}.jpg"
        if name in files:
            light_items.append(_asset_item(job_id, name, caption=label))
    if light_items:
        sections.append(
            {
                "id": "lighting",
                "label": SECTION_LABELS["lighting"],
                "items": light_items,
            }
        )

    mesh_name = next(
        (n for n in files if n.endswith(".glb")),
        None,
    )
    if mesh_name:
        sections.append(
            {
                "id": "mesh",
                "label": SECTION_LABELS["mesh"],
                "items": [
                    _asset_item(
                        job_id,
                        mesh_name,
                        caption="Textured 3D mesh (GLB)",
                        media_type="model/gltf-binary",
                    )
                ],
            }
        )

    # Spec is non-visual; attach rows when the job recorded them.
    snap = jobs.get_job(job_id)
    spec_rows = None
    if snap and snap.stages.get("spec"):
        spec_rows = snap.stages["spec"].spec_rows
    if not spec_rows and brief:
        from . import prompts

        spec_rows = prompts.spec_rows(brief)
    if spec_rows:
        rows = [
            {"key": r["key"], "value": r["value"]}
            if isinstance(r, dict)
            else {"key": r.key, "value": r.value}
            for r in spec_rows
        ]
        sections.append(
            {
                "id": "spec",
                "label": "AI-estimated specifications",
                "items": [],
                "spec_rows": rows,
            }
        )

    # Stable section order for anything we added out of band.
    order = {k: i for i, k in enumerate((*SECTION_ORDER, "spec"))}
    sections.sort(key=lambda s: order.get(s["id"], 99))
    return sections


def _scan_tryons_until(until_ts: float) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not TRYON_DIR.is_dir():
        return out
    for path in sorted(TRYON_DIR.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if not path.is_file() or path.suffix.lower() not in IMAGE_SUFFIXES:
            continue
        mtime = path.stat().st_mtime
        if mtime > until_ts:
            continue
        render_id = path.stem
        out.append(
            {
                "render_id": render_id,
                "title": "Photoreal try-on",
                "url": f"/api/tryon/renders/{path.name}",
                "created_at": mtime,
            }
        )
    return out


def _scan_tryons_since(since: float) -> list[dict[str, Any]]:
    return _scan_tryons_until(_end_of_today_ts())


def _group_gallery_by_date(
    designs: list[dict[str, Any]],
    tryons: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Merge designs and try-ons into date buckets (newest dates first)."""
    until = _end_of_today_ts()
    buckets: dict[str, dict[str, list]] = {}

    for design in designs:
        if design["created_at"] > until:
            continue
        key = _date_key(design["created_at"])
        buckets.setdefault(key, {"designs": [], "tryons": []})
        buckets[key]["designs"].append(design)

    for tryon in tryons:
        if tryon["created_at"] > until:
            continue
        key = _date_key(tryon["created_at"])
        buckets.setdefault(key, {"designs": [], "tryons": []})
        buckets[key]["tryons"].append(tryon)

    groups: list[dict[str, Any]] = []
    for key in sorted(buckets.keys(), reverse=True):
        bucket = buckets[key]
        bucket["designs"].sort(key=lambda d: d["created_at"], reverse=True)
        bucket["tryons"].sort(key=lambda t: t["created_at"], reverse=True)
        label_ts = (
            bucket["designs"][0]["created_at"]
            if bucket["designs"]
            else bucket["tryons"][0]["created_at"]
        )
        groups.append(
            {
                "date_key": key,
                "date_label": _date_label(label_ts),
                "design_count": len(bucket["designs"]),
                "tryon_count": len(bucket["tryons"]),
                "designs": bucket["designs"],
                "tryons": bucket["tryons"],
            }
        )
    return groups


def _gallery_response(
    designs: list[dict[str, Any]],
    tryons: list[dict[str, Any]],
) -> dict[str, Any]:
    until = _end_of_today_ts()
    designs = [d for d in designs if d["created_at"] <= until]
    designs.sort(key=lambda d: d["created_at"], reverse=True)
    tryons = [t for t in tryons if t["created_at"] <= until]
    tryons.sort(key=lambda t: t["created_at"], reverse=True)
    groups = _group_gallery_by_date(designs, tryons)
    range_label = _range_through_today_label()
    return {
        "range_label": range_label,
        "date_label": range_label,
        "design_count": len(designs),
        "tryon_count": len(tryons),
        "groups": groups,
        "designs": designs,
        "tryons": tryons,
    }


def _rows_to_designs(rows: list[tuple]) -> list[dict[str, Any]]:
    designs: list[dict[str, Any]] = []
    for row in rows:
        job_id, design_id, status, created_at, brief_json = row
        brief = DesignBrief.model_validate_json(brief_json)
        sections = _scan_pack_sections(job_id, brief)
        if not sections:
            continue
        designs.append(
            {
                "job_id": job_id,
                "design_id": design_id,
                "title": _title_for_brief(brief),
                "status": status,
                "created_at": created_at,
                "sections": sections,
                "href": f"/design?job_id={job_id}",
            }
        )
    return designs


def build_device_gallery(
    *,
    primary: str,
    query_ids: tuple[str, ...],
    loopback: bool,
) -> dict[str, Any]:
    """Design packs through today, grouped by date (all server jobs on localhost)."""
    from ..history.store import backfill_orphan_generations

    backfill_orphan_generations(primary)
    until = _end_of_today_ts()

    seen: set[str] = set()
    merged_rows: list[tuple] = []

    if loopback:
        for row in jobs.list_jobs_until(until):
            job_id = row[0]
            if job_id in seen:
                continue
            seen.add(job_id)
            merged_rows.append(row)
    else:
        for row in jobs.list_jobs_for_devices(list(query_ids)):
            job_id = row[0]
            if job_id in seen:
                continue
            seen.add(job_id)
            merged_rows.append(row)

    designs = _rows_to_designs(merged_rows)
    tryons = _scan_tryons_until(until)
    return _gallery_response(designs, tryons)


def build_today_gallery() -> dict[str, Any]:
    """Legacy alias: today's packs only (no device filter), grouped by date."""
    since = _start_of_local_day()
    until = _end_of_today_ts()
    rows = [
        row
        for row in jobs.list_jobs_until(until)
        if row[3] >= since
    ]
    designs = _rows_to_designs(rows)
    tryons = [
        t
        for t in _scan_tryons_until(until)
        if t["created_at"] >= since
    ]
    return _gallery_response(designs, tryons)


def build_archive_gallery() -> dict[str, Any]:
    """All design packs on this server through end of today, grouped by date."""
    until = _end_of_today_ts()
    designs = _rows_to_designs(jobs.list_jobs_until(until))
    tryons = _scan_tryons_until(until)
    return _gallery_response(designs, tryons)
