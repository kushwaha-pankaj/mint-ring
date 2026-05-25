# Hockley Mint AI Ring Studio — Tech Stack Recommendation

> Framing for 27 May panel: "I continued working on the same prototype and added these features."
> The DINOv2 ring identification stays as the spine of the system; the three modules below extend it.

## Guiding Principles
1. **Demo in 8 days, full-time job at ComoTour** → favour hosted inference (fal.ai / Replicate) over self-hosting GPU.
2. **Show engineering rigour, not just wow** → confidence scores, "I don't know" thresholds, structured outputs everywhere.
3. **One repo, one app** → the existing `/Users/PankajKushwaha/BCU-Demo` becomes `apps/web` + `apps/api`; the existing DINOv2 + FAISS code lives unchanged in `apps/api/identification/`.

---

## Module → Model Map

### Module 1: Analyse & Visualise

**Step A — Identification (existing, KEEP AS-IS)**
- DINOv2-base (ViT-B/14) embeddings + FAISS cosine index
- Existing code from round 1 prototype
- Returns top-K with similarity scores + "unknown" threshold

**Step B — Attribute extraction (NEW)**
- **Primary: Qwen3-VL-Plus** via DashScope API or fal.ai
  - 4× cheaper than GPT-5 for vision, comparable accuracy on fine-grained product attributes
  - Supports JSON-schema structured output natively
- **Fallback: Claude Sonnet 4.6 vision** (already familiar to Pankaj from ComoTour)
- Schema: `{ring_type, stone_shape, setting_style, band_profile, metal_appearance, finish, design_mood, estimated_band_width_mm, estimated_setting_height_mm, visual_weight, complexity_score, confidence}`
- Run identification + VLM in parallel; show identification result first, attributes fill in ~2s later

**Step C — Multi-view visualisation (NEW)**
- **Primary: FLUX.1 Kontext [pro]** via fal.ai — image-to-image with reference preservation
  - Prompt patterns: "the same ring photographed from a 45° elevation studio angle", "the same ring in soft warm tungsten lighting", "macro close-up of the stone setting"
  - Per-image cost ~$0.04, latency 3–6s on warm pool
- **Why not Zero123/SyncDreamer/Wonder3D:** they're tuned for general 3D NVS on Objaverse-style objects. Rings are tiny, reflective, and high-frequency. Kontext preserves identity better on product imagery and is one HTTP call.
- Generate 6 variants per ring: front / side / top / 45° / macro-stone / lifestyle-on-velvet
- Cache aggressively by `(image_hash, prompt)` in Redis or just SQLite — most rings get viewed multiple times

**Step D — Hand-worn preview (handoff to Module 3)**

---

### Module 2: Design & Generate (NEW)

> **Product spec + implementation status:** [docs/DESIGN_PAGE.md](docs/DESIGN_PAGE.md)  
> **UI today:** `/design` in `apps/web` (mock pack); **API:** `/api/generate` not wired yet.

**Guided design form → structured brief**
- shadcn `Select` / `RadioGroup` for ring_type, metal, stone_shape, setting, band, finish, mood
- Free-text `Textarea` for prompt
- Server combines into a templated prompt: `"A {mood} {metal} {ring_type} engagement ring with a {stone_shape} {stone} center, {setting} setting, {band} band, {finish} finish. Studio product photography on a soft neutral background, sharp focus on the stone, ultra-detailed jewelry render."`

**Generation pipeline**
- **Primary: FLUX.1 [pro]** via fal.ai (text-to-image)
  - Better photorealism, prompt adherence, and metal/stone rendering than SDXL
  - ~$0.05/image, 4–7s warm
- **Optional layer: SDXL + Civitai jewelry LoRA** as a "stylistic alternative" toggle (mention in slides, do not block on it). Two relevant LoRAs:
  - civitai.com/models/473463 (Jewellery v1.0 — SDXL)
  - civitai.com/models/941375 (Creative Jewelry Design — SDXL)
- Multi-angle from the generated image: use fal's numeric multi-angle endpoint at 0/90/180/270 degrees → same downstream code path
- AI-estimated specs: feed generated image back through Qwen3-VL → same schema as Module 1

**Output: "Design Pack"**
- Concept sketch (FLUX with `"hand-drawn jewelry concept sketch, pencil on toned paper"` style prompt)
- Realistic render (main FLUX output)
- 4 multi-angle views
- 2 lighting variations
- Spec card
- All saved as one JSON record + image assets

---

### Module 3: Virtual Try-On (NEW)

**Step A — Hand detection**
- **MediaPipe Hands** (Tasks API in browser via JS or in Python on server)
  - 21-point landmark detection, identifies finger bases / knuckles for ring placement
  - Free, runs client-side in <100ms
- For "choose a model hand" option: ship 4–6 pre-shot stock hand images with landmarks pre-computed

**Step B — Placement**
- Compute target box from landmarks (between PIP and MCP joints of the chosen finger), estimate finger angle from the same two points
- Crop / mask region for inpainting

**Step C — Realistic compositing**
- **Primary: FLUX.1 Kontext [max] multi-reference** via fal.ai
  - Two reference images: ring + hand
  - Prompt: `"Place the ring naturally on the [finger] of the hand. Match lighting, scale to fit the finger, preserve the hand identity and ring identity. Photorealistic, soft studio lighting."`
- **Fallback: DCI-VTON-style** SD-inpaint pipeline if Kontext quality varies (don't build unless needed)
- **Why Kontext over MediaPipe-only compositing:** pure landmark placement looks pasted-on; Kontext blends lighting, casts soft shadow, and matches metal reflection to the hand's ambient light.

---

## Web Stack

### Frontend — `apps/web`
- **Next.js 15** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4** + **shadcn/ui** components
- **Framer Motion** for module transitions and result reveals
- **Zustand** for cross-module state (current ring → try-on handoff)
- **next-themes** off — the brand is a single light theme, don't add a toggle
- Image uploads via `react-dropzone`, hand-preview via `<video>` for webcam path
- Streaming results via Server-Sent Events from the API

### Backend — `apps/api`
- **FastAPI** + **uvicorn**, Python 3.11
- **Pydantic v2** models for request/response and the Ring Brief schema
- Existing DINOv2 / FAISS code lives in `apps/api/identification/` (zero changes)
- New routers: `/analyse`, `/visualise`, `/generate`, `/tryon`
- **Job queue:** start with `BackgroundTasks` + in-memory dict for status — only add Celery/Redis if a job exceeds 30s. Saves a day of plumbing.
- **fal-client** Python SDK for all generation calls
- **httpx** AsyncClient for VLM calls
- Storage: local filesystem under `apps/api/storage/` for the demo, S3-compatible interface if asked about scale

### Inference — fal.ai (single provider)
Decision: **standardise on fal.ai** instead of mixing Replicate/Modal.
- Lowest cold-start on FLUX (warm pool) — critical for live demo
- Per-image pricing, no GPU rental
- Single API key, one billing line
- ~$5–15 total for the entire demo prep + interview day

### Data
- **SQLite** for the demo (sessions, generations, ring catalogue) — file-based, zero ops
- The 4–5 pilot rings from the WeddingRing dataset stay on disk as before
- New: a `generations` table for the design pack history (so panel can scroll through "what I generated yesterday")

### Observability for the demo
- **Pydantic Logfire** or just structured `loguru` JSON logs
- Show the panel a tiny `/admin` page with: total generations, average latency per stage, confidence histogram for identification. This is the academic-rigour signal Gerald/Essa will respond to.

---

## What this stack deliberately does NOT include
- **No 3D engine.** Rings can be visualised in 6 angles via Kontext; full 3D is out of scope and would not finish in 8 days.
- **No fine-tuning.** Every model is used zero-shot or off-the-shelf. The single trained artifact remains the DINOv2 + FAISS index.
- **No auth.** Single-tenant demo. Panel signs in by opening the URL.
- **No Docker/k8s.** `uvicorn` + `next dev` for the demo; one Render or Railway deploy if you want a hosted URL to send beforehand.
- **No Celery/Redis.** Background tasks via FastAPI's built-in `BackgroundTasks` until something actually blocks longer than a request.

---

## Estimated build cost
- fal.ai inference (dev + demo): **£5–15**
- Hosting (optional Vercel + Render free tiers): **£0**
- Korolev font licence (optional, can substitute Space Grotesk free): **£0** for demo
- Total: **under £20**

---

## Sources
- [Hockley Mint website](https://www.hockleymint.co.uk) — brand
- [FLUX.1 Kontext on fal.ai](https://fal.ai/models/fal-ai/flux-pro/kontext) — image editing with reference
- [FLUX.2 multi-reference editor](https://fal.ai/models/fal-ai/flux-2-pro/edit) — multi-image conditioning
- [Qwen3-VL Plus review](https://tokenmix.ai/blog/qwen3-vl-plus-review-multimodal-2026) — VLM for attribute extraction
- [Best Open-Source VLMs 2026 (BentoML)](https://www.bentoml.com/blog/multimodal-ai-a-guide-to-open-source-vision-language-models)
- [fal.ai vs Replicate vs Modal 2026](https://apiscout.dev/guides/fal-ai-vs-replicate-vs-modal-2026)
- [Wonder3D++](https://arxiv.org/html/2511.01767v1), [SyncDreamer](https://arxiv.org/abs/2309.03453) — considered and rejected for ring use case
- [Virtual ring try-on with MediaPipe + CV (Pixa, ResearchGate paper)](https://www.researchgate.net/publication/379094873)
- [DCI-VTON diffusion inpainting](https://arxiv.org/pdf/2308.06101) — fallback approach
- [Civitai jewelry LoRAs](https://civitai.com/tag/jewelry) — optional SDXL layer
- [Next.js 15 + FastAPI production guide](https://dev.to/alexmayhew-dev/fastapi-nextjs-15-the-full-stack-nobodys-building-1hl9)
