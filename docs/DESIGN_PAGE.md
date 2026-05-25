# Design Page — Guided AI Ring Design Builder

> **Route:** `http://localhost:3000/design`  
> **Product goal:** Not “type a prompt → random image.” A **guided jewellery design studio** that turns structured choices + optional creative language into a **design pack** (sketch, 3D-style render, views, lighting, specs) and eventually hands off to Virtual Try-On.

**Do not confuse with Identify “Design analysis”** — that is Module 1B (Analyse): reading attributes from a **photograph** via `POST /api/analyse` on the Identify page (`/#design-analysis`). The Design **page** is Module 2: **creating** new concepts from a brief.

---

## Purpose

Users may not know professional jewellery vocabulary (“elegant vintage blue stone”). The page:

1. Guides them through **structured choices** (ring type, metal, stone, setting, band, finish, mood).
2. Lets them add a **natural-language design prompt** for emotion and detail.
3. Combines both into a **structured design brief** and FLUX-style generation prompts.
4. Outputs a **design pack** that feels like a real studio handoff — not a single AI wallpaper.

**Interview framing:** “Identify reads the catalogue; Design writes new catalogue language.” Extend identification; do not replace it.

---

## User flow (target)

```text
Choose ring features (+ optional details)
        ↓
Write design prompt (optional but encouraged)
        ↓
Review structured design brief          ← explicit step (partially implicit today)
        ↓
Generate concept sketch
        ↓
Generate realistic 3D-style render      ← say “3D-style”, not “exact CAD”
        ↓
Multi-angle views
        ↓
Lighting variations
        ↓
AI-estimated specifications (labelled as estimates)
        ↓
Refine → regenerate / edit brief
        ↓
Try This Ring On → Virtual Try-On (Module 3)
```

---

## Layout (implemented — mockup-inspired)

| Left (`ds-page-col--builder`) | Right (`ds-page-col--pack`, sticky on desktop) |
|------|--------|
| Quick-start presets, icon grids (§1), design prompt (§2), **Generate my design** | Tabbed design pack: Overview / Details / Specifications / Inspiration + **Next steps** sidebar |

Hero above the sheet: **Create your perfect ring.** + 4-step stepper (Design → Generate → Review → Try on) + decorative line-art SVG.

Visual reference: mockup PNG (May 2026); skin uses **HM brand tokens** (`--hm-brand`, `--hm-primary`, `--hm-cream`) — not mockup gold/serif palette. See `apps/web/src/app/design/design-studio.css`.

---

## Step 1 — Guided ring selection

Structured controls (chips today; dropdowns/cards acceptable if on-brand).

| Control | Role | Target examples |
|---------|------|-----------------|
| **Ring type** | Category | Engagement, wedding band, eternity; later halo, solitaire, signet, cluster |
| **Metal** | Colour / finish family | Yellow / white / rose gold, platinum |
| **Centre stone** | Shape (+ later gem type/colour) | Round, oval, emerald, pear, marquise, princess, cushion; “None” for plain bands |
| **Setting** | How stone is held | Solitaire, halo, bezel, claw, pavé, channel, three-stone |
| **Band profile** | Cross-section (HM vocabulary) | Court, D-shape, flat, half round, knife edge |
| **Band style** *(optional separate axis)* | Creative band description | Plain, slim, pavé shoulders, twisted, split shank, tapered, bold — may overlap setting; document clearly in UI |
| **Finish** | Surface | Polished, matte, brushed, hammered, milgrain |
| **Style mood** | Aesthetic | Classic, modern, vintage, minimalist, luxury, romantic, bold |
| **Optional details** | Richer brief | Hidden halo, engraving, side stones, matching band, mixed metal, milgrain — structured toggles or prompt |
| **Design prompt** | Creative direction | Free text, e.g. “vintage rose-gold engagement ring with oval sapphire, delicate diamond halo…” |

**Vocabulary rule:** Core labels align with SigLIP attribute groups in `apps/api/attributes/extractor.py`. Finish and mood are **design-brief-only** (not Analyse outputs). When expanding options, keep prompt banks and chip labels in sync.

---

## Step 2 — Design prompt

After structured fields, the user may write natural language for emotion, proportion, and details not covered by chips.

- **Field:** `DesignBrief.notes` — labelled **Tell us more about your idea** with `DESIGN_PROMPT_PLACEHOLDER` sample copy.
- **Merge order:** structured fields → `buildBriefSentence()` (customer) + `buildPromptTemplate()` / `sketchPromptTemplate()` (FLUX).

---

## Step 3 — Structured design brief

Example brief the UI should surface before or during generation:

```text
Ring type: Engagement ring
Metal: Rose gold
Centre stone: Oval sapphire
Setting: Halo with claw-set centre stone
Band: Slim pavé band
Finish: Polished
Style mood: Vintage luxury
Extra: Delicate proportions, romantic feel
```

**Implementers:** `buildBriefSentence()`, `specRowsFromBrief()`, and a dedicated brief review panel (not yet a separate step in the UI).

---

## Steps 4–9 — Design pack outputs

| Asset | Style | Prompt hook |
|-------|--------|-------------|
| **Concept sketch** | Pencil / hand-drawn on toned paper | `sketchPromptTemplate()` |
| **Studio render** | Photoreal product on neutral background | `buildPromptTemplate()` — label **“Realistic 3D-style render”** (not “exact CAD”) |
| **Multi-angle** | Front, side, back, other side (0/90/180/270) | fal FLUX multi-angle endpoint with numeric `horizontal_angle` from hero |
| **Lighting** | Warm tungsten, soft daylight (2–4 variants) | Kontext or secondary FLUX passes |
| **Specifications** | Categorical + AI-estimated dimensions | See below |

**Pack stages** (UI): `sketch` → `hero` → `angles` → `lighting` → `spec` — see `PACK_STAGES` in `design-brief.ts`.

---

## Step 8 — AI-estimated specifications

Show alongside visuals. **Always label as AI-estimated** — not manufacturing or CAD truth.

**Target fields (from TECH_STACK VLM schema):**

- Ring type, metal, centre stone, setting, band style, finish, style direction (from brief or analyse-on-render)
- Estimated band width (mm range)
- Estimated setting height (low / medium / high)
- Estimated visual weight (delicate / balanced / bold)
- Design complexity (low / medium / high)

**Today:** `specRowsFromBrief()` only echoes form choices — no mm ranges or derived estimates.

**Planned path:**

1. **Phase A:** Categorical specs from brief + disclaimer; run `POST /api/analyse` on generated hero for attribute agreement.
2. **Phase B:** VLM or extended SigLIP for dimensional estimates on the render.

---

## Step 9–12 — Refine, save, try-on

| Action | Status |
|--------|--------|
| **Regenerate** | UI: same brief, mock pipeline |
| **New brief** | UI: reset form |
| **NL refine** (“make band thinner”) | Not built — chip edit + regenerate is minimum viable |
| **Save / compare / download pack** | Not built |
| **Try This Ring On** | Button present, disabled — needs Module 3 + shared state (hero URL + brief JSON) |

Primary post-pack CTA: **Try This Ring On** (not generic “Download”).

---

## Implementation map (repo)

### Frontend (`apps/web`)

| Path | Role |
|------|------|
| `src/app/design/page.tsx` | Two-column orchestrator; **`runMockGeneration`** |
| `src/app/design/design-studio.css` | Mockup-inspired layout, icon grids, tabs, carousels |
| `src/lib/design-brief.ts` | Expanded `DesignBrief`, options, `estimatedSpecRows()` |
| `src/lib/design-pack-assets.ts` | Curated `/public/design/pack/*` URLs per preset/metal |
| `public/design/` | Pexels photos, SVG sketch, `ATTRIBUTION.md` |
| `src/components/design/DesignPageHero.tsx` | Hero + stepper |
| `src/components/design/DesignSteps.tsx` | 4-step progress (Design → Generate → Review → Try on) |
| `src/components/design/DesignBuilderColumn.tsx` | Left column wrapper |
| `src/components/design/DesignIconGrid.tsx` | Icon tile grids (single + multi) |
| `src/components/design/DesignBriefForm.tsx` | Sections 1–2 + generate CTA |
| `src/components/design/DesignPackPanel.tsx` | Right column: tabs, pack, sidebar actions |
| `src/components/design/design-icons.tsx` | Line SVG icons for grids |
| `src/components/design/DesignPackTechnical.tsx` | FLUX prompts (Inspiration tab) |

**Header:** `{ label: "Design", href: "/design", disabled: false }` in `Header.tsx`.

### Engine selection (Module 2, round 3)

`DESIGN_ENGINE` env var picks the backend:

| value | hero, sketch | angles, lighting | cost per pack | per-image latency |
|------|------|------|------|------|
| `fal` (recommended) | FLUX Dev by default (`DESIGN_HERO=dev`) | Numeric FLUX multi-angle for angles, Kontext Pro for lighting | varies by selected pack | Dev hero is slower; angle control uses explicit degree parameters |
| `fal-schnell` | FLUX Schnell | FLUX Schnell (img2img) | ~$0.05 | ~1 s |
| `fal-kontext` | FLUX Kontext Pro | FLUX Kontext Pro | ~$0.80 | ~3 s |
| `pollinations` (fallback) | Pollinations FLUX | Pollinations FLUX | $0 | 30 s to several minutes, variable |

For all `fal-*` engines, set `FAL_KEY` to a key from [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys). Without `FAL_KEY` the backend raises `fal_key_missing` on the first generation request, prompting the operator to fall back to Pollinations.

### Multi-angle turntable

The `angles` stage produces **4 cardinal frames** around the ring: 0, 90, 180, and 270 degrees. These are generated through fal's numeric multi-angle endpoint with `horizontal_angle`, then rendered via `<TurntableViewer />` with drag-to-rotate, keyboard arrows, and a degree overlay.

### Lighting variants

Four genuinely distinct illumination presets, each driven by a strong instruction prompt through FLUX Kontext: Soft Studio, Warm Tungsten, Natural Daylight, Luxury Dark.

### Live progress (results page)

Each stage exposes `progress_completed`, `progress_total`, `progress_label`, `started_at`, `duration_estimate_s`. The frontend `StageProgress` component renders one card per active stage with a live percentage that interpolates between server polls. The overall progress bar averages all active stages. A "Next up" badge highlights the next pending card.

### Backend (`apps/api/design/`) live

| File | Role |
|------|------|
| `engine.py` | `Engine` protocol + `PollinationsEngine` (free public FLUX endpoint, no key, httpx async). Swap to fal.ai by adding a `FalEngine` class and setting `DESIGN_ENGINE=fal`. |
| `pipeline.py` | Stage orchestrator: sketch → hero → angles → lighting → spec. Hero failures fail the whole job; angles/lighting are best-effort. |
| `prompts.py` | Server-side mirror of `buildPromptTemplate` / `sketchPromptTemplate` / `estimatedSpecRows` from [design-brief.ts](../apps/web/src/lib/design-brief.ts). |
| `jobs.py` | SQLite-backed job store (`generations`, `uploads` tables). WAL mode, single connection, threading.RLock around writes. |
| `router.py` | FastAPI router mounted at `/api/design/*`. |
| `schemas.py` | Pydantic v2 request/response models. |
| `storage.py` | Path helpers + path-traversal guard. |

Backing store: `apps/api/storage/generations.db` + image files under `apps/api/storage/packs/{job_id}/`. Inspiration originals under `apps/api/storage/uploads/{upload_id}/`.

### Endpoints

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/api/design/uploads` | Stores image, runs SigLIP, returns `{upload_id, filename, url, attributes[]}`. 8 MB max, image MIME only. |
| `DELETE` | `/api/design/uploads/{upload_id}` | Removes the file + DB row. |
| `GET` | `/api/design/uploads/{upload_id}/{filename}` | Path-guarded file serve. |
| `POST` | `/api/design/generate` | Body `{brief}` → returns `{job_id, design_id, status:"queued"}`, pipeline runs as BackgroundTask. |
| `GET` | `/api/design/generate/{job_id}` | Full snapshot for polling. |
| `POST` | `/api/design/generate/{job_id}/cancel` | Sets status=cancelled; pipeline exits at next stage boundary. |
| `GET` | `/api/design/assets/{job_id}/{filename}` | Path-guarded asset serve. |

### Inspiration conditioning

For each uploaded image, the SigLIP analyser (`apps/api/attributes/extractor.py`) extracts attributes (metal / setting / stone / band). For each group, the highest-scoring "top" label across all uploads is kept *only if the user didn't explicitly choose that field*. The surviving labels become a soft prompt clause: `Inspired by references: yellow gold tones, vintage feel.` Noise labels (`None`, `Plain band`, empty) are filtered.

### Frontend client + polling

- [apps/web/src/lib/design-api.ts](../apps/web/src/lib/design-api.ts) — typed client with `DesignApiError`.
- [apps/web/src/lib/design-job.ts](../apps/web/src/lib/design-job.ts) — `useDesignJob(jobId)` hook, 1.5 s polling, backoff to 3 s after 90 s.
- Session persistence: `localStorage["hm.design.session.v1"]` — wizard step, brief, current job id, results visibility. A page refresh mid-generation rehydrates and resumes polling.

### Validation

Single source of truth: `validateBrief()` in [design-brief.ts](../apps/web/src/lib/design-brief.ts). Returns `{ ok, canAdvance[1..4], firstInvalidStep, issues[1..4] }`. Wizard buttons and Generate CTA both consume it.

| Step | Required |
|------|----------|
| 1 | `ringType`, `metal`, `stone` (incl. `"None"`) |
| 2 | `setting` |
| 3 | `outputPack.length >= 1`, `notes.length <= 500`, `inspirationUploads.length <= 8` |
| 4 | All of the above |

### Out of scope this round (intentionally disabled with tooltip)

- Save Design / Share / Download Pack
- Save to Collection
- Try This Ring On (handoff to Module 3)
- Per-stage retry-only endpoint (today's Retry button re-runs the whole brief)

---

## UX / copy invariants (Design page)

- **Guided builder, not a chat box.** Primary path is chips + brief, not a single prompt field.
- **Customer pack vs technical detail.** FLUX prompts, model name, and raw latency stay in `<DesignPackTechnical>` (“Technical detail”), same pattern as Identify.
- **Wording:** “Realistic **3D-style** render”, “Concept sketch”, “**AI-estimated** specifications”.
- **No false manufacturing claims.** Never imply CAD accuracy or final mm without expert sign-off.
- **HM brand:** Korolev, sharp CTAs (`.btn-primary` / `.btn-ghost`), `design-studio.css` + shared `studio.css` tokens — no generic AI-dashboard chrome.
- **Presets are the stage script:** **Vintage sapphire halo** (mockup demo), Classic solitaire, Heavy court band, Modern pavé.

---

## Build order (recommended)

1. **Copy & IA** — Design prompt label, brief review panel, 3D-style / AI-estimated labels.
2. **Vocabulary** — Expand ring types, moods, optional details; clarify band profile vs band style.
3. **`POST /api/generate` + fal FLUX** — Replace `runMockGeneration`; distinct URLs per pack asset.
4. **Specs** — Analyse-on-hero + estimated fields with disclaimer.
5. **Try-on handoff** — Enable CTA with shared state to Module 3.
6. **Refine / save / compare** — After FLUX is live.

---

## Demo script (27 May)

1. Identify — sample or webcam match (spine).
2. Optional — Analyse on matched crop.
3. Design — `/design` → **Vintage sapphire halo** preset → **Generate my design** → Overview tab (sketch + 3D-style render, carousels).
4. **Specifications** tab for AI-estimated rows; **Inspiration** tab for FLUX prompts.

---

## Related docs

- [CLAUDE.md](../CLAUDE.md) — repo commands, global UX invariants, module status
- [TECH_STACK.md](../TECH_STACK.md) — fal.ai, Kontext, full module map
