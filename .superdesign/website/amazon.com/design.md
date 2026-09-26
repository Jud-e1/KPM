---
version: "superdesign-alpha"
name: "Density-Well Commerce Grid"
description: "A near-white, high-density retail grid organized by a two-tier navy header, saturated red/orange promo accents, and a relentless auto-fit card mosaic of flush-bled product tiles."
colors:
  background: "#FFFFFF"
  surface: "#F0F2F2"
  surface-inverse: "#232F3E"
  header-top: "#131921"
  header-bottom: "#232F3E"
  text-primary: "#0F1111"
  text-secondary: "#565959"
  text-oncolor: "#FFFFFF"
  link: "#2162A1"
  accent-yellow: "#FFD814"
  accent-yellow-hover: "#FFCE12"
  accent-badge: "#CC0C39"
  border: "#767676"
  border-muted: "#DDDDDD"
typography:
  headline-md:
    fontFamily: "Arial"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: "1.43"
  body-md:
    fontFamily: "Arial"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: "1"
  label-md:
    fontFamily: "Arial"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: "1.33"
  caption-sm:
    fontFamily: "Arial"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: "1"
  accent-display:
    fontFamily: "Amazon Ember Modern Display"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "1.15"
spacing:
  base: "8px"
  gap-tight: "8px"
  gap-standard: "24px"
  card-inset: "4px"
rounded:
  control: "8px"
  control-outline: "3px"
  card: "4px"
  swatch: "2px"
  pill: "100px"
  circle-badge: "50px"
components:
  navbar:
    background-top: "#131921"
    background-bottom: "#232F3E"
    height: "99px"
    width: "100%"
    radius: "0px 0px 0px 0px"
  button-nav-cta:
    background: "#FFD814"
    text-color: "#2162A1"
    radius: "8px"
    height: "0px"
  button-primary-hero:
    background: "#FFD814"
    text-color: "#2162A1"
    radius: "100px"
    height: "24px"
    border: "1px solid rgb(255, 216, 20)"
    hover-background: "#FFCE12"
    hover-text: "#0C3353"
  button-primary-footer:
    background: "#FFD814"
    text-color: "#000000"
    radius: "100px"
    height: "32px"
    border: "1px solid rgb(255, 216, 20)"
  button-link-flat:
    background: "transparent"
    text-color: "#2162A1"
    radius: "0px"
    height: "41px"
  button-outline-secondary:
    background: "transparent"
    text-color: "#DDDDDD"
    radius: "3px"
    height: "34px"
    padding: "6px 18px 6px 8px"
    border: "1px solid rgb(132, 134, 136)"
  card-promo-hero:
    background: "gradient/photo fill, module-specific"
    radius: "4px"
    padding: "0px"
    shadow: "rgba(0, 0, 0, 0.13) 0px 2px 4px 0px"
  card-tile-grid:
    background: "#FFFFFF"
    radius: "4px"
    padding: "0px"
    shadow: "rgba(15, 17, 17, 0.15) 0px 2px 5px 0px"
---
# Density-Well Commerce Grid
Source: https://www.amazon.com

## Overview
This is a light-mode-default, information-maximalist retail system — the visual opposite of restraint-led minimalism. Its identity is carried not by a hero statement but by sheer repeating card density: a two-tier dark navy header sits atop a near-white page (`#FFFFFF`/`#F0F2F2`, roughly 56% of the field together), and everything below is an unbroken cascade of flush, square-cornered product tiles in 4-up and 2-up auto-fit grids. Color is not rationed to one accent — it arrives promiscuously wherever a product photo or promo badge lands (reds, oranges, blues), while structural chrome (header, footer, buttons) stays disciplined to three notes: navy (`#131921`→`#232F3E`), a single saturated yellow CTA (`#FFD814`), and workhorse link-blue (`#2162A1`). The typographic voice is entirely a grotesque sans (Arial / Amazon Ember) at small, dense sizes — there is no serif or display flourish; hierarchy is built from weight and container color, not from scale jumps.

## Composition
The first screen opens with a wide 5-up scrolling rail of oversized promo tiles (photographic, mixed aspect, one per merchandising theme) sitting directly under the two-tier navy navbar — this rail is the only full-bleed, high-color band on the page. Immediately below it the layout drops into a strict 4-column card grid that persists, with only rhythm variation, for the entire remaining scroll: a dense body of 4-up rows occasionally interrupted by one full-width spanner row (a horizontal scrolling rail of deal tiles), then resuming 4-up. Each 4-column module further subdivides internally into a 2×2 grid of thumbnail + label pairs. The deliberate choice here is breadth over hierarchy: no single section is allowed to dominate visually (no large hero statement, no oversized numeral, no isolated CTA band) — the alternative rejected is a hero-led marketing page with one dominant fold; instead every module competes at equal visual weight, and the page reads as a directory, not a story. The scroll terminates in a two-band footer: a shallow navy link-column band, then a near-black band with a denser 6-column sitemap grid.

## Colors
`#FFFFFF` and `#F0F2F2` (~56% combined) are the page and card-well surfaces — the dominant pixel value confirms this is a light system, not dark-mode-default. `#131921`→`#232F3E` (the two-tier header, ~17-19% combined with footer reuse) is the sole structural dark surface, functioning as both brand anchor and wayfinding chrome. `#FFD814` is the single rationed accent, reserved exclusively for commit actions (search-submit, sign-in, primary CTA pills) — it never appears as a decorative fill. `#2162A1` is the link/ink role, doing double duty as both interactive text color and a quiet brand-blue. `#CC0C39` is a tiny (~0.2%) urgent-red used only on countdown/badge elements. Everything else — the oranges, reds, blues, greens seen across the promo and product tiles — is uncontrolled photographic/merchandising color, deliberately left outside the token system; the design system's job is to frame that chaos, not suppress it. Borders stay muted and low-contrast (`#767676`, `#DDDDDD`, `#BBBBBB`) so grid seams never compete with content.

## Typography
The entire system runs on one grotesque sans family (Arial as the workhorse, Amazon Ember/Amazon Ember Modern Display for select headline moments) — there is no serif and no monospace anywhere. `label-md` (18px/700) marks section headers ("module titles"); `headline-md` (14px/700) marks card/product titles; `body-md` (15px/400, ink `#111111`) carries running copy and prices; `caption-sm` (10px/400, lh 1) handles the smallest metadata (badges, fine print). Hierarchy is achieved almost entirely through weight-jump (400→700) and container placement rather than dramatic size scaling — sizes cluster tightly between 10px and 18px, an unusually compact range for a page with this much information density.

## Layout
The dominant structure is a 4-column auto-fit card grid, gap 24px×8px, with rows overwhelmingly holding four equal-width tiles (~25% each) and periodic full-width spanner rows (a single 102%-wide horizontal scroll rail) breaking the rhythm — transcribed: `[25/25/25/25] → [102 spanner] → [25/25/25/25] ×3`. A secondary 2-column grid (gap 8px) appears for narrower promo modules, rows `[49/49] → [49] → [49] → [49]`, and a 2×2 variant (gap 8px, rows `[49/49]×2`) nests inside individual modules for thumbnail pairs. This reads as a **card grid / magazine-hybrid**, not a masonry — every tile in a row shares height, and irregularity comes from column-count changes between modules, not free-form item sizing. Content maxes out at approximately 1920px at this viewport with no visible max-width constraint narrowing it further; horizontal scrolling rails are used liberally as an escape valve wherever content exceeds the fixed 4/2-column budget. Spacing is tight and mechanical: 24px/8px/4px increments throughout, with 4px card radius as the near-universal corner treatment — this is a sharp-to-slightly-rounded system, never a soft rounded-card aesthetic.

## Components
- **Navbar**: edge-to-edge square bar, full 100% viewport width (0px inset either side), 99px tall, corner radii 0/0/0/0 (perfectly square, no capsule or inset treatment), two-tier fill (`#131921` top strip, `#232F3E` bottom strip), static/non-transparent on scroll. Carries 82 distinct interactive items across its two tiers (utility row: location, search, account/orders/cart; category row: ~15+ text links). Its CTA is the search-submit control: `#FFD814` fill, `#2162A1` icon/text, 8px radius, sitting flush against the search field's right edge.
- **Button — primary hero** (the prominent commit action near the top of a module): `#FFD814` fill, `#2162A1` text, full pill radius `100px`, 24px height, 1px border `rgb(255, 216, 20)`; hover shifts fill to `#FFCE12` and text to `#0C3353`. This is a compact, low-height pill — decisively rounded, not sharp.
- **Button — primary footer/end-of-scroll**: same yellow family, `#FFD814` fill but `#000000` text, pill radius `100px`, 32px height — a taller sibling of the hero pill, used for the sign-in commit action.
- **Button — flat link** (×5, first screen utility row): transparent fill, `#2162A1` text, 0px radius (fully sharp, text-only), 41px tall hit area — used for header nav-links, not filled buttons at all.
- **Button — outline secondary** (×2, footer region): transparent fill, `#DDDDDD` text, 3px radius (barely-rounded, near-square), 1px border `rgb(132, 134, 136)`, padding `6px 18px 6px 8px` — a low-emphasis utility button (language/region selectors).
- **Promo hero rail** (top of page, below navbar): a horizontally-scrolling row of ~5 large photographic tiles, each roughly one-fifth of viewport width, sharp 4px-radius corners, drop shadow `rgba(0, 0, 0, 0.13) 0px 2px 4px 0px`. Anatomy top-to-bottom inside each tile: an eyebrow line in white/dark text, a bold 2-line headline in the accent-display face, a small pill sub-label or CTA badge, then a full-bleed lifestyle photograph filling the lower ~65% of the card; some carry a play/pause glyph bottom-left indicating a looping video stand-in.
- **Category module card** (the recurring 4-up and 2-up grid unit — "Save on Devices," "Shop new arrivals," etc.): white/`#F0F2F2` background, 4px radius, no visible border, shadow `rgba(15, 17, 17, 0.15) 0px 2px 5px 0px`. Anatomy: a bold `label-md` module title with a trailing chevron (top), then a 2×2 or 2×1 sub-grid of square product thumbnails (photographic, edge-to-edge within their cell, 2px-radius swatch corners), each thumbnail captioned below by a short `body-md` label in `#0F1111`. Some cells carry a small red discount badge (`#CC0C39`-family) overlapping the top-left corner of the thumbnail.
- **Deal-rail card** (the full-width spanner row, "limited-time deals"): a horizontal scrolling rail of ~8 uniform square product tiles, white fill, 4px radius, each stacked top-to-bottom with: a red percentage-off badge top-left, a countdown-timer chip on some tiles, the product photo filling the top ~70%, then a two-line price block below (strikethrough original price in `#565959`, current price bolded in `#0F1111`).
- **Sign-in prompt band**: a full-width, centrally-bounded white card near the very bottom of the content well, bordered top and bottom by hairline `#DDDDDD` rules, containing a centered `label-md` prompt line, the primary-footer pill CTA, and a small `body-md` link line beneath it.
- **Footer**: two stacked bands. Upper band: `#232F3E`-family navy, 4-column link-list grid (each column: one bold `label-md` heading + 8-10 `body-md` links, left-aligned, generous 24px column gap). Middle strip: centered wordmark + two outline-secondary dropdown controls (language, region). Lower band: near-black (`#0F1111`-family), a denser ~7-column sitemap grid of paired bold-title + muted-description link groups, terminating in a centered hairline-separated legal row.

## Graphics & Effects
No gradient renders as a page-level background — the two measured gradients are narrow, local fills: `linear-gradient(to right, rgb(240, 242, 242) 0px, rgb(255, 255, 255) 0px, rgb(255, 255, 255) 100%, rgb(240, 242, 242) 100%)` is a subtle horizontal vignette used behind a single content well (roughly the width of one card module, not the viewport), and `linear-gradient(90deg, rgb(200, 204, 204), rgb(136, 140, 140), rgb(200, 204, 204))` is a thin decorative rule/divider element, not a surface fill. The four live-video surfaces in the promo rail should be rebuilt as static photographic stand-ins with a small triangular play-glyph overlay bottom-left to preserve the "this is playable media" cue. Elevation is expressed exclusively through soft, low-spread drop shadows rather than borders: `rgba(0, 0, 0, 0.13) 0px 2px 4px 0px` for hero promo tiles, `rgba(15, 17, 17, 0.15) 0px 2px 5px 0px` for standard grid cards, and a fainter `rgba(213, 217, 217, 0.5) 0px 2px 5px 0px` for recessed/inline elements — no glassmorphism, no blur, no noise/grain texture anywhere in the system.

## Motion
Motion is utilitarian and near-instantaneous, tuned for perceived responsiveness rather than expression: interactive-state transitions run on `all 0.1s linear` and visibility/opacity swaps use `visibility, opacity 0.1s, 0.1s ease, ease` — both under 150ms, with no spring/overshoot and no staggered choreography. The only keyframe-driven animation is a spinner system (`vjs-spinner-show`, `vjs-spinner-spin`, `vjs-spinner-fade`) tied to the embedded video surfaces, indicating loading/buffering states rather than decorative motion. Rebuild motion as flat, fast micro-interactions on hover/press (background and color swaps only) — this system has no scroll-triggered reveals, no parallax, and no entrance choreography.

## Guardrails
- Never let the header/footer navy read as the page's dominant color — the base surface is white/`#F0F2F2`; navy is a bounded chrome band only.
- Never round the grid card corners past 4px or the buttons' outline/flat variants past 3px — only the two yellow CTA pills earn full 100px pill treatment.
- Never merge the flat-link buttons (0px radius, transparent) with the outline-secondary buttons (3px radius, bordered) — they are visually and functionally distinct tiers.
- Never substitute a full-screen gradient background for the hero — both measured gradients are narrow local fills behind single content wells.
- Preserve the 4-column-with-2×2-internal-subgrid pattern as the default card density; do not loosen it into a sparse 2-3 column bento without matching the measured row maps.
- Keep accent color (`#FFD814`) confined to commit/CTA actions only — never apply it decoratively to cards, badges, or text.