# Domain & Design Governance Protocol

You are working on RailNexus, an Automatic Block Planning system for Indian
Railways (SIH 2026, PS 26027). This project touches real government
terminology and design standards, and your job includes not fabricating
either. Follow this protocol continuously, not just when asked.

## DOMAIN TERMS AND RULES

Before writing any code that gives meaning to a railway-domain term,
threshold, or workflow rule (defect categories, priority logic, block/
corridor rules, department names, SLA timings, etc.):

1. Check `/docs/domain-glossary.md` first. If the term is already there with
   Confidence = Confirmed or Project-defined-and-ratified, use it as-is.
2. If it's missing or marked Unconfirmed, research it using your browser
   tool against this source order, stopping at the first tier that gives a
   clear answer:
   - Tier 1: Indian Railways Permanent Way Manual, USFD Manual, General &
     Subsidiary Rules, Signal Engineering Manual, RDSO traction/OHE manuals,
     Block Working Manual
   - Tier 2: RDSO (rdso.indianrailways.gov.in), indianrailways.gov.in, CRIS
     (cris.org.in), Parliament Q&A / RTI replies on Railways
   - Tier 3: technical forums/theses — corroboration only, never the sole
     source
   Never treat a UI screenshot's own labels as evidence of what a term means
   in real IR systems — that's circular.
3. Cap effort at roughly 5 targeted searches per term. If nothing
   authoritative turns up, write the term into the glossary as
   "Project-defined — needs team ratification," implement it as a plain
   label with no inferred hierarchy or behavior attached, and say so
   explicitly in your response to the user instead of proceeding as if it
   were settled.
4. Record every finding — confirmed or not — in `/docs/domain-glossary.md`
   with source, confidence, date, and whether it drives any logic. Update
   this file as a normal part of the task, not a separate cleanup step.
5. Keep Category, Urgency, and Workflow Status as structurally separate
   fields always, specifically so an unverified guess about what a category
   label means can never silently become a priority-ordering or
   business-logic decision.

## DESIGN AND COMPLIANCE

Before implementing any UI pattern with accessibility, bilingual, or
government-identity implications:

1. Check `/docs/design-compliance.md` first.
2. If not covered, verify against GIGW 3.0 (guidelines.india.gov.in) and
   WCAG 2.1 AA directly using your browser tool, and record the finding the
   same way as above.
3. Never use the actual State Emblem of India (the Ashoka Lion Capital)
   graphic anywhere in this project — it's legally restricted to authorized
   government entities under the State Emblem of India (Prohibition of
   Improper Use) Act, 2005. Use text-based bilingual identifiers only, as
   already established in this project's header.

## REPORTING

At the start of any session, skim `/docs/domain-glossary.md` and
`/docs/design-compliance.md` for entries still marked Unconfirmed or
Project-defined-and-unratified, and raise them to the user proactively
rather than waiting to be asked — these are open decisions, not settled
ground, and they should not silently accumulate.

Never present a Tier-3-sourced or unsourced claim with the same confidence
as a Tier-1-sourced one. When you're not sure, say so plainly rather than
smoothing over the uncertainty.

## REFERENCE FILES

Local reference documents are stored in `/docs/references/`:
- `usfd-rail-defect-classification.md` — IMR/OBS classification rules
- `gigw-3.0-requirements.md` — Accessibility and compliance requirements
- `cris-source-systems.md` — TMS/SMMS/TDMS/COA/BDMS system mapping
- `block-working-reference.md` — Shadow blocks, integrated blocks, RBP, Private Number
