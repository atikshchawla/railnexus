# 📏 Contribution Guide & Coding Standards

> **Every contributor MUST read this document before writing a single line of code.**

---

## 🚫 WHAT TO NEVER TOUCH

> [!CAUTION]
> The following are **absolute prohibitions**. Violating any of these will result in immediate PR rejection and mandatory review.

### 1. Safety Execution Plane Code
- **NEVER** write code that sends commands to EI hardware, signals, or point machines.
- **NEVER** write code that bypasses the Private Number exchange protocol.
- **NEVER** modify safety constants (IMR deadlines, SIL levels, timeout values).
- **NEVER** suppress, catch-and-ignore, or log-and-continue safety exceptions.

### 2. AI Weight Constants for Safety
- **NEVER** reduce `w₂` (IMR Penalty weight) in the optimization engine.
- **NEVER** allow AI to auto-approve blocks without human review.
- **NEVER** remove the human-in-the-loop requirement from any workflow.

### 3. Audit Trail
- **NEVER** delete, modify, or truncate audit log entries.
- **NEVER** disable audit logging, even in development.
- **NEVER** store unencrypted Private Numbers in logs.

### 4. Database Migrations
- **NEVER** edit an existing migration file.
- **NEVER** drop a column or table without Architecture Team approval.
- **NEVER** run migrations directly on production.

### 5. External System Adapters
- **NEVER** write to SMMS (read-only interface — SIL-4 boundary).
- **NEVER** expose raw external system data to frontend components.
- **NEVER** couple integration adapters to each other.

---

## ✅ WHAT TO ALWAYS DO

### 1. Follow the Module Boundary
```
app/           → Thin route handlers ONLY (import from lib/)
components/    → UI components ONLY (no business logic)
lib/services/  → ALL business logic (the heart of the app)
lib/types/     → Global type definitions
lib/utils/     → Shared utility functions
ai/            → Python AI/ML code (separate process)
```

### 2. Use the Standard Module Pattern
Every service module follows this structure:
```
lib/services/<module>/
├── index.ts            # Public API exports
├── <module>.service.ts # Service implementation
├── types.ts            # Module-specific types
└── <other>.service.ts  # Additional service files as needed
```

### 3. Type Everything
```typescript
// ✅ CORRECT
async function getBlock(id: string): Promise<Block> { ... }

// ❌ WRONG
async function getBlock(id: any): Promise<any> { ... }
```

### 4. Use Domain Types
```typescript
// ✅ CORRECT — Import from canonical source
import type { Block, BlockStatus } from '@/lib/types/domain';

// ❌ WRONG — Ad-hoc type definition
interface Block { id: string; status: string; } // Duplicated!
```

### 5. Handle Errors Properly
```typescript
// ✅ CORRECT — Use typed errors
import { BlockNotFoundError, ConflictError } from '@/lib/errors';

try {
  await blockService.activate(id);
} catch (error) {
  if (error instanceof ConflictError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  throw error; // Re-throw unexpected errors
}
```

### 6. Write Tests
- **Every service method** must have a unit test.
- **Every API route** must have an integration test.
- **Every safety-related function** must have 100% test coverage.

### 7. Document API Changes
If you add or modify an API endpoint:
1. Update the service spec in `docs/02-services/`.
2. Update the SRS if it's a new functional requirement.
3. Add the endpoint to the API route table.

---

## 🎨 Coding Style

### TypeScript / JavaScript

| Rule | Standard |
|------|----------|
| Formatter | Prettier (default config) |
| Linter | ESLint with Next.js config |
| Naming (variables) | `camelCase` |
| Naming (types/interfaces) | `PascalCase` |
| Naming (constants) | `UPPER_SNAKE_CASE` |
| Naming (files) | `kebab-case.ts` for utilities, `PascalCase.tsx` for components |
| Naming (service files) | `<name>.service.ts` |
| Imports | Absolute paths with `@/` prefix |
| Exports | Named exports (avoid default exports) |
| Async | Always use `async/await` (never raw Promises) |
| Null handling | Use `null` for intentional absence, `undefined` for optional params |

### Python (AI/ML)

| Rule | Standard |
|------|----------|
| Formatter | Black (default config) |
| Linter | Ruff |
| Naming | PEP 8 (snake_case for functions/variables, PascalCase for classes) |
| Type hints | Required for all function signatures |
| Docstrings | Google style |
| Imports | isort for ordering |

---

## 📂 File Organization Rules

### Rule 1: One Concern Per File
```
// ✅ CORRECT
block.service.ts        → Block CRUD
shadow-block.service.ts → Shadow block logic
corridor.service.ts     → Corridor analysis

// ❌ WRONG
block.service.ts        → Block CRUD + Shadow logic + Corridor analysis (500 lines)
```

### Rule 2: Index Files Are Public APIs
```typescript
// lib/services/block-planning/index.ts
// This is the ONLY import path other modules should use

export { BlockService } from './block.service';
export { CorridorService } from './corridor.service';
export type { Block, BlockFilters, CreateBlockInput } from './types';

// Internal helpers are NOT exported
```

### Rule 3: Component Structure
```
components/<feature>/
├── FeatureComponent.tsx     # Main component
├── FeatureComponent.test.tsx # Tests
├── sub-components/          # Internal sub-components
└── hooks/                   # Component-specific hooks (if needed)
```

---

## 🔀 Git Workflow

### Branch Naming
```
feature/<ticket-id>-<short-description>
bugfix/<ticket-id>-<short-description>
hotfix/<ticket-id>-<short-description>
docs/<description>
```

### Commit Messages
Follow Conventional Commits:
```
feat(block-planning): add shadow block identification
fix(digital-twin): correct signal aspect color mapping
docs(safety): update OOC detection protocol
refactor(scheduling): extract corridor analysis to separate service
test(approval): add PN exchange integration tests
```

### PR Requirements
- [ ] All tests pass
- [ ] No linting errors
- [ ] Documentation updated (if applicable)
- [ ] Safety Team review (if touching safety modules)
- [ ] Architecture Team review (if touching schemas/architecture)
- [ ] At least 1 peer approval

---

## 🏗️ Development Setup

### Prerequisites
- Node.js 22.x LTS
- Python 3.12+ (for AI modules)
- PostgreSQL 16
- Redis 7.x
- Docker & Docker Compose

### Quick Start
```bash
# Clone and checkout
git clone <repo-url>
cd railnexus
git checkout demo

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database credentials

# Start infrastructure (PostgreSQL, Redis, Kafka)
docker-compose up -d

# Run database migrations
npx prisma migrate dev

# Seed development data
npx tsx scripts/seed-dev.ts

# Start development server
npm run dev
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `TIMESCALE_URL` | TimescaleDB connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `KAFKA_BROKERS` | Kafka broker addresses | Yes |
| `AI_SERVICE_URL` | Python AI service URL | Yes |
| `NEXTAUTH_SECRET` | Auth encryption secret | Yes |
| `NEXTAUTH_URL` | Application base URL | Yes |
| `TMS_API_URL` | TMS external API URL | For integration |
| `SMMS_MQTT_URL` | SMMS MQTT broker URL | For integration |
| `TDMS_API_URL` | TDMS external API URL | For integration |
| `COA_KAFKA_BROKERS` | COA Kafka brokers | For integration |
| `KAVACH_ENDPOINT` | Kavach feed endpoint | For safety integration |

---

## 📐 Architecture Decision Records (ADR)

When making a significant architectural decision, create an ADR:

```markdown
# ADR-XXX: <Decision Title>

## Status: Proposed | Accepted | Deprecated | Superseded

## Context
What is the issue or decision we're facing?

## Decision
What have we decided to do?

## Consequences
What are the positive and negative consequences?

## Alternatives Considered
What other options were evaluated?
```

Store ADRs in `docs/01-architecture/adrs/`.

---

## Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Author | RailNexus Architecture Team |
