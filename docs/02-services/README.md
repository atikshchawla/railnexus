# 🔧 Service Modules — Overview

> Every piece of business logic in RailNexus lives inside a **service module** under `lib/services/`.
> This document provides the master index and specification for each service.

---

## Service Module Architecture

```
lib/services/
├── block-planning/         ← Core domain service
├── scheduling/             ← Multi-horizon scheduling
├── approval/               ← Workflow & authorization
├── ai-optimizer/           ← AI engine client
├── digital-twin/           ← Twin state management
├── integrations/           ← External system adapters
│   ├── tms/
│   ├── smms/
│   ├── tdms/
│   └── coa/
├── notifications/          ← Alert & notification delivery
└── auth/                   ← Authentication & RBAC
```

---

## Module Specifications Index

| Module | Document | Owner Department |
|--------|----------|-----------------|
| Block Planning | [`block-planning-service.md`](./block-planning-service.md) | Core Engineering |
| Scheduling Engine | [`scheduling-service.md`](./scheduling-service.md) | Core Engineering |
| Approval Workflow | [`approval-service.md`](./approval-service.md) | Core Engineering |
| AI Optimizer | [`ai-optimizer-service.md`](./ai-optimizer-service.md) | AI/ML Team |
| Digital Twin | [`digital-twin-service.md`](./digital-twin-service.md) | Frontend / Visualization |
| Integrations (All) | [`integrations-service.md`](./integrations-service.md) | Platform Engineering |
| Notifications | [`notifications-service.md`](./notifications-service.md) | Platform Engineering |
| Auth & RBAC | [`auth-service.md`](./auth-service.md) | Platform Engineering |

---

## Cross-Service Communication Rules

> [!IMPORTANT]
> Services NEVER import directly from each other's internal files.
> Communication happens through:
> 1. **Public API exports** (`index.ts` of each module)
> 2. **Kafka events** (for async, decoupled communication)
> 3. **Shared types** (from `lib/types/`)

### Dependency Graph

```
auth ──────────────────────────────────────────────────┐
  │                                                     │
  ▼                                                     │
notifications ◄─── approval ◄─── block-planning ◄──── scheduling
                       │              │                    │
                       │              ▼                    │
                       │        integrations               │
                       │         (tms/smms/                │
                       │          tdms/coa)                │
                       │              │                    │
                       └──────────────┼────────────────────┘
                                      │
                                      ▼
                               ai-optimizer
                                      │
                                      ▼
                               digital-twin
```

**Direction = imports from / depends on.** If arrows point from A → B, then A may import from B's public API.

---

## Standard Module Interface

Every service module MUST export from its `index.ts`:

```typescript
// lib/services/<module>/index.ts

// 1. Service class or functions
export { MyService } from './my.service';

// 2. Module-specific types
export type { MyType, MyInput, MyOutput } from './types';

// 3. NEVER export internal utilities or private helpers
```

---

## Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Author | RailNexus Architecture Team |
