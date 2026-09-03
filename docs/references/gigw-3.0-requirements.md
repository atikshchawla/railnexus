# GIGW 3.0 — Key Requirements for RailNexus
## Source: Guidelines for Indian Government Websites and Apps (GIGW 3.0)
## Issued by: NIC under MeitY | Portal: guidelines.india.gov.in
## Retrieved: 2026-09-04 | Tier 2 source (government design standard)

---

## Accessibility (WCAG 2.1 Level AA — mandatory baseline)

### Colour contrast
- **Text (normal):** Contrast ratio ≥ **4.5:1** against background
- **Text (large — 18pt or 14pt bold+):** Contrast ratio ≥ **3:1**
- **UI components / graphical objects:** Contrast ratio ≥ **3:1** against adjacent colours
- **Exceptions:** Inactive components, decorative elements, user-agent-determined appearance

### Colour as information
- Colour must **never be the only visual means** of conveying information
- Example: "Required" fields marked in red must ALSO have text label "required"
  or an asterisk — not colour alone
- Status badges (IMR/OBS/PM) must be distinguishable by label text, not just colour

### Keyboard navigation
- Full tab-order support on all interactive elements
- Visible focus indicators on all focusable elements
- Skip navigation links

### Touch targets
- Minimum **44×44 px** for all interactive elements (buttons, links, form controls)
- Critical for tablet usage by field engineers

### Screen readers
- All interactive elements must have ARIA labels
- Images must have alt text
- Form controls must have associated labels
- Tables must have proper header markup

---

## Bilingual content (Hindi + English)
- Government websites serving Hindi-speaking regions must provide content in
  both Hindi and English
- Our implementation: bilingual header "भारतीय रेल / Indian Railways"
- UI labels can be English-only for technical operational tools (precedent:
  CRIS-built systems like FOIS/NTES use English for operational screens)

---

## Legal constraints

### State Emblem of India
- **State Emblem of India (Prohibition of Improper Use) Act, 2005**
- The Ashoka Lion Capital emblem **cannot be used** by unauthorized entities
- This includes student hackathon projects without Central Government permission
- **Our approach:** Text-based branding only ("भारतीय रेल / Indian Railways"),
  never the actual emblem graphic

### RPwD Act compliance
- Rights of Persons with Disabilities (RPwD) Act, 2016
- GIGW 3.0 compliance is mandatory for government digital platforms under this act
- Our product should aim for compliance even as a demo, for evaluator credibility

---

## GIGW 3.0 structure (for reference)
The manual is organized into four quality areas:
1. **Quality** — content, IA, navigation, search
2. **Accessibility** — WCAG 2.1 AA compliance (detailed above)
3. **Security** — HTTPS, data protection, secure forms
4. **Life-cycle Management** — maintenance, updates, archiving

Each guideline is labeled: **MUST** / **SHOULD** / **MAY**

---

## How to obtain the full manual
- Visit: https://guidelines.india.gov.in
- Click "GIGW Manual" section → "Download" → "GIGW Manual 3.0"
- The PDF requires JavaScript-enabled browser to download (direct curl fails)
- Alternative: Visit the portal in a browser and download manually
