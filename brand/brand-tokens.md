# Hockley Mint — Brand Tokens

Source: hockleymint.co.uk (CSS extracted 2026-05-20). All values verified from live stylesheets, not inferred.

## Tagline
**"Where Luxury Meets Legacy"**

Positioning: one of Europe's largest independent jewellery manufacturers — Birmingham Jewellery Quarter, 70+ years, ethical/sustainable.

## Colors (verified from /assets/css2025/style.css)

| Token | Hex | Use |
|---|---|---|
| `--hm-ink` | `#1D1813` | Primary text, dark base (a warm near-black brown) |
| `--hm-green-deep` | `#003D22` | Deepest green, navigation, premium accents |
| `--hm-green` | `#00A478` | Primary brand green, CTAs, active states |
| `--hm-green-bright` | `#00A444` | Bright green variant |
| `--hm-mint` | `#6DC49C` | Logo accent / secondary, soft mint highlight |
| `--hm-paper` | `#FFFFFF` | Canvas |
| `--hm-line` | `#DDDDDD` | Hairline borders (8B alpha in source) |
| `--hm-muted` | `#959DA5` | Secondary text (33 alpha in source) |
| `--hm-ink-soft` | `#1D181300` → `#1D18132F` | Translucent ink for overlays |

## Typography
- **Primary:** `"Korolev", sans-serif` (Klim Type Foundry — geometric grotesque)
- **Demo substitute (free):** `Space Grotesk` (Google Fonts) — closest open match for Korolev's proportions. Use weights 400 / 500 / 700.
- **Fallback stack:** `"Korolev", "Space Grotesk", system-ui, sans-serif`

## Logo
- File: `brand/hockleymint-logo.svg`
- Wordmark "HOCKLEY MINT" in white + mint-green hexagonal monogram in `#6DC49C`
- On light backgrounds: use a dark variant (recolor paths to `#1D1813`)
- Clearspace: keep at least 0.5× logo height of empty space around it

## Tone & Design Language
- Luxury restraint — generous whitespace, large product photography, very limited colour outside of green + ink
- Heritage signal: subtle serif accents, fine 1px lines, lots of black
- "Modern manufacturer" not "boutique e-commerce" — feels closer to a Klim Foundry / Stripe-luxury aesthetic than a typical jewellery site

## Apply to Ring Studio
- Background: `#FFFFFF` (paper) with `#1D1813` (ink) for chrome and `#00A478` (green) for primary actions and active states
- Module headers: 32–40px Korolev/Space Grotesk Medium in ink
- Cards: 1px `#DDDDDD` hairline, 12–16px radius, generous internal padding
- CTA: filled `#00A478` background, white text, no gradient
- Loading / generation states: animated mint (`#6DC49C`) shimmer over neutral surface
