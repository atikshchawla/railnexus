# RailNexus — Frontend Design System

> **Automatic Block Planning UI for Indian Railways (SIH 2026 — PS 26027)**

This is an internal operational tool for section engineers, PWIs, and Station Masters who will use it multiple times daily on desktop, often under time pressure. It is a safety-of-train-operations tool, not a consumer or marketing product.

Design it to feel like a natural evolution of existing CRIS-built Indian Railways systems (FOIS, NTES, ICMS, UTS/PRS) — dense, light-background, high-contrast, low-decoration, table-first for any repeating data.

---

## Hard rules

- Light theme by default: canvas `#F5F6F8`, surfaces white, navy primary (`#0B3C6B`), hairline borders (`#D3D7DC`). No near-black dark theme with glowing accents.
- One typeface (Inter), sentence case everywhere, no ALL-CAPS labels, tabular numerals for all numeric data.
- No emoji anywhere in the UI. Use one consistent SVG icon set (Lucide) at one stroke weight.
- No uniform rounded "SaaS-card" treatment applied to everything. Use flat, bordered, minimal-radius (0–4px) panels only for singular summary values. All repeating data (defects, blocks, logs, approvals) is a table or list, never a card stack.
- No gradients, no glow effects, no drop shadows used decoratively.
- Colour is reserved for status meaning only (critical/warning/info/success), applied consistently everywhere, always paired with text/icon (never colour alone).
- Minimal motion: no page-load fade/slide animations, no animated meters. Only hover-state feedback and action-confirmation feedback.
- Any AI/system-generated recommendation must be clearly labelled as such, visually subordinate to verified operational data, with confidence shown as a plain number + simple solid bar, and always paired with explicit human approve/reject/adjust actions.
- Alerts and banners are solid and high-contrast, communicating urgency through clarity, not visual drama.

---

## Color tokens

| Token | Hex | Use |
|---|---|---|
| `--bg-canvas` | `#F5F6F8` | App background |
| `--bg-surface` | `#FFFFFF` | Cards, panels, tables |
| `--bg-surface-sunken` | `#EDEFF2` | Table stripes, secondary panels |
| `--border-default` | `#D3D7DC` | Standard 1px hairline borders |
| `--text-primary` | `#1B1F24` | Body / headings |
| `--text-secondary` | `#5B6470` | Metadata, captions |
| `--brand-primary` | `#0B3C6B` | Headers, primary actions, active nav |
| `--brand-primary-hover` | `#0A335A` | Hover state |
| `--status-critical` | `#B3261E` | Rail fracture / urgent (IMR) |
| `--status-warning` | `#8A5A00` on `#FCEFC7` bg | Observed defects, needs review |
| `--status-info` | `#0B5FA5` | Predictive / informational |
| `--status-success` | `#1E7A34` | On-track, completed, approved |

## Typography

- One family: Inter
- Page title: 20px / 600 weight
- Section heading: 15px / 600 weight, sentence case
- Body / table text: 14px / 400 weight
- Secondary / metadata: 12.5px / 400 weight
- Data emphasis (KPI numbers): 28px / 600 weight
- Tabular figures enabled for all numeric data

## Anti-pattern checklist

- [ ] No emoji used for icons, status, or decoration
- [ ] No dark background with a single glowing accent colour
- [ ] No identical rounded-corner cards with identical drop shadows
- [ ] No ALL-CAPS section eyebrows or tracked-out labels
- [ ] No gradient fills on progress bars, buttons, or text
- [ ] Repeating data rendered as a table/list, not a stack of cards
- [ ] Every colour used for status has a real, consistent meaning
- [ ] Typography is one family, sentence case, tabular numerals
- [ ] AI suggestions clearly labelled and visually secondary
- [ ] Screen would look at home next to a real CRIS/IR system screenshot
