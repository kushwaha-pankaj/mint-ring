"""FLUX prompt builders, server-side mirror of design-brief.ts.

Kept deliberately in lockstep with apps/web/src/lib/design-brief.ts so the
prompt the customer sees in <DesignPackTechnical /> matches what the server
sent to the engine.
"""
from __future__ import annotations

from .schemas import AttributeGroup, DesignBrief

RING_TYPE_LABELS = {
    "engagement": "Engagement",
    "wedding-band": "Wedding band",
    "eternity": "Eternity",
    "halo": "Halo ring",
    "solitaire": "Solitaire",
    "signet": "Signet",
    "cluster": "Cluster",
    "three-stone": "Three stone",
}


def ring_type_label(value: str) -> str:
    return RING_TYPE_LABELS.get(value, value)


def primary_mood(brief: DesignBrief) -> str:
    if brief.moods:
        return brief.moods[0]
    return brief.mood or ""


def mood_label(brief: DesignBrief) -> str:
    if brief.moods:
        return ", ".join(brief.moods)
    return brief.mood or ""


def is_brief_ready(brief: DesignBrief) -> bool:
    return bool(brief.ringType and brief.metal and brief.setting)


_NOISE_LABELS = {"none", "", "plain band"}


def inspiration_clause(attrs: list[AttributeGroup], brief: DesignBrief | None = None) -> str:
    """Distil uploaded-image attributes into a soft-conditioning clause.

    Inspiration should *fill gaps*, not fight the user's explicit choices.
    For each attribute group, skip the inspiration value if:
      * the user already chose something for that field (e.g. they picked
        "White gold" — don't inject the inspiration's "Yellow gold"); or
      * the extractor returned a noise label ("None", empty, "Plain band").
    """
    if not attrs:
        return ""

    # Map group key → the user's explicit choice (lowercased).
    user_choice: dict[str, str] = {}
    if brief is not None:
        user_choice = {
            "metal": (brief.metal or "").strip().lower(),
            "stone": (brief.stone or "").strip().lower(),
            "setting": (brief.setting or "").strip().lower(),
            "band": (brief.band or brief.bandStyle or "").strip().lower(),
            "finish": (brief.finish or "").strip().lower(),
            "mood": (primary_mood(brief) or "").strip().lower(),
        }

    bits: list[str] = []
    for group in attrs:
        top = (group.top or "").strip()
        if not top or top.lower() in _NOISE_LABELS:
            continue
        # Skip if the user already specified something for this group — their
        # explicit choice wins over inspiration.
        if user_choice.get(group.key):
            continue
        framings = {
            "metal": f"{top.lower()} tones",
            "stone": f"{top.lower()} stone",
            "setting": f"{top.lower()} setting",
            "band": f"{top.lower()} band",
            "finish": f"{top.lower()} finish",
            "mood": f"{top.lower()} feel",
        }
        bits.append(framings.get(group.key, top.lower()))

    if not bits:
        return ""
    return " Inspired by references: " + ", ".join(bits) + "."


def build_prompt(brief: DesignBrief, inspiration_attrs: list[AttributeGroup] | None = None) -> str:
    """Hero / studio-render prompt."""
    type_label = ring_type_label(brief.ringType).lower()
    stone = (
        f" with a {brief.stone.lower()} centre stone"
        if brief.stone and brief.stone != "None"
        else ""
    )
    mood_val = primary_mood(brief)
    mood = f"{mood_val.lower()} " if mood_val else ""
    band_desc = " ".join(p for p in [brief.bandStyle, brief.band or "court"] if p)
    finish = brief.finish or "polished"
    extras = (
        f" {', '.join(brief.optionalDetails)}."
        if brief.optionalDetails
        else ""
    )
    notes = f" {brief.notes.strip()}" if brief.notes.strip() else ""
    inspiration = inspiration_clause(inspiration_attrs or [], brief)

    return (
        f"A {mood}{brief.metal.lower()} {type_label} ring{stone}, "
        f"{brief.setting.lower()} setting, {band_desc.lower()} band, "
        f"{finish.lower()} finish.{extras}{notes}{inspiration} "
        f"One single ring only, no duplicate rings, no set of rings, no extra jewellery. "
        f"Portrait orientation, full ring centered in frame with breathing room, "
        f"studio product photography on a soft neutral background, "
        f"{_CATALOGUE_FOCUS}, "
        f"clean smooth metal surfaces, no jagged edges or mesh artifacts, "
        f"crisp metal edges and stone facets throughout, ultra-detailed photorealistic render."
    )


def build_sketch_prompt(brief: DesignBrief, inspiration_attrs: list[AttributeGroup] | None = None) -> str:
    """Stored on the job and shown in DesignPackTechnical — matches the sketch stage."""
    return img2img_sketch_prompt(build_prompt(brief, inspiration_attrs))


# Turntable: four cardinal views (fast + enough for Meshy multi-image).
# Keep ANGLE_FRAME_COUNT in sync with frontend copy.
ANGLE_FRAME_COUNT = 4
ANGLE_FRAMES: list[tuple[int, str, str]] = [
    (0, "Front", "front view, camera level with the ring, straight on"),
    (90, "Side", "pure side profile view, 90 degrees rotation"),
    (180, "Back", "rear profile view, 180 degrees rotation"),
    (270, "Other side", "pure side profile from the other side, 270 degrees"),
]


# Lighting variants: strong, visually distinct illumination changes while the
# ring identity (geometry, materials, setting) stays locked.
LIGHTING_VARIANTS: list[tuple[str, str, str]] = [
    (
        "Soft Studio",
        "Relight the exact same ring with soft diffused studio lighting on a clean neutral grey background. "
        "Keep the entire ring tack-sharp with no depth-of-field blur. Do not change the ring design or materials.",
        "studio",
    ),
    (
        "Bright Light",
        "Relight the exact same ring with bright high-key lighting, crisp highlights, white seamless background, "
        "catalogue jewellery photography. Keep the entire ring tack-sharp with no depth-of-field blur. "
        "Do not change the ring design or materials.",
        "bright",
    ),
    (
        "Natural Daylight",
        "Relight the exact same ring with soft natural daylight from a window, gentle shadows, warm neutral background, "
        "editorial jewellery style. Keep the entire ring tack-sharp with no depth-of-field blur. "
        "Do not change the ring design or materials.",
        "day",
    ),
    (
        "Luxury Dark",
        "Relight the exact same ring with dramatic low-key lighting on a dark velvet background, single rim light, "
        "deep shadows, jewellery boutique style. Keep the entire ring tack-sharp with no depth-of-field blur. "
        "Do not change the ring design or materials.",
        "dark",
    ),
]
LIGHTING_VARIANT_COUNT = len(LIGHTING_VARIANTS)


# Shared catalogue photography clause — keep hero + prompt-edit fallbacks aligned.
_CATALOGUE_FOCUS = (
    "entire ring tack-sharp, deep depth of field, no bokeh, no background blur, "
    "no selective focus, f/16 jewellery catalogue photography"
)


def angle_edit_instruction(angle_label: str, angle_phrase: str, degrees: int) -> str:
    """Prompt-edit fallback for engines without numeric turntable control."""
    return (
        f"Rotate the camera to a {angle_phrase} ({angle_label}, {degrees} degrees azimuth). "
        f"Show the exact same single ring from this new viewpoint only — "
        f"do not change the ring design, stone, metal, setting, band width, or proportions. "
        f"One ring only, no duplicate rings, no extra jewellery. "
        f"Neutral studio background, product photography, full ring visible, centered, "
        f"{_CATALOGUE_FOCUS}."
    )


def lighting_edit_instruction(prompt_body: str) -> str:
    """Instruction prompt used with Kontext edit calls for one lighting variant."""
    return prompt_body


def img2img_sketch_prompt(base_prompt: str) -> str:
    """Sketch prompt used as image-to-image from the hero render."""
    base = base_prompt.rstrip(". ")
    return (
        "Convert the reference ring into a pure jewellery design sketch. "
        "Preserve the exact stone shape, band profile, prong layout, and proportions from the reference — "
        "do not redesign the ring. "
        "The entire image should be graphite pencil on warm cream paper, with visible paper grain, "
        "construction lines, dimension marks, soft pencil shading and hand-drawn technical detail. "
        "Show one front view and one three-quarter view of the exact same single ring as pencil drawings only. "
        "No photorealistic ring, no color render, no polished product photo, no duplicate jewellery. "
        f"Same ring as the reference: {base}."
    )


# Estimated specs — mirrors estimatedSpecRows() in design-brief.ts.

def spec_rows(brief: DesignBrief) -> list[dict]:
    rows: list[dict] = [
        {"key": "Ring type", "value": ring_type_label(brief.ringType)},
        {"key": "Metal", "value": brief.metal},
        {"key": "Setting", "value": brief.setting},
    ]
    if brief.stone:
        rows.append({"key": "Centre stone", "value": brief.stone})
    if brief.bandStyle:
        rows.append({"key": "Band style", "value": brief.bandStyle})
    if brief.band:
        rows.append({"key": "Band profile", "value": brief.band})
    if brief.finish:
        rows.append({"key": "Finish", "value": brief.finish})
    mood_text = mood_label(brief)
    if mood_text:
        rows.append({"key": "Style mood", "value": mood_text})
    if brief.optionalDetails:
        rows.append({"key": "Extra details", "value": ", ".join(brief.optionalDetails)})

    width = (
        "1.8 mm to 2.2 mm" if brief.bandStyle == "Slim"
        else "3.0 mm to 3.5 mm" if brief.bandStyle == "Bold"
        else "2.2 mm to 2.8 mm"
    )
    height = "Medium-high" if brief.setting in ("Halo", "Solitaire") else "Low-medium"
    weight = (
        "Delicate" if brief.bandStyle == "Slim" or primary_mood(brief) == "Minimalist"
        else "Balanced"
    )
    complexity = (
        "Medium-high" if len(brief.optionalDetails) > 2 or brief.setting == "Halo"
        else "Medium"
    )

    rows.extend([
        {"key": "Est. band width", "value": width},
        {"key": "Est. setting height", "value": height},
        {"key": "Est. visual weight", "value": weight},
        {"key": "Design complexity", "value": complexity},
        {"key": "Style direction", "value": mood_text or "Classic"},
    ])
    return rows


def design_id_for(brief: DesignBrief) -> str:
    """Stable design id derived from the brief — mirrors designIdFromBrief().

    Uses the same `hash * 31 + charCode` reduction the TypeScript version uses
    so the same brief produces the same ID on both sides.
    """
    raw = brief.model_dump_json()
    h = 0
    for ch in raw:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return f"HM-2026-{h % 100000:05d}"
