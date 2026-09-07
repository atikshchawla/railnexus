# Design Compliance — RailNexus ABP
### Living document. Check and update before implementing any compliance-sensitive UI decision.

Last updated: 2026-09-04

---

## Colour contrast on status badges (IMR / OBS / PM)
- **Requirement:** WCAG 2.1 AA — 4.5:1 minimum contrast for text
- **Source:** GIGW 3.0 (guidelines.india.gov.in), Accessibility section
- **Status:** ⚠️ Needs verification
- **Where applied:** Category badges in backlog, approvals, overview tables
- **Notes:** Badge text is 11px font-semibold on coloured background. Need to
  verify actual contrast ratios with a tool (e.g., WebAIM contrast checker).
  Current colours: IMR (#B3261E on rgba), OBS (amber on amber-bg), PM (blue on blue-bg).

---

## Colour not sole information carrier
- **Requirement:** WCAG 2.1 AA SC 1.4.1 — colour must not be the only visual means
- **Source:** GIGW 3.0, Accessibility section
- **Status:** ✅ Verified
- **Where applied:** All status indicators
- **Notes:** Every colour-coded element also has a text label (IMR/OBS/PM badge text,
  status text, urgency deadline text). No information conveyed by colour alone.

---

## Touch target minimum size
- **Requirement:** Minimum 44×44 px for interactive elements
- **Source:** GIGW 3.0, Accessibility section; WCAG 2.1 AA SC 2.5.5
- **Status:** ⚠️ Needs verification
- **Where applied:** Action buttons (Approve/Adjust/Reject), table row actions,
  pagination buttons, sidebar nav items
- **Notes:** Some icon buttons (14px with 4px padding = ~22px) may be too small.
  Needs audit.

---

## Keyboard navigation and focus indicators
- **Requirement:** Full tab-order support, visible focus indicators
- **Source:** GIGW 3.0; WCAG 2.1 AA SC 2.4.7
- **Status:** ⚠️ Needs implementation
- **Where applied:** All interactive elements
- **Notes:** Currently relying on browser defaults. Should add explicit
  `focus-visible` styles to all buttons, links, and form controls.

---

## Bilingual content
- **Requirement:** Hindi + English for government-facing apps
- **Source:** GIGW 3.0, Content section
- **Status:** ✅ Partially implemented
- **Where applied:** Sidebar header ("भारतीय रेल / Indian Railways")
- **Notes:** Operational UI labels are English-only, which aligns with CRIS
  precedent (FOIS/NTES/COA use English for operational screens). Full
  bilingual support would require i18n framework — out of scope for SIH demo
  but should be flagged as a production roadmap item.

---

## State Emblem usage
- **Requirement:** State Emblem of India (Prohibition of Improper Use) Act, 2005
  — cannot be used without Central Government authorization
- **Source:** Act of Parliament
- **Status:** ✅ Compliant
- **Where applied:** Header/branding
- **Notes:** We use text-based branding only. No Ashoka Lion Capital graphic
  anywhere in the project. This is correct and must never change for a
  hackathon submission.

---

## ARIA labels on interactive elements
- **Requirement:** WCAG 2.1 AA SC 4.1.2 — all interactive elements need
  accessible names
- **Source:** GIGW 3.0, Accessibility section
- **Status:** ⚠️ Needs audit
- **Where applied:** Icon-only buttons (approve/reject/adjust), filter dropdowns,
  pagination controls
- **Notes:** Icon-only action buttons in the approvals table have `title`
  attributes but may need explicit `aria-label` attributes for screen readers.

---

## Table accessibility
- **Requirement:** WCAG 2.1 AA — proper header markup, scope attributes
- **Source:** GIGW 3.0, Accessibility section
- **Status:** ⚠️ Needs verification
- **Where applied:** All data tables (backlog, approvals, analytics)
- **Notes:** Using `<th>` elements in `<thead>` which is correct. Should verify
  `scope="col"` attributes are present.

---

## Form labels
- **Requirement:** WCAG 2.1 AA SC 1.3.1 — all form controls must have
  associated labels
- **Source:** GIGW 3.0, Accessibility section
- **Status:** ✅ Verified
- **Where applied:** Block request form, filter dropdowns
- **Notes:** All form fields have visible `<label>` elements.
