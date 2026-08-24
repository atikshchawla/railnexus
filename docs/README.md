# 📚 RailNexus — Technical Documentation Hub

> **AI-Driven Automatic Block Planning & Digital Twin System for Indian Railways Fixed Infrastructure**

---

## 🔒 GOLDEN RULES — READ BEFORE TOUCHING ANYTHING

> [!CAUTION]
> **NEVER modify or delete any file inside `docs/` without explicit approval from the Project Lead.**
> Documentation is the single source of truth for every engineering, design, and architectural decision.

> [!WARNING]
> **NEVER bypass the modular architecture.** Every service, component, and module has a defined boundary.
> Cross-cutting concerns MUST go through the designated integration layers — never couple services directly.

> [!IMPORTANT]
> **ALWAYS follow the directory structure** defined in [`01-architecture/directory-structure.md`](./01-architecture/directory-structure.md).
> All new code MUST map to a documented module. If a module doesn't exist, document it first, then code it.

---

## 📂 Documentation Structure

| #  | Folder | Contents | Status |
|----|--------|----------|--------|
| 00 | [`00-overview/`](./00-overview/) | Project vision, glossary, executive summary | ✅ |
| 01 | [`01-architecture/`](./01-architecture/) | System architecture, directory structure, tech stack | ✅ |
| 02 | [`02-services/`](./02-services/) | All microservice/module specifications | ✅ |
| 03 | [`03-data-models/`](./03-data-models/) | Database schemas, ERDs, Prisma model design | ✅ |
| 04 | [`04-ux-flows/`](./04-ux-flows/) | UX journeys, wireframe specs, interaction flows | ✅ |
| 05 | [`05-integrations/`](./05-integrations/) | External system integrations (TMS, SMMS, TDMS, COA) | ✅ |
| 06 | [`06-ai-ml/`](./06-ai-ml/) | AI/ML engine specs, algorithms, model pipelines | ✅ |
| 07 | [`07-digital-twin/`](./07-digital-twin/) | Digital Twin simulator design and rendering specs | ✅ |
| 08 | [`08-safety/`](./08-safety/) | Fail-safe mechanisms, SIL-4 compliance, Kavach integration | ✅ |
| 09 | [`09-srs/`](./09-srs/) | Full Software Requirements Specification | ✅ |
| 10 | [`10-guidelines/`](./10-guidelines/) | Coding standards, contribution guide, do's and don'ts | ✅ |

---

## 🚀 Quick Start for Engineers

1. **Read the Overview** → [`00-overview/project-vision.md`](./00-overview/project-vision.md)
2. **Understand the Architecture** → [`01-architecture/system-architecture.md`](./01-architecture/system-architecture.md)
3. **Read the Guidelines** → [`10-guidelines/CONTRIBUTING.md`](./10-guidelines/CONTRIBUTING.md)
4. **Find your service** → [`02-services/`](./02-services/)
5. **Start coding** — always from the documented module boundary outward.

---

## 🏷️ Version

| Field | Value |
|-------|-------|
| Document Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Branch | `demo` |
| Maintained By | RailNexus Architecture Team |
