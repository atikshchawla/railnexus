# 📁 Directory Structure — RailNexus

> **Every file in the codebase MUST map to a location defined here.**
> If you need a new location, **update this document first**, then create the file.

---

> [!CAUTION]
> **NEVER create files outside these defined paths.** Undocumented file locations break the modular architecture and make auditing impossible.

> [!WARNING]
> **NEVER put business logic in `app/` route files.** Route files are thin wrappers that import from `lib/` modules.

---

## Root Structure

```
railnexus/
├── app/                          # Next.js App Router — PAGES & API ROUTES ONLY
│   ├── (auth)/                   # Auth-related pages (login, register)
│   ├── (dashboard)/              # Authenticated dashboard pages
│   │   ├── blocks/               # Block planning views
│   │   ├── digital-twin/         # Digital Twin simulator page
│   │   ├── schedules/            # Schedule management (26-week, monthly, weekly)
│   │   ├── approvals/            # Approval workflow dashboards
│   │   ├── maintenance/          # Maintenance request management
│   │   ├── analytics/            # Reports and analytics
│   │   └── settings/             # User/system settings
│   ├── api/                      # API route handlers
│   │   ├── blocks/               # Block CRUD endpoints
│   │   ├── schedules/            # Schedule endpoints
│   │   ├── approvals/            # Approval workflow endpoints
│   │   ├── integrations/         # External system proxy endpoints
│   │   ├── ai/                   # AI optimization trigger endpoints
│   │   ├── digital-twin/         # Digital Twin WebSocket & state endpoints
│   │   ├── auth/                 # Authentication endpoints
│   │   └── notifications/        # Notification endpoints
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   ├── globals.css               # Global styles
│   └── favicon.ico               # App favicon
│
├── components/                   # Reusable UI Components
│   ├── ui/                       # Base UI primitives (buttons, inputs, cards, modals)
│   ├── blocks/                   # Block-specific components
│   │   ├── BlockCard.tsx          
│   │   ├── BlockTimeline.tsx      
│   │   ├── ShadowBlockOverlay.tsx 
│   │   └── BlockProposalDialog.tsx
│   ├── digital-twin/             # Digital Twin renderer components
│   │   ├── MapRenderer.tsx        
│   │   ├── TrainMarker.tsx        
│   │   ├── SignalNode.tsx         
│   │   ├── PointSwitchAnimation.tsx
│   │   ├── BlockOverlay.tsx       
│   │   └── TimelineSlider.tsx     
│   ├── schedules/                # Schedule-related components
│   ├── approvals/                # Approval workflow components
│   ├── notifications/            # Notification components
│   └── layout/                   # Layout components (sidebar, header, nav)
│
├── lib/                          # Core Business Logic Modules
│   ├── services/                 # Service layer — ALL business logic lives here
│   │   ├── block-planning/       # Block planning service module
│   │   │   ├── index.ts           # Public API exports
│   │   │   ├── block.service.ts   # Block CRUD operations
│   │   │   ├── shadow-block.service.ts  # Shadow block identification
│   │   │   ├── corridor.service.ts      # Corridor availability analysis
│   │   │   └── types.ts           # Module-specific types
│   │   ├── scheduling/           # Multi-horizon scheduling module
│   │   │   ├── index.ts
│   │   │   ├── strategic.service.ts     # 26-week RBP
│   │   │   ├── tactical.service.ts      # Monthly refinement
│   │   │   ├── operational.service.ts   # Weekly/daily dynamic
│   │   │   └── types.ts
│   │   ├── approval/             # Approval workflow module
│   │   │   ├── index.ts
│   │   │   ├── workflow.service.ts
│   │   │   ├── private-number.service.ts  # PN exchange logic
│   │   │   ├── disconnection-memo.service.ts
│   │   │   └── types.ts
│   │   ├── ai-optimizer/         # AI optimization module
│   │   │   ├── index.ts
│   │   │   ├── optimizer.client.ts      # Client for Python AI worker
│   │   │   ├── proposal.service.ts      # AI proposal management
│   │   │   └── types.ts
│   │   ├── digital-twin/         # Digital Twin state module
│   │   │   ├── index.ts
│   │   │   ├── state.service.ts         # Twin state management
│   │   │   ├── simulation.service.ts    # Forward/backward simulation
│   │   │   └── types.ts
│   │   ├── integrations/         # External system integration module
│   │   │   ├── tms/              # Track Management System integration
│   │   │   │   ├── index.ts
│   │   │   │   ├── tms.client.ts
│   │   │   │   ├── tms.transformer.ts
│   │   │   │   └── types.ts
│   │   │   ├── smms/             # Signal Maintenance & Management System
│   │   │   │   ├── index.ts
│   │   │   │   ├── smms.client.ts
│   │   │   │   ├── smms.transformer.ts
│   │   │   │   └── types.ts
│   │   │   ├── tdms/             # Traction Distribution Management System
│   │   │   │   ├── index.ts
│   │   │   │   ├── tdms.client.ts
│   │   │   │   ├── tdms.transformer.ts
│   │   │   │   └── types.ts
│   │   │   └── coa/              # Control Office Application
│   │   │       ├── index.ts
│   │   │       ├── coa.client.ts
│   │   │       ├── coa.transformer.ts
│   │   │       └── types.ts
│   │   ├── notifications/        # Notification module
│   │   │   ├── index.ts
│   │   │   ├── notification.service.ts
│   │   │   └── types.ts
│   │   └── auth/                 # Authentication & authorization module
│   │       ├── index.ts
│   │       ├── auth.service.ts
│   │       ├── rbac.service.ts
│   │       └── types.ts
│   ├── db/                       # Database utilities
│   │   ├── prisma.ts             # Prisma client singleton
│   │   ├── seed.ts               # Database seeding scripts
│   │   └── migrations/           # Custom migration utilities
│   ├── utils/                    # Shared utility functions
│   │   ├── date.ts               # Date/time manipulation (IST-aware)
│   │   ├── geo.ts                # Geospatial utilities (km markers, coordinates)
│   │   ├── crypto.ts             # Cryptographic utilities (PN generation, DM signing)
│   │   ├── validation.ts         # Input validation schemas (Zod)
│   │   └── constants.ts          # Application-wide constants
│   ├── hooks/                    # Custom React hooks
│   │   ├── useDigitalTwin.ts     # Digital Twin WebSocket connection
│   │   ├── useBlockSchedule.ts   # Block schedule data fetching
│   │   ├── useApprovalFlow.ts    # Approval workflow state
│   │   └── useRealtime.ts        # Generic real-time data hook
│   └── types/                    # Global type definitions
│       ├── domain.ts             # Core domain entities (Block, Schedule, Defect, etc.)
│       ├── api.ts                # API request/response types
│       └── events.ts             # Event types for Kafka messages
│
├── prisma/                       # Prisma ORM
│   ├── schema.prisma             # Database schema definition
│   └── seed.ts                   # Seed data
│
├── ai/                           # AI/ML Python Services (separate process)
│   ├── optimizer/                # MILP + RL optimizer
│   │   ├── solver.py             # OR-Tools MILP solver
│   │   ├── rl_agent.py           # Reinforcement learning heuristics
│   │   ├── shadow_block.py       # Shadow block identification algorithm
│   │   └── corridor_analyzer.py  # Timetable corridor finder
│   ├── predictive/               # Predictive maintenance models
│   │   ├── pinn_rul.py           # Physics-informed neural network for RUL
│   │   ├── degradation_model.py  # Electromechanical degradation physics
│   │   └── feature_engineering.py
│   ├── api/                      # FastAPI serving layer
│   │   ├── main.py               # FastAPI app entry
│   │   ├── routes/               # API route definitions
│   │   └── schemas/              # Pydantic request/response schemas
│   ├── requirements.txt          # Python dependencies
│   └── Dockerfile                # AI service container
│
├── docs/                         # 📚 Documentation (YOU ARE HERE)
│   ├── README.md                 # Documentation hub index
│   ├── 00-overview/              # Project vision, glossary
│   ├── 01-architecture/          # System architecture, tech stack, directory structure
│   ├── 02-services/              # Service module specifications
│   ├── 03-data-models/           # Database schemas, ERDs
│   ├── 04-ux-flows/              # UX journeys, wireframes
│   ├── 05-integrations/          # External system integrations
│   ├── 06-ai-ml/                 # AI/ML specifications
│   ├── 07-digital-twin/          # Digital Twin design
│   ├── 08-safety/                # Safety mechanisms
│   ├── 09-srs/                   # Software Requirements Specification
│   └── 10-guidelines/            # Coding standards, contribution guide
│
├── public/                       # Static assets
│   ├── icons/                    # App icons
│   ├── maps/                     # Geospatial map tiles/data
│   └── sounds/                   # Alert sounds
│
├── tests/                        # Test suites (mirrors lib/ structure)
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── scripts/                      # DevOps and utility scripts
│   ├── seed-dev.ts               # Development database seeder
│   ├── migrate.ts                # Migration runner
│   └── generate-types.ts         # Auto-generate types from schemas
│
├── .env.example                  # Environment variable template
├── .gitignore                    # Git ignore rules
├── package.json                  # Node.js dependencies
├── tsconfig.json                 # TypeScript configuration
├── next.config.ts                # Next.js configuration
├── prisma.config.ts              # Prisma configuration
└── docker-compose.yml            # Local development stack
```

---

## Module Boundary Rules

> [!IMPORTANT]
> These rules are **non-negotiable**. Violating them creates spaghetti code that is impossible to maintain.

### Rule 1: Route Files Are Thin
```typescript
// ✅ CORRECT — app/api/blocks/route.ts
import { BlockService } from '@/lib/services/block-planning';
export async function GET() { return BlockService.getAll(); }

// ❌ WRONG — app/api/blocks/route.ts
export async function GET() {
  const blocks = await prisma.block.findMany({...}); // Business logic in route!
  // ... 50 lines of transformation logic
}
```

### Rule 2: Services Never Import From `app/`
```typescript
// ✅ CORRECT — lib/services/block-planning/block.service.ts
import { db } from '@/lib/db/prisma';

// ❌ WRONG — lib/services/block-planning/block.service.ts
import { SomeComponent } from '@/app/dashboard/blocks/SomeComponent'; // UI in service!
```

### Rule 3: Integration Clients Are Isolated
Each external system (TMS, SMMS, TDMS, COA) has its own directory under `lib/services/integrations/`. They **never** import from each other. Cross-integration logic lives in the service layer above them.

### Rule 4: Types Flow Downward
```
domain.ts (global) → service types.ts (module) → component props (local)
```
Never define a domain type inside a component file.

---

## Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Author | RailNexus Architecture Team |
