"""
Streamlit demo for the ring identification prototype.

PURPOSE
-------
A browser-based UI for the same pipeline that scripts/prototype.py runs on
the command line. Lets you:
  - pick a test image from a thumbnail grid (per class)
  - or upload an arbitrary image
  - or capture a frame from the laptop webcam (browser-native, no extra deps)
  - see the prediction, confidence, and top-k nearest reference matches
  - switch between encoders (ResNet50 / DINOv2) and watch the metrics shift
  - drag the confidence threshold and watch "unknown" rejections appear/disappear
  - view the embedding-space t-SNE plot and the confusion matrix in tabs

LAYOUT (Identify tab)
---------------------
The Result card renders ABOVE the thumbnail grid so the prediction is in
view as soon as a thumbnail is clicked — no scrolling past the grid to see
the answer. Threshold + top-k sliders sit in a compact controls strip
right under the title so they're always discoverable (the sidebar may be
collapsed). A small scroll-into-view script fires once per pick. The
upload and webcam-capture controls live in sibling expanders beneath the
grid — they're additional input sources that feed the same Result card.

RUN
---
    streamlit run scripts/demo.py
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
import streamlit as st
from PIL import Image, ImageOps


# ===========================================================================
# 1. PATH SETUP + PROTOTYPE IMPORT
# ===========================================================================

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))

from prototype import Gallery, load_encoder, load_image, embed_image, predict  # noqa: E402

ARTIFACTS = ROOT / "artifacts"
DATA = ROOT / "data"
PLOTS = ROOT / "plots"

GALLERIES = {
    "ResNet50": ARTIFACTS / "gallery_resnet50.npz",
    "DINOv2 ViT-S/14": ARTIFACTS / "gallery_dinov2.npz",
}
RESULTS = {
    "ResNet50": ARTIFACTS / "results_resnet50.json",
    "DINOv2 ViT-S/14": ARTIFACTS / "results_dinov2.json",
}

IMG_EXTS = {".png", ".jpg", ".jpeg"}


# ===========================================================================
# 2. CACHED LOADERS
# ===========================================================================

@st.cache_resource(show_spinner="Loading gallery and encoder...")
def get_gallery_and_encoder(encoder_choice: str):
    gallery = Gallery.load(GALLERIES[encoder_choice])
    model, preprocess, dim = load_encoder(gallery.encoder_name)
    return gallery, model, preprocess, dim


@st.cache_data
def load_results(encoder_choice: str) -> dict | None:
    p = RESULTS[encoder_choice]
    return json.loads(p.read_text()) if p.exists() else None


def list_test_images() -> dict[str, list[Path]]:
    """
    Re-scan data/test/ on every rerun. Deliberately NOT @st.cache_data: the
    folder contents can change between runs (re-split, dedup experiments,
    manual file moves) and a stale cache would surface as a
    MediaFileStorageError when Streamlit tries to read a thumbnail that
    no longer exists.
    """
    test_dir = DATA / "test"
    if not test_dir.exists():
        return {}
    out = {}
    for class_dir in sorted(p for p in test_dir.iterdir() if p.is_dir()):
        imgs = sorted(p for p in class_dir.iterdir() if p.suffix.lower() in IMG_EXTS)
        if imgs:
            out[class_dir.name] = imgs
    return out


# ===========================================================================
# 3. PAGE SETUP + GLOBAL CSS
# ===========================================================================

st.set_page_config(
    page_title="ring-id",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Theme-agnostic styles (work in both light and dark macOS appearance).
# Single accent: muted slate blue #3a6ea8.
st.markdown("""
<style>
/* ---------- typography ---------- */
html, body, [data-testid="stAppViewContainer"], [data-testid="stMarkdownContainer"] {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter",
               system-ui, sans-serif;
}
/* App title — override Streamlit's heavy default H1 */
[data-testid="stMarkdownContainer"] h1,
[data-testid="stHeading"] h1 {
  font-weight: 600 !important;
  font-size: 26px !important;
  letter-spacing: -0.02em !important;
  margin-top: 0 !important;
  margin-bottom: 4px !important;
}
h2 { font-weight: 600; font-size: 18px; letter-spacing: -0.01em; margin-bottom: 8px; }
h3, h4, h5 { font-weight: 600; letter-spacing: -0.01em; margin-bottom: 6px; }
h5 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.6px;
     color: rgba(128,128,128,0.85); font-weight: 600; }
p, li { font-size: 14px; line-height: 1.55; }

section[data-testid="stSidebar"] h2 {
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 11px !important;
  font-weight: 600;
  color: rgba(128,128,128,0.9);
  margin-bottom: 12px;
}

/* ---------- main content padding ---------- */
[data-testid="stMainBlockContainer"] {
  padding-top: 32px;
  max-width: 1200px;
}

/* ---------- dividers ---------- */
hr {
  border: none;
  border-top: 1px solid rgba(128,128,128,0.15);
  margin: 18px 0;
}

/* ---------- buttons ---------- */
.stButton > button {
  background: transparent;
  border: 1px solid rgba(128,128,128,0.25);
  border-radius: 6px;
  padding: 4px 14px;
  font-weight: 500;
  font-size: 13px;
  transition: border-color 120ms ease, background 120ms ease, color 120ms ease;
}
.stButton > button:hover {
  border-color: rgba(58,110,168,0.7);
  background: rgba(58,110,168,0.08);
  color: inherit;
}
.stButton > button:focus-visible {
  outline: 2px solid #3a6ea8;
  outline-offset: 2px;
}
.stButton > button[kind="primary"],
.stButton > button:active {
  background: rgba(58,110,168,0.14);
  border-color: #3a6ea8;
}

/* Run buttons under thumbnails are smaller to compress grid height */
.thumb-grid .stButton > button {
  padding: 3px 8px;
  font-size: 12px;
  border-radius: 5px;
}

/* ---------- thumbnails ---------- */
[data-testid="stImage"] img {
  border: 1px solid rgba(128,128,128,0.18);
  border-radius: 5px;
  transition: border-color 120ms ease;
}
[data-testid="stImage"] img:hover {
  border-color: rgba(58,110,168,0.55);
}

/* ---------- progress bars ---------- */
[data-testid="stProgressBar"] > div > div {
  background: rgba(128,128,128,0.12);
  height: 6px;
  border-radius: 3px;
}
[data-testid="stProgressBar"] > div > div > div {
  background: #3a6ea8;
  border-radius: 3px;
}

/* ---------- captions ---------- */
[data-testid="stCaptionContainer"], .stCaption {
  font-size: 12px;
  color: rgba(128,128,128,0.85);
}

/* ---------- tabs ---------- */
[data-baseweb="tab"] {
  font-weight: 500;
  font-size: 14px;
  padding: 8px 16px;
}
[data-baseweb="tab-highlight"] {
  background: #3a6ea8 !important;
  height: 2px !important;
}

/* ---------- sidebar metric tighter ---------- */
[data-testid="stMetric"] [data-testid="stMetricLabel"] {
  margin-bottom: 2px;
}

/* ---------- controls strip ---------- */
.controls-strip {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 10px 14px;
  border: 1px solid rgba(128,128,128,0.18);
  border-radius: 8px;
  background: rgba(128,128,128,0.04);
  margin-bottom: 18px;
}
.controls-strip .label-cell {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: rgba(128,128,128,0.85);
  font-weight: 600;
}

/* Slim down the slider widget inside the controls strip */
[data-testid="stMainBlockContainer"] .stSlider [data-baseweb="slider"] {
  padding-top: 6px;
  padding-bottom: 6px;
}

/* ---------- prediction card ---------- */
.pred-card {
  border: 1px solid rgba(128,128,128,0.20);
  border-radius: 10px;
  padding: 18px 22px;
  margin-bottom: 20px;
  background: rgba(128,128,128,0.025);
}
.pred-card-empty {
  min-height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: rgba(128,128,128,0.7);
  font-size: 13px;
  gap: 6px;
}
.pred-card-empty .empty-title {
  font-size: 15px;
  font-weight: 500;
  color: rgba(128,128,128,0.95);
}

/* ---------- confidence gauge ---------- */
.conf-gauge {
  position: relative;
  height: 10px;
  background: rgba(128,128,128,0.14);
  border-radius: 5px;
  margin: 8px 0 6px 0;
  overflow: visible;
}
.conf-gauge-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(90deg, rgba(58,110,168,0.6) 0%, #3a6ea8 100%);
  border-radius: 5px;
}
.conf-gauge-fill--bad {
  background: linear-gradient(90deg, rgba(196,69,69,0.4) 0%, #c44545 100%);
}
.conf-gauge-marker {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  background: rgba(128,128,128,0.85);
}
.conf-gauge-marker::after {
  content: "threshold";
  position: absolute;
  top: -16px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: rgba(128,128,128,0.85);
  font-weight: 500;
  white-space: nowrap;
}
.conf-gauge-scale {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: rgba(128,128,128,0.7);
  margin-top: 2px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
.conf-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}
.conf-row .conf-value {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 18px;
  font-weight: 600;
  color: #3a6ea8;
}
.conf-row .conf-value--bad { color: #c44545; }
.conf-row .conf-label { font-size: 12px; color: rgba(128,128,128,0.85); }

/* ---------- prediction badge ---------- */
.pred-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 6px;
  font-weight: 500;
  font-size: 14px;
  margin-bottom: 8px;
}
.pred-badge--ok  { background: rgba(47,122,62,0.12);  color: #2f7a3e; border: 1px solid rgba(47,122,62,0.35); }
.pred-badge--bad { background: rgba(196,69,69,0.12);  color: #c44545; border: 1px solid rgba(196,69,69,0.35); }
.pred-badge--unk { background: rgba(128,128,128,0.10); color: rgba(128,128,128,0.95); border: 1px solid rgba(128,128,128,0.30); }
.pred-badge--info{ background: rgba(58,110,168,0.12); color: #3a6ea8; border: 1px solid rgba(58,110,168,0.35); }
.pred-badge .pred-id   { font-weight: 600; font-family: ui-monospace, "SF Mono", Menlo, monospace; }

/* ---------- top-k tiles ---------- */
.tk-tile {
  border: 1px solid rgba(128,128,128,0.18);
  border-left: 3px solid rgba(128,128,128,0.18);
  border-radius: 6px;
  padding: 6px;
  margin-bottom: 4px;
  background: rgba(128,128,128,0.02);
}
.tk-tile--ok  { border-left-color: #2f7a3e; }
.tk-tile--bad { border-left-color: #c44545; }
.tk-pill {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 6px;
  font-size: 12px;
}
.tk-pill .tk-label { font-weight: 500; }
.tk-pill .tk-sim {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11px;
  color: rgba(128,128,128,0.85);
}
.tk-tile [data-testid="stImage"] img {
  border: none;
  border-radius: 3px;
}
.tk-rank {
  font-size: 10px;
  color: rgba(128,128,128,0.7);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding-bottom: 2px;
}
</style>
""", unsafe_allow_html=True)


st.title("Ring identification")
st.caption(
    "Embedding-based retrieval on the WeddingRing dataset · 9 classes · "
    "~100 synthetic frames per class · encoder frozen, no training."
)


# ===========================================================================
# 4. CONTROLS STRIP (main area, above tabs)
# ===========================================================================
# Always-visible: encoder choice, threshold, top-k. None of these live in the
# sidebar — the sidebar starts collapsed and we want every interactive
# control discoverable without expanding it.
# ===========================================================================

available_encoders = [k for k, v in GALLERIES.items() if v.exists()]
if not available_encoders:
    st.error("No galleries found in artifacts/. Run prototype.py --build-gallery first.")
    st.stop()

st.markdown('<div class="controls-strip">', unsafe_allow_html=True)
ctrl_a, ctrl_b, ctrl_c = st.columns([3, 2, 2])
with ctrl_a:
    st.markdown('<div class="label-cell">Encoder model</div>', unsafe_allow_html=True)
    encoder_choice = st.radio(
        "Encoder",
        available_encoders,
        index=0,
        horizontal=True,
        label_visibility="collapsed",
        help="Pretrained image encoder used to embed both gallery and query.",
    )
with ctrl_b:
    st.markdown('<div class="label-cell">Confidence threshold</div>', unsafe_allow_html=True)
    threshold = st.slider(
        "Confidence threshold",
        min_value=0.0, max_value=1.0, value=0.55, step=0.01,
        label_visibility="collapsed",
        help="Predictions below this value are returned as 'unknown'.",
    )
with ctrl_c:
    st.markdown('<div class="label-cell">Top-k neighbours</div>', unsafe_allow_html=True)
    top_k = st.slider(
        "Top-k",
        1, 10, 5, 1,
        label_visibility="collapsed",
        help="How many nearest gallery images to aggregate over.",
    )
st.markdown('</div>', unsafe_allow_html=True)

gallery, model, preprocess, dim = get_gallery_and_encoder(encoder_choice)

# Compact info row beneath the controls: gallery summary + headline metrics
# for the currently selected encoder.
rep = load_results(encoder_choice)
info_parts = [
    f"Gallery · {len(gallery.labels)} embeddings · {len(gallery.classes)} classes · dim={dim}",
]
if rep:
    info_parts.append(f"Top-1 {rep['top1_accuracy']*100:.1f}%")
    info_parts.append(f"Top-3 {rep['top3_accuracy']*100:.1f}%")
    info_parts.append(f"n={rep['n_total']}")
st.caption(" · ".join(info_parts))


# ===========================================================================
# 6. TABS
# ===========================================================================

tab_identify, tab_space, tab_matrix, tab_about = st.tabs([
    "Identify",
    "Embedding space",
    "Confusion matrix",
    "About",
])


# ---------------------------------------------------------------------------
# Tab 1: Identify — Result card above the grid
# ---------------------------------------------------------------------------

def render_conf_gauge(confidence: float, threshold: float, accepted: bool) -> str:
    """
    Return HTML for a horizontal gauge showing where the predicted confidence
    sits relative to the threshold.
    """
    pct = max(0.0, min(1.0, confidence)) * 100
    t_pct = max(0.0, min(1.0, threshold)) * 100
    fill_class = "conf-gauge-fill" if accepted else "conf-gauge-fill conf-gauge-fill--bad"
    return (
        f'<div class="conf-gauge">'
        f'<div class="{fill_class}" style="width:{pct:.1f}%;"></div>'
        f'<div class="conf-gauge-marker" style="left:{t_pct:.1f}%;"></div>'
        f'</div>'
        f'<div class="conf-gauge-scale">'
        f'<span>0.00</span><span>0.50</span><span>1.00</span>'
        f'</div>'
    )


with tab_identify:
    # ---- Stage 1: resolve the current pick (if any) ----
    pil = None
    true_label = None
    query_caption = ""

    test_images = list_test_images()

    picked = st.session_state.get("picked_path")
    if picked and Path(picked).exists():
        pil = load_image(Path(picked))
        true_label = st.session_state.get("picked_label")
        query_caption = f"true label: {true_label} · file: {Path(picked).name}"
    elif picked:
        # The previously-picked file has been deleted (re-split, dedup, etc.).
        # Drop the stale reference so the empty Result card shows cleanly.
        st.session_state["picked_path"] = None
        st.session_state["picked_label"] = None

    # Anchor for the scroll-into-view JS below.
    st.markdown('<div id="pred-anchor"></div>', unsafe_allow_html=True)

    # ---- Stage 2: render the Result card ----
    if pil is None:
        st.markdown(
            '<div class="pred-card">'
            '<div class="pred-card-empty">'
            '<div class="empty-title">No image selected</div>'
            '<div>Pick a thumbnail below or upload an image to identify.</div>'
            '</div>'
            '</div>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown('<div class="pred-card">', unsafe_allow_html=True)

        with st.spinner("Embedding query and searching gallery..."):
            query_vec = embed_image(pil, model, preprocess)
            pred = predict(query_vec, gallery, top_k=top_k, threshold=threshold)

        col_q, col_pred = st.columns([1, 2])

        with col_q:
            st.markdown("##### Query")
            st.image(pil, width=200)
            st.caption(query_caption)

        with col_pred:
            st.markdown("##### Prediction")

            # Prediction badge
            if pred.ring_id is None:
                st.markdown(
                    f'<div class="pred-badge pred-badge--unk">'
                    f'<span>unknown</span>'
                    f'<span style="font-size:11px;opacity:0.8;">below threshold</span>'
                    f'</div>',
                    unsafe_allow_html=True,
                )
            else:
                if true_label is None:
                    bclass, suffix = "pred-badge--info", ""
                elif pred.ring_id == true_label:
                    bclass, suffix = "pred-badge--ok", "correct"
                else:
                    bclass, suffix = "pred-badge--bad", f"incorrect · true: {true_label}"
                badge_extra = f'<span style="font-size:11px;opacity:0.85;">{suffix}</span>' if suffix else ""
                st.markdown(
                    f'<div class="pred-badge {bclass}">'
                    f'<span class="pred-id">{pred.ring_id}</span>'
                    f'{badge_extra}'
                    f'</div>',
                    unsafe_allow_html=True,
                )

            # Confidence value + gauge
            accepted = pred.ring_id is not None
            value_class = "conf-value" if accepted else "conf-value conf-value--bad"
            st.markdown(
                f'<div class="conf-row">'
                f'<span class="{value_class}">{pred.confidence:.4f}</span>'
                f'<span class="conf-label">confidence · threshold {threshold:.2f}</span>'
                f'</div>'
                f'{render_conf_gauge(pred.confidence, threshold, accepted)}',
                unsafe_allow_html=True,
            )

            st.markdown("##### Per-class mean similarity in top-k")
            by_class = defaultdict(list)
            for lbl, sim, _ in pred.top_k:
                by_class[lbl].append(sim)
            aggregated = sorted(
                ((c, float(np.mean(s)), len(s)) for c, s in by_class.items()),
                key=lambda kv: -kv[1],
            )
            for cls, mean_sim, n in aggregated:
                st.progress(
                    float(np.clip(mean_sim, 0, 1)),
                    text=f"{cls} · {mean_sim:.4f} · {n}/{top_k} hits",
                )

        # ---- Top-k tiles row ----
        st.markdown("##### Top-k nearest reference images")
        cols = st.columns(min(top_k, 5))
        for i, (lbl, sim, path) in enumerate(pred.top_k):
            col = cols[i % len(cols)]
            with col:
                is_correct = (true_label is None) or (lbl == true_label)
                tile_class = "tk-tile tk-tile--ok" if is_correct else "tk-tile tk-tile--bad"
                st.markdown(
                    f'<div class="{tile_class}">'
                    f'<div class="tk-rank">#{i+1}</div>',
                    unsafe_allow_html=True,
                )
                try:
                    st.image(Image.open(path).convert("RGB"), width="stretch")
                except Exception:
                    st.text("(image missing)")
                st.markdown(
                    f'<div class="tk-pill">'
                    f'<span class="tk-label">{lbl}</span>'
                    f'<span class="tk-sim">{sim:.4f}</span>'
                    f'</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

        st.markdown('</div>', unsafe_allow_html=True)

    # ---- Scroll-into-view (one-shot per pick) ----
    if st.session_state.get("just_picked"):
        st.markdown(
            '<script>'
            "const el = window.parent.document.getElementById('pred-anchor');"
            "if (el) el.scrollIntoView({block:'start', behavior:'smooth'});"
            '</script>',
            unsafe_allow_html=True,
        )
        st.session_state["just_picked"] = False

    st.divider()

    # ---- Stage 3: class selector + thumbnail grid ----
    if test_images:
        class_pick = st.selectbox("Ring class", list(test_images.keys()))

        all_imgs = test_images[class_pick]
        PER_PAGE = 18
        n_pages = max(1, (len(all_imgs) + PER_PAGE - 1) // PER_PAGE)
        page_key = f"page_{class_pick}"
        if page_key not in st.session_state:
            st.session_state[page_key] = 0
        page = st.session_state[page_key]

        c_prev, c_label, c_next = st.columns([1, 4, 1])
        with c_prev:
            if st.button("Prev", disabled=(page <= 0), key=f"prev_{class_pick}"):
                st.session_state[page_key] = max(0, page - 1)
                st.rerun()
        with c_label:
            st.caption(
                f"{page * PER_PAGE + 1}-{min((page + 1) * PER_PAGE, len(all_imgs))} "
                f"of {len(all_imgs)} test images for {class_pick}. Click a thumbnail to run."
            )
        with c_next:
            if st.button("Next", disabled=(page >= n_pages - 1), key=f"next_{class_pick}"):
                st.session_state[page_key] = min(n_pages - 1, page + 1)
                st.rerun()

        st.markdown('<div class="thumb-grid">', unsafe_allow_html=True)
        start = page * PER_PAGE
        page_imgs = all_imgs[start:start + PER_PAGE]
        cols_per_row = 6
        for row_start in range(0, len(page_imgs), cols_per_row):
            row_imgs = page_imgs[row_start:row_start + cols_per_row]
            cols = st.columns(cols_per_row)
            for col, img_path in zip(cols, row_imgs):
                with col:
                    # Defensive: a file may have been removed between the
                    # directory walk and this render (e.g. mid-run re-split).
                    # Skip silently rather than crashing the whole page.
                    if not Path(img_path).exists():
                        continue
                    st.image(str(img_path), width="stretch")
                    if st.button(
                        "Run",
                        key=f"pick_{img_path.name}",
                        width="stretch",
                    ):
                        st.session_state["picked_path"] = str(img_path)
                        st.session_state["picked_label"] = class_pick
                        st.session_state["just_picked"] = True
                        st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)
    else:
        st.info("No test images in data/test/. Run scripts/split_dataset.py first.")

    # ---- Stage 4: upload fallback ----
    with st.expander("Upload a custom image", expanded=False):
        uploaded = st.file_uploader("PNG or JPG", type=["png", "jpg", "jpeg"])
        if uploaded is not None:
            # Only treat as a fresh pick if the uploaded bytes have changed
            # since last time. Otherwise the file_uploader's sticky value
            # would override a subsequent thumbnail click on every rerun.
            up_bytes = uploaded.getvalue()
            up_sig = (uploaded.name, len(up_bytes), hash(up_bytes))
            if st.session_state.get("_upload_sig") != up_sig:
                st.session_state["_upload_sig"] = up_sig
                tmp = ROOT / "artifacts" / f"_uploaded_{uploaded.name}"
                tmp.write_bytes(up_bytes)
                st.session_state["picked_path"] = str(tmp)
                st.session_state["picked_label"] = None
                st.session_state["just_picked"] = True
                st.rerun()

    # ---- Stage 5: webcam capture ----
    # Browser-native single-snapshot capture (st.camera_input). This is the
    # in-app equivalent of `python scripts/prototype.py --webcam` and feeds
    # the same Result card above. The widget is gated behind a "Start
    # camera" button so opening the expander does NOT immediately prompt
    # for camera permission or start a live preview — important on mobile
    # where the prompt is intrusive, and respectful of the panellist's
    # webcam during a screen-share.
    #
    # On the synthetic-only pilot gallery real captures will usually score
    # "unknown" — that domain gap is expected and is the honest answer to
    # demo for the Hockley Mint follow-up.
    with st.expander("Capture from webcam", expanded=False):
        st.caption(
            "Single-frame capture from your browser camera. Useful for the "
            "in-person Hockley Mint follow-up where you can hold a real "
            "ring up to a laptop. Heads-up: on the synthetic-only pilot "
            "gallery, real-world photos will often come back as 'unknown' "
            "— that's the synthetic-to-real domain gap, not a bug."
        )

        if not st.session_state.get("_webcam_active"):
            # Idle state — just a button. No camera access requested yet.
            st.markdown(
                '<div class="pred-card pred-card-empty" '
                'style="min-height:90px;margin-bottom:10px;">'
                '<div class="empty-title">Camera off</div>'
                '<div>Click below to enable the camera. '
                'Your browser will ask for permission.</div>'
                '</div>',
                unsafe_allow_html=True,
            )
            if st.button("Start camera", key="_start_webcam"):
                st.session_state["_webcam_active"] = True
                st.rerun()
        else:
            # Active state — render the live preview widget and a Stop button.
            cam_img = st.camera_input(
                "Camera", label_visibility="collapsed", key="_cam"
            )
            if cam_img is not None:
                # camera_input retains its value across reruns; guard against
                # re-triggering on every rerun (would clobber thumbnail picks).
                cam_bytes = cam_img.getvalue()
                cam_sig = (len(cam_bytes), hash(cam_bytes))
                if st.session_state.get("_webcam_sig") != cam_sig:
                    st.session_state["_webcam_sig"] = cam_sig
                    tmp = ROOT / "artifacts" / "_webcam_capture.png"
                    tmp.write_bytes(cam_bytes)
                    st.session_state["picked_path"] = str(tmp)
                    st.session_state["picked_label"] = None
                    st.session_state["just_picked"] = True
                    st.rerun()
            if st.button("Stop camera", key="_stop_webcam"):
                st.session_state["_webcam_active"] = False
                st.session_state.pop("_webcam_sig", None)
                # The widget's own state is keyed by "_cam"; drop it so the
                # next "Start camera" gets a fresh preview rather than a
                # stale frozen frame.
                st.session_state.pop("_cam", None)
                st.rerun()


# ---------------------------------------------------------------------------
# Tab 2: Embedding space
# ---------------------------------------------------------------------------

with tab_space:
    st.markdown(f"##### Reference embeddings · {encoder_choice} · t-SNE to 2D")

    # Map encoder choice to the matching t-SNE PNG. Fall back gracefully.
    space_plots = {
        "ResNet50": "08_embedding_space_resnet50.png",
        "DINOv2 ViT-S/14": "08_embedding_space_dinov2.png",
    }
    candidate = PLOTS / "concepts" / space_plots.get(encoder_choice, "08_embedding_space.png")
    fallback = PLOTS / "concepts" / "08_embedding_space.png"
    img_path = candidate if candidate.exists() else fallback

    if img_path.exists():
        st.image(str(img_path), width="stretch")
        if img_path.name != space_plots.get(encoder_choice, ""):
            st.caption(
                f"Showing ResNet50 fallback — no DINOv2 t-SNE has been rendered. "
                f"Run `python scripts/make_concept_diagrams.py` to generate it."
            )
        else:
            st.caption(
                "Each point is one reference image. Colour = class. "
                "Same-coloured points clustering together = the encoder separates that class cleanly. "
                "Overlapping clusters of different colours = pairs the encoder cannot reliably separate."
            )
    else:
        st.info("Run scripts/make_concept_diagrams.py to generate this plot.")


# ---------------------------------------------------------------------------
# Tab 3: Confusion matrix
# ---------------------------------------------------------------------------

with tab_matrix:
    rep = load_results(encoder_choice)
    if rep:
        import pandas as pd

        labels = rep["confusion_matrix_labels"]
        cm = np.array(rep["confusion_matrix"])
        df = pd.DataFrame(
            cm,
            index=[f"true: {l}" for l in labels],
            columns=[f"pred: {l}" for l in labels],
        )
        st.markdown(f"##### Confusion matrix · {encoder_choice}")
        st.dataframe(df.style.background_gradient(cmap="Blues", axis=None), width="stretch")

        st.markdown("##### Per-class metrics")
        rows = []
        for cls in labels:
            m = rep["per_class"].get(cls)
            if m:
                rows.append({
                    "class": cls,
                    "precision": round(m["precision"], 3),
                    "recall": round(m["recall"], 3),
                    "f1": round(m["f1-score"], 3),
                    "support": int(m["support"]),
                })
        st.dataframe(pd.DataFrame(rows), width="stretch", hide_index=True)
    else:
        st.info("No results JSON for this encoder. Run prototype.py --evaluate data/test.")


# ---------------------------------------------------------------------------
# Tab 4: About
# ---------------------------------------------------------------------------

with tab_about:
    st.markdown("""
##### Pipeline

1. Reference gallery is built offline: each reference image is passed through a
   pretrained encoder (ResNet50 or DINOv2) to produce an L2-normalised embedding.
   261 embeddings are stored as `.npz` (after upstream dedup).
2. At query time, the same encoder embeds the query image.
3. Cosine similarity is computed against every gallery vector via a single
   matrix-vector product.
4. The top-k neighbours are retrieved. Mean similarity is computed per class
   within the top-k. The class with the highest mean wins.
5. If the winning mean is below the threshold, the system returns "unknown".

##### Files

| Path | Role |
|---|---|
| `scripts/prototype.py` | Core pipeline (build gallery, predict, evaluate, webcam). |
| `scripts/split_dataset.py` | Stratified 30/20/50 split, seed 42. |
| `scripts/make_plots.py` | Headline and confusion matrix plots. |
| `scripts/make_concept_diagrams.py` | Concept diagrams. |
| `scripts/build_html.py` | Renders docs to `output/prep.html`. |
| `scripts/demo.py` | This app. |
""")
