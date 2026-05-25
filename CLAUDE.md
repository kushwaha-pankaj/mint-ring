# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Working build for Pankaj Kushwaha's BCU × Hockley Mint KTP second-stage interview on **27 May 2026**. The interview is a 10-minute self/projects presentation plus an optional 5-minute demo extending the round-1 ring identification prototype. Ribesh Maharjan (Hockley Mint) signalled informally that the extended demo should *augment*, not replace, the identification.

Two demos coexist here and **both must keep working**:

1. **Round-1 Streamlit prototype** at `scripts/demo.py` — ResNet50 + cosine NN over an NPZ gallery. This was the round-1 deliverable; do not touch its files unless explicitly asked.
2. **Round-2 monorepo studio** at `apps/` — a Next.js 16 frontend (`apps/web`) and a FastAPI backend (`apps/api`) that wraps the round-1 identification code and adds branded UI, sample picks, webcam capture, side-by-side match presentation, and a collapsed "research detail" panel for the academic panellists.

Roadmap context in [TECH_STACK.md](TECH_STACK.md). **Module status:** Identify + ring detection (live); **Analyse** (`POST /api/analyse`, SigLIP, Identify page); **Design** (UI at `/design`, mock generation — see [docs/DESIGN_PAGE.md](docs/DESIGN_PAGE.md)); Try on / 3D (not built).

## Commands

The default `python3` on this Mac is **3.9.6 and has no torch**. The ML stack is installed against **Python 3.14**, at a specific absolute path. Use it.

```bash
PY=/Library/Frameworks/Python.framework/Versions/3.14/bin/python3
```

### Run the monorepo studio (frontend + backend)

```bash
./run_studio.sh                # boots FastAPI on :8000 and Next.js on :3000
# Frontend: http://localhost:3000
# Health:   http://localhost:8000/api/health
```

**Memory-safe dev mode (macOS / Cursor).** On this machine, integrated terminals and dev tooling can accumulate memory quickly. Defaults are tuned to stay lean:

| Setting | Default | Why |
|---------|---------|-----|
| `run_studio.sh` uvicorn reload | **off** | `--reload` spawns a file watcher + second Python process. Enable only when editing backend code: `STUDIO_RELOAD=1 ./run_studio.sh` |
| MediaPipe HandLandmarker | **one singleton** | `detector.ts` and Try-on share `loadHandLandmarker()` in `mediapipe-hand.ts`. Never load a second `.task` model in parallel. |
| MediaPipe WASM logs | **filtered in browser** | glog lines from WASM are silenced once per tab in `mediapipe-hand.ts` so Next.js dev does not flood the terminal buffer. |
| `/api/detect-ring` | **no stdout spam** | Per-request bbox prints were removed; use browser devtools or `/api/health` instead. |
| Live AR / webcam | **stop on tab hide** | `Webcam.tsx` and `LiveAR.tsx` release camera tracks when the tab is hidden or the component unmounts. Stop live preview when not demoing. |

If Cursor shows "application memory" warnings: force-quit Cursor, kill stray `uvicorn`/`node` from Activity Monitor if `./run_studio.sh` was left running, reopen without restoring old terminal tabs, then `./run_studio.sh` again.

### Run the round-1 Streamlit demo (untouched)

```bash
./run_demo.sh                  # launches scripts/demo.py on the first free port from :8501
```

Both launchers can run simultaneously (different ports). The Streamlit demo has its own webcam path; the studio has its own.

### Backend only

```bash
$PY -m uvicorn apps.api.main:app --port 8000
# Add --reload only when actively editing backend Python:
# $PY -m uvicorn apps.api.main:app --reload --port 8000
```

### Frontend only

```bash
cd apps/web && npm run dev     # Next.js 16 + Turbopack
```

### Round-1 CLI (rebuild / evaluate gallery)

```bash
$PY scripts/prototype.py --gallery artifacts/gallery_resnet50.npz --query path/to/image.jpg
$PY scripts/prototype.py --gallery artifacts/gallery_resnet50.npz --evaluate data/test --threshold 0.55
$PY scripts/prototype.py --build-gallery data/reference --gallery artifacts/gallery_resnet50.npz --encoder resnet50
```

There are no automated tests yet. Smoke-test the studio by running `./run_studio.sh`, then exercising the sample picks, webcam, an upload, and a non-ring image (unknown path).

## Architecture (the big picture)

```
BCU-Demo/
├── apps/
│   ├── api/                            FastAPI backend (Python 3.14)
│   │   ├── main.py                     /api/health · /api/identify · /api/analyse · /api/detect-ring · …
│   │   ├── attributes/extractor.py     SigLIP attribute extraction (Analyse)
│   │   └── identification/             ← thin wrapper around round-1 code
│   │       ├── prototype.py            DO NOT MODIFY — round-1 ML, copied not duplicated
│   │       ├── artifacts → ../../../artifacts   (symlink)
│   │       └── data      → ../../../data        (symlink)
│   └── web/                            Next.js 16 + React 19 + Tailwind v4 + Turbopack
│       └── src/
│           ├── app/
│           │   ├── globals.css         brand tokens + .btn-primary / .btn-ghost utilities
│           │   ├── studio.css          HM-style bespoke component CSS (Identify)
│           │   ├── layout.tsx          mounts <Header /> and <Footer />
│           │   ├── page.tsx            Identify page; useState orchestrator + 3-step stepper
│           │   └── design/             Module 2 — guided design builder (see docs/DESIGN_PAGE.md)
│           │       ├── page.tsx        brief form + mock design pack generation
│           │       ├── layout.tsx      loads design-studio.css
│           │       └── design-studio.css
│           ├── components/             Header, Footer, Hero, UploadPanel, Webcam, Analysis,
│           │                          SamplePicks, ResultDisplay, MatchDetails, RingThumb
│           │       design/             DesignHero, DesignBriefForm, DesignPackDisplay, …
│           └── lib/
│               ├── api.ts              identifyRing, analyseRing, getHealth, referenceImageUrl, …
│               ├── catalogue.ts        SKU (WAM5-Y) → friendly RingMeta (name / subtitle / metal)
│               ├── design-brief.ts     DesignBrief, presets, FLUX prompt builders, pack stages
│               └── sample.ts           three pre-curated samples for one-click demo on stage
├── scripts/                            ROUND-1 — Streamlit demo + CLI + dataset splitter
├── artifacts/                          gallery_resnet50.npz, gallery_dinov2.npz, results JSON
├── data/                               reference/, val/, test/ (image folders, one folder per class)
├── dataset_raw/WeddingRing Dataset/    raw 900 frames + per-class MP4 (untouched input)
├── plots/                              t-SNE + confusion matrices used by Streamlit demo
├── brand/                              Hockley Mint logo SVG + verified brand-tokens.md
├── run_demo.sh                         round-1 launcher
├── run_studio.sh                       monorepo launcher
├── TECH_STACK.md                       full roadmap incl. Modules 2-5
└── round1-backup-*.zip                 immutable pre-Step-0 backup
```

### Critical request flow

`POST /api/identify` ⇒ FastAPI re-uses `apps/api/identification/prototype.py` directly (via `sys.path` injection at startup). The Gallery + encoder load **once** at app startup (`@app.on_event("startup")`); each request is ~40 ms. Round-1 already evaluated this: **top-1 83.9 %, top-3 94.8 %** on 459 held-out images at threshold 0.55.

`GET /api/reference-image?path=<rel>` is **path-traversal-guarded**: it only serves files inside `data/reference/` or `data/test/`. The frontend uses this to display the matched reference photo and "Also available in" siblings without giving the browser arbitrary filesystem access. Any change here must preserve the `_is_within` check.

### Identification is encoder-locked

`Gallery.encoder_name` is persisted inside the NPZ file. The API picks the encoder from the gallery — **never mix embeddings from different encoders** (DINOv2 underperforms ResNet50 here by ~33 percentage points on top-1, which surprised the round-1 author; the DINOv2 NPZ is kept only as a baseline artifact). If you rebuild the gallery, delete the old NPZ first or change its name.

### Dataset is symlinked, not duplicated

`apps/api/identification/{artifacts,data}` are symlinks to the repo-root `artifacts/` and `data/`. Don't `cp -R` them. Don't delete the symlinks. The round-1 Streamlit demo still reads from the same root paths.

## UI / UX invariants

- **No em dashes in user-facing copy.** Do not use `—` or `–` in UI strings, headings, hints, validation messages, or button labels. Use a full stop, comma, colon, or parentheses instead. (Code comments and internal docs may use normal punctuation.)
- **Bespoke, premium visual direction — not generic AI UI.** The studio must not look like a default chatbot or template dashboard: no robotic copy, no failure-tone “review needed” states, no washed-out alternate card chrome when scores dip, and no plain stacked cards that could pass for Claude-generated layouts. Use the existing HM token system (`studio.css`, Korolev, sharp CTAs), intentional hierarchy, and consistent spacing. Components, typography, and messaging must stay aligned across loading, match, and error states.
- **Catalogue result: threshold is a real acceptance gate.** `/api/identify` must only return threshold-qualified reference images in `top_k` and threshold-qualified design aggregates in `class_scores`. If no reference image passes the active threshold, do not show a nearest-match catalogue card or fallback product image; show the no-match state and keep the shortlist empty. When a match passes, use the same premium `ResultDisplay` card styling and positive copy (`src/lib/catalogue-match.ts`).
- **Customer view by default, research view on demand.** Cosine values, encoder names, latency, and per-neighbour tables live behind `<MatchDetails>` (“Technical detail”) or operator tooling (`MatchShortlist`, `MatchControls`). The main catalogue card may show a single friendly similarity percentage for accepted matches only.
- **SKU translation.** Use `ringFromSku()` from `src/lib/catalogue.ts` before showing any SKU to a viewer. Raw codes (`WAM5-Y`) only appear as a tiny tag next to the friendly name.
- **"Also available in"** comes from `siblingsByMetal()` — same design family, different metals. Real Hockley Mint commercial pattern, not a contrived top-K display.
- **Empty / unknown / error states are empathetic copy.** Never "below threshold." Use "We couldn't find this ring," with two suggested next actions.

### Design page (`/design`) — guided ring design builder

Full product spec, file map, and build order: **[docs/DESIGN_PAGE.md](docs/DESIGN_PAGE.md)**.

- **Not an image generator.** Structured jewellery choices first (Steps 1–2), optional **design prompt** + inspiration images (Step 3), then **Review & Generate** (Step 4) produces a real **design pack** (sketch → 3D-style render → angles → lighting → specs).
- **Not the same as Analyse.** Identify’s “Design analysis” (`Analysis.tsx`, `/#design-analysis`) reads a **photo** via `/api/analyse`. `/design` **creates** new concepts (Module 2).
- **Generation engine.** Default `DESIGN_ENGINE=pollinations` (free, public Pollinations.ai FLUX endpoint, no key). Swap to fal.ai later via the `Engine` interface in [apps/api/design/engine.py](apps/api/design/engine.py). Latency: ~5 s sketch, 30–90 s hero depending on Pollinations load.
- **Inspiration conditioning.** Uploaded images are routed through the existing SigLIP attribute extractor; the highest-scoring attributes that the user *didn’t* explicitly choose are injected as a soft "Inspired by references: …" clause in the FLUX prompt.
- **Persistence.** SQLite at `apps/api/storage/generations.db`; image bytes under `apps/api/storage/packs/{job_id}/`. Frontend mirrors the current session in `localStorage["hm.design.session.v1"]` so a refresh mid-generation rehydrates and continues polling.
- **Out of scope (this round).** Save Design / Share / Download Pack / Save to Collection / Try This Ring On are intentionally **disabled** with a "Coming in a later release" tooltip. Do not re-enable until those modules ship.
- **Copy:** "realistic **3D-style** render", "**AI-estimated**" specs — never imply exact CAD or manufacturing mm.
- **Customer vs technical:** Pack gallery is customer-facing; FLUX prompts and latency live in `<DesignPackTechnical>`.

### Design API surface

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/design/uploads` | Multipart inspiration upload; returns `{upload_id, filename, url, attributes}`. Runs SigLIP synchronously. |
| `DELETE` | `/api/design/uploads/{upload_id}` | Remove an inspiration before generation. |
| `GET` | `/api/design/uploads/{upload_id}/{filename}` | Serve the stored inspiration (path-traversal-guarded). |
| `POST` | `/api/design/generate` | Body: `{brief: DesignBrief}`. Validates, creates job row, kicks pipeline as a BackgroundTask, returns `{job_id, design_id, status:"queued"}`. |
| `GET` | `/api/design/generate/{job_id}` | Job snapshot — per-stage status, asset URLs, prompt, inspiration attributes, error. Frontend polls every 1.5–3 s. |
| `POST` | `/api/design/generate/{job_id}/cancel` | Marks the job cancelled; pipeline exits at the next stage boundary. |
| `GET` | `/api/design/assets/{job_id}/{filename}` | Serve a generated asset (path-traversal-guarded — restricted to `apps/api/storage/packs/{job_id}/`). |

Env vars (see `apps/api/.env.example`):

```
# pollinations (free, slow), fal-schnell, fal-kontext, fal (composite)
DESIGN_ENGINE=fal
POLLINATIONS_BASE=https://image.pollinations.ai/prompt
FAL_KEY=fal_xxxx
```

Engine routing inside `DESIGN_ENGINE=fal`:
- hero, sketch -> FLUX.1 Schnell, $0.003/MP, sub-second
- 12 turntable angles, 4 lighting variants -> FLUX.1 Kontext Pro, $0.04/image, identity-preserving edit
- Approx cost: $0.65 per full pack. About $20 for 30 demo runs.

The frontend results page shows a live per-stage percentage bar, a "Next up" badge on the pending stage, and a drag-to-rotate 12-frame turntable that shows the current degree label (0, 30, 45, 90, 180, etc.) as an overlay.

## Brand system

Verified directly from `hockleymint.co.uk/assets/css2025/style.css` and `header.css` (see `brand/brand-tokens.md`):

| Token | Value | Use |
|---|---|---|
| `--hm-ink` | `#1D1813` | Body text, fixed header background |
| `--hm-brand` | `#003D22` | Hero bands, secondary surfaces |
| `--hm-primary` | `#00A478` | CTAs, eyebrow labels, active states |
| `--hm-cream` | `#F7F6F4` | Soft surface (paper-soft) |
| `--hm-line` | `rgb(0 0 0 / 0.07)` | Hairlines (always — not `#DDD`) |
| `--hm-line-strong` | `rgb(0 0 0 / 0.14)` | Stronger hairline |

- **Font:** Korolev (Klim Type Foundry). Self-hosted .woff files live in `apps/web/public/fonts/`. There is **no licensed Korolev copy** here for production — use it for the demo and the slide deck on the day, but flag licensing as a production task.
- **Buttons:** sharp-cornered (`border-radius: 0`), padding `15px 30px`, primary fills `--hm-primary`. Use `.btn-primary` / `.btn-ghost` from `globals.css`. **Do not introduce `rounded-2xl` on CTAs.**
- **Header:** fixed, 80 px, dark `--hm-ink`, three-column grid `1fr auto 1fr` (menu / logo / CTA), uppercase letter-spaced links.
- **Eyebrow labels** use the `.thread` and `.eyebrow` classes — 1.4 rem Korolev Light, letter-spaced, primary green.

When adding components, prefer extending `studio.css` over inventing Tailwind utility soup. The styling system is class-based and already has tokens for spacing and rhythm.

## What NOT to break

- `scripts/`, `artifacts/`, `data/`, `dataset_raw/`, `plots/`, `run_demo.sh`, `requirements.txt` — round-1 demo. Untouched and runnable.
- `apps/api/identification/prototype.py` — copied verbatim from round-1; do not refactor.
- The two symlinks at `apps/api/identification/{artifacts,data}`.
- `round1-backup-*.zip` — immutable safety net.
- The reference-image endpoint's path-traversal guard.

## Roadmap pointer

| Module | Status |
|--------|--------|
| **Identify** | Live — ResNet50 gallery, `/api/identify`, studio UI |
| **Analyse** | Live on Identify — SigLIP `/api/analyse`, `Analysis.tsx` |
| **Design** | Live `/api/design/*`. Hero-anchored pipeline: FLUX Schnell for hero+sketch, FLUX Kontext Pro for 12-frame turntable and 4 lighting variants. SigLIP-conditioned prompts on uploaded inspirations. Per-stage live progress on the results page, drag-to-rotate turntable viewer. Pollinations stays as the free offline fallback. See [docs/DESIGN_PAGE.md](docs/DESIGN_PAGE.md). |
| **Try on** | Not built — MediaPipe + FLUX Kontext (Module 3) |
| **3D** | Out of demo scope — see [TECH_STACK.md](TECH_STACK.md) |

Nav: **Design** → `/design` (enabled). **Try on** → `/try-on` (enabled; shares `design-studio.css`, Playfair hero, `ds-page` layout). **3D** remains a placeholder in `<Header>` until that module ships.

## Memory

Project memory is at `~/.claude/projects/-Users-PankajKushwaha-BCU-Demo/memory/` — read `user_profile.md` and `bcu_ktp_interview.md` before answering anything about Pankaj's role, the interview, or the KTP narrative.
