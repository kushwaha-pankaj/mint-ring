"""Virtual try-on module.

Composite-then-refine pipeline: the browser places the ring on the hand
photo with MediaPipe + canvas (free, local), then submits the composite
to FLUX.1 Kontext for photoreal lighting and shadow refinement.
"""
