# KPM Design System

Inspired by Amazon’s scan density and Stripe’s information hierarchy. KPM stays KPM: an operations app, not a storefront and not a marketing site.

## Product
KPM is a small-business operations app: inventory, sales, accounting, customers, suppliers, insights, and automation. The signed-in product is a calm, dense operator UI. The first screen of every page answers one question: what needs attention, and what is the single next action.

## Brand
- Logo: `frontend/public/brand/kpm-logo.png` (must render as the real image in every logo position; never initials/emoji/generic marks)
- Voice: clear, operational, concise. Labels name the object and the state (“3 orders need action”), not a slogan.
- Do not invent a new brand palette or display font. Do not import Amazon yellow, Amazon navy chrome, Stripe violet, Stripe radial gradients, Söhne, or Source Code Pro.

## What to borrow
- From Amazon: equal-weight scannable modules, short bold module titles, tight 8px rhythm, one commit style reserved only for the primary action, tiny status badges, fast hover states. Breadth of information without a marketing hero.
- From Stripe: one primary button and a quiet secondary, type roles that do the hierarchy work, hairline borders and surface shifts instead of heavy shadows, large tabular numerals with a muted caption, left-weighted content so the decision sits first.

## Typography
- Family: Plus Jakarta Sans (weights 400–700 for product UI). No second family.
- Page title ~22px semibold, tracking-tight
- Section / module titles ~14px semibold
- Body ~13–14px; muted helper and captions ~12–12.5px
- Tabular nums for currency, counts, and KPIs
- Hierarchy comes from weight (400 vs 600) and role, not from a display face or a color tint inside a sentence

## Color tokens (hard constraints)
- Ink / primary actions: `#121417` (`--app-ink`). This is the only commit color. It never decorates cards, badges, or backgrounds.
- Muted text: `#5c6570`; faint: `#8b939e`
- Canvas: `#f6f7f8`; surfaces: `#ffffff`; alternate band: `#f1f2f4`; hover: `#f1f2f4`
- Borders: hairline `#e6e8eb`; strong `#d5d8de`
- Positive `#1f7a4d` (+ bg `#eef6f1`); warning `#9a6700` (+ bg `#fbf6ea`); critical `#b42318` (+ bg `#fdf2f2`)
- Links stay ink or muted, not a separate blue
- No purple, no violet fills, no yellow CTA, no navy header, no multi-hue gradients, no cream editorial themes, no neon accents

## Shape & elevation
- Radius: 8px panels, 6px controls. Do not pill the primary button. Do not go sharper than 6px on controls.
- Flat cards. Structure comes from hairline borders and the canvas/surface shift.
- Popovers use `--app-shadow-pop` only. No large marketing drop shadows.

## Layout shell
- Left sticky sidebar ~232px, white or canvas, hairline right border. Logo image plus nav: Home, Inventory, Sales, Accounting, Insights, Suppliers, Customers, Reports, Settings.
- The sidebar is chrome. It is not a dark brand band.
- Top bar: search (⌘K), notifications, user chip. One row, no second utility tier.
- Main content max-width ~1280–1360px on the soft canvas, 16px standard gap, 8px base unit.

## Page pattern
1. Page header: title, one-line operational subtitle, one primary action, secondary actions as outline buttons.
2. Metric strip: 3–4 figures. Numeral first, muted caption under it. Money, stock risk, and pending work lead.
3. Needs-action queue: the first content block. Rows are dense, status is a small badge, each row has one obvious action.
4. Supporting modules (activity, breakdowns, suggestions) sit beside or below the queue at equal card weight. They do not outrank the queue.

## Components to reuse visually
- AppShell, PageHeader, MetricStrip, Button (ink primary / white outline secondary), Status, Dialog, EmptyState, DataTable
- Primary button: ink fill, white text, 6px radius. One per view.
- Secondary button: white fill, ink text, hairline border. Never a second filled color.
- Status: small text badge on the semantic background. Not a large colored card.
- Empty states: one sentence of what is missing and the single action that fixes it.

## Operator priorities
What an operator should see first: money (revenue, cash, margin), stock risk (low stock, alerts), sales (orders that need action), and the next action (suggestion, setup, or the row in front of them). Density serves scanning. Do not add a hero, a logo strip, or a story section inside the product.

## Motion
Subtle only: 150–220ms color and fill transitions. No scroll reveals, no parallax, no entrance choreography.
