# 🗄️ Database Schema & Data Models

> **Schema Location:** `prisma/schema.prisma`
> **Database:** PostgreSQL 16 (via Prisma 7.x)
> **Telemetry Database:** TimescaleDB (separate connection)

---

> [!WARNING]
> **NEVER modify the Prisma schema without updating this document first.**
> Schema changes require a migration plan reviewed by the Architecture Team.

---

## Entity Relationship Overview

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│    User      │────►│  Approval    │◄────│     Block        │
│              │     │  Request     │     │                  │
└──────┬───────┘     └──────────────┘     └────────┬─────────┘
       │                                           │
       │  RBAC                            ┌────────┼─────────┐
       │                                  │        │         │
       ▼                                  ▼        ▼         ▼
┌─────────────┐     ┌──────────────┐  ┌───────┐ ┌────┐  ┌──────┐
│    Role      │     │   Schedule   │  │Shadow │ │PN  │  │Discon│
│              │     │              │  │Block  │ │    │  │Memo  │
└─────────────┘     └──────┬───────┘  └───────┘ └────┘  └──────┘
                           │
                    ┌──────┼──────┐
                    │      │      │
                    ▼      ▼      ▼
              ┌────────┐┌──────┐┌──────────┐
              │Corridor││Sched.││ScheduleAudit│
              │        ││Block ││Log          │
              └────────┘└──────┘└──────────┘

              ┌───────────────────────────────┐
              │   EXTERNAL DATA (Read-Only)    │
              │  ┌─────┐ ┌─────┐ ┌────┐ ┌───┐│
              │  │Track│ │S&T  │ │TRD │ │COA││
              │  │Defect│ │Asset│ │Task│ │   ││
              │  └─────┘ └─────┘ └────┘ └───┘│
              └───────────────────────────────┘
```

---

## Core Domain Models

### User

```prisma
model User {
  id             String    @id @default(uuid())
  employeeId     String    @unique          // Railway employee ID
  name           String
  email          String    @unique
  phone          String?
  department     Department
  designation    Designation
  division       String                     // e.g., "BZA" (Vijayawada)
  section        String?                    // e.g., "BZA-TEL"
  station        String?                    // Home station code
  roleId         String
  role           Role      @relation(fields: [roleId], references: [id])
  
  // Relationships
  blocksRequested    Block[]          @relation("RequestedBy")
  approvalsGiven     ApprovalRequest[] @relation("ApprovedBy")
  
  isActive       Boolean   @default(true)
  lastLoginAt    DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}

enum Department {
  ENGINEERING
  TRD
  SIGNAL_TELECOM
  OPERATIONS
  ADMIN
}

enum Designation {
  JE              // Junior Engineer
  SSE             // Senior Section Engineer
  STATION_MASTER
  SECTION_CONTROLLER
  ADRM            // Additional Divisional Railway Manager
  DRM             // Divisional Railway Manager
  SYSTEM_ADMIN
}
```

### Role & Permission (RBAC)

```prisma
model Role {
  id          String       @id @default(uuid())
  name        String       @unique  // e.g., "SSE_ENGINEERING", "CONTROLLER"
  description String?
  permissions Permission[]
  users       User[]
  createdAt   DateTime     @default(now())
}

model Permission {
  id       String @id @default(uuid())
  action   String // e.g., "block:create", "block:approve", "schedule:lock"
  resource String // e.g., "block", "schedule", "approval"
  roleId   String
  role     Role   @relation(fields: [roleId], references: [id])
  
  @@unique([action, resource, roleId])
}
```

### Block

```prisma
model Block {
  id                    String      @id @default(uuid())
  department            Department
  type                  BlockType
  priority              BlockPriority
  status                BlockStatus @default(DRAFT)
  
  // Spatial
  division              String
  section               String
  fromStation           String
  toStation             String
  fromKm                Float
  toKm                  Float
  lineType              LineType
  
  // Temporal
  requestedDate         DateTime
  requestedStartTime    DateTime
  requestedEndTime      DateTime
  scheduledStartTime    DateTime?
  scheduledEndTime      DateTime?
  actualStartTime       DateTime?
  actualEndTime         DateTime?
  
  // Work Details
  workDescription       String
  machineryRequired     String[]
  staffCount            Int         @default(0)
  estimatedDurationMin  Int
  
  // Relationships
  parentBlockId         String?
  parentBlock           Block?      @relation("ShadowBlocks", fields: [parentBlockId], references: [id])
  shadowBlocks          Block[]     @relation("ShadowBlocks")
  
  defectId              String?
  trackDefect           TrackDefect? @relation(fields: [defectId], references: [id])
  
  requestedById         String
  requestedBy           User        @relation("RequestedBy", fields: [requestedById], references: [id])
  
  scheduleId            String?
  schedule              Schedule?   @relation(fields: [scheduleId], references: [id])
  
  approvalRequest       ApprovalRequest?
  privateNumber         PrivateNumber?
  disconnectionMemo     DisconnectionMemo?
  
  // AI Metadata
  aiConfidenceScore     Float?
  corridorUtilization   Float?
  aiProposalData        Json?       // Full AI proposal stored as JSONB
  
  // Audit
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt
  
  @@index([status, department])
  @@index([section, requestedDate])
  @@index([fromKm, toKm])
}

enum BlockType {
  TRAFFIC_BLOCK
  POWER_BLOCK
  SHADOW_BLOCK
  INTEGRATED_BLOCK
}

enum BlockPriority {
  IMR           // Immediate Removal — 3-day hard deadline
  PREDICTIVE    // PINN-generated pre-failure
  PREVENTIVE    // Scheduled preventive maintenance
  ROUTINE       // Regular maintenance
}

enum BlockStatus {
  DRAFT
  PROPOSED
  UNDER_REVIEW
  APPROVED
  ACTIVE
  COMPLETED
  REJECTED
  CANCELLED
  ARCHIVED
}

enum LineType {
  UP
  DOWN
  BOTH
}
```

### Schedule

```prisma
model Schedule {
  id                String          @id @default(uuid())
  horizon           ScheduleHorizon
  weekNumber        Int
  year              Int
  startDate         DateTime
  endDate           DateTime
  status            ScheduleStatus  @default(DRAFT)
  
  // Content
  blocks            Block[]
  corridors         Corridor[]
  
  // Approval
  approvalLevel     ApprovalLevel
  approvedById      String?
  publishedAt       DateTime?
  lockedAt          DateTime?
  
  // Metrics
  totalBlockHours        Float    @default(0)
  shadowBlockUtilization Float    @default(0)
  corridorUtilization    Float    @default(0)
  
  // Versioning
  version           Int          @default(1)
  
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt
  
  @@unique([horizon, weekNumber, year])
}

enum ScheduleHorizon {
  STRATEGIC     // 26-week RBP
  TACTICAL      // Monthly
  OPERATIONAL   // Weekly/Daily
}

enum ScheduleStatus {
  DRAFT
  PUBLISHED
  LOCKED
  EXECUTED
  ARCHIVED
}

enum ApprovalLevel {
  CONTROLLER
  ADRM
  DRM
  EMPOWERED_COMMITTEE
}
```

### Corridor

```prisma
model Corridor {
  id                String    @id @default(uuid())
  scheduleId        String
  schedule          Schedule  @relation(fields: [scheduleId], references: [id])
  
  section           String
  fromStation       String
  toStation         String
  startTime         DateTime
  endTime           DateTime
  durationMinutes   Int
  line              LineType
  
  isOccupied        Boolean   @default(false)
  occupiedByBlockId String?
  
  createdAt         DateTime  @default(now())
  
  @@index([section, startTime, endTime])
}
```

### Private Number

```prisma
model PrivateNumber {
  id                String    @id @default(uuid())
  blockId           String    @unique
  block             Block     @relation(fields: [blockId], references: [id])
  
  number            String    // Encrypted 6-digit code
  
  // Dual acknowledgment
  sseAcknowledged     Boolean   @default(false)
  sseAcknowledgedAt   DateTime?
  sseAcknowledgedById String?
  
  smAcknowledged      Boolean   @default(false)
  smAcknowledgedAt    DateTime?
  smAcknowledgedById  String?
  
  isActive            Boolean   @default(false)
  activatedAt         DateTime?
  invalidatedAt       DateTime?
  invalidationReason  String?
  
  createdAt           DateTime  @default(now())
}
```

### Disconnection Memo

```prisma
model DisconnectionMemo {
  id                  String    @id @default(uuid())
  blockId             String    @unique
  block               Block     @relation(fields: [blockId], references: [id])
  
  equipmentType       EquipmentType
  equipmentId         String
  location            String
  
  // Lifecycle
  issuedById          String
  issuedAt            DateTime  @default(now())
  
  disconnectedAt      DateTime?
  disconnectedById    String?
  
  reconnectedAt       DateTime?
  reconnectedById     String?
  testResult          TestResult?
  
  // Digital signature
  signature           String
  signatureAlgorithm  String    @default("RSA-SHA256")
  
  status              MemoStatus @default(ISSUED)
  
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}

enum EquipmentType {
  RELAY
  POINT_MACHINE
  TRACK_CIRCUIT
  SIGNAL
  EI_MODULE
}

enum TestResult {
  PASS
  FAIL
}

enum MemoStatus {
  ISSUED
  ACTIVE
  RECONNECTED
  VERIFIED
}
```

### Track Defect (Ingested from TMS)

```prisma
model TrackDefect {
  id              String        @id @default(uuid())
  externalId      String        @unique   // TMS defect ID
  source          String        @default("TMS")
  type            DefectType
  priority        BlockPriority
  
  section         String
  fromKm          Float
  toKm            Float
  line            LineType
  
  detectedAt      DateTime
  deadline        DateTime      // IMR: detectedAt + 3 days
  isOverdue       Boolean       @default(false)
  resolvedAt      DateTime?
  
  severity        Int           // TMS severity code
  usfdReading     Float?
  omsAcceleration Float?        // Peak g value
  tgiValue        Float?
  
  rawData         Json          // Original TMS payload for audit
  
  blocks          Block[]       // Blocks created to address this defect
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  
  @@index([type, isOverdue])
  @@index([section, detectedAt])
}

enum DefectType {
  IMR
  OBS
}
```

### Approval Request

```prisma
model ApprovalRequest {
  id              String          @id @default(uuid())
  blockId         String          @unique
  block           Block           @relation(fields: [blockId], references: [id])
  
  status          ApprovalStatus  @default(PENDING)
  approvalLevel   ApprovalLevel
  
  requestedAt     DateTime        @default(now())
  respondedAt     DateTime?
  
  approvedById    String?
  approvedBy      User?           @relation("ApprovedBy", fields: [approvedById], references: [id])
  
  rejectionReason String?
  comments        String?
  
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  ESCALATED
}
```

### Audit Log

```prisma
model AuditLog {
  id          String    @id @default(uuid())
  userId      String
  action      String    // e.g., "block.approved", "pn.exchanged"
  resource    String    // e.g., "Block", "PrivateNumber"
  resourceId  String
  details     Json      // Full action details
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime  @default(now())
  
  @@index([resource, resourceId])
  @@index([userId, createdAt])
}
```

---

## TimescaleDB Models (Telemetry — Separate Schema)

These models live in TimescaleDB and are NOT managed by Prisma. They use raw SQL via the `pg` driver.

```sql
-- Train Position Telemetry
CREATE TABLE train_positions (
  time          TIMESTAMPTZ NOT NULL,
  train_id      TEXT NOT NULL,
  latitude      DOUBLE PRECISION,
  longitude     DOUBLE PRECISION,
  speed_kmh     DOUBLE PRECISION,
  section       TEXT,
  km_marker     DOUBLE PRECISION,
  source        TEXT DEFAULT 'GPS'
);
SELECT create_hypertable('train_positions', 'time');

-- Signal State Changes
CREATE TABLE signal_states (
  time          TIMESTAMPTZ NOT NULL,
  signal_id     TEXT NOT NULL,
  station       TEXT NOT NULL,
  aspect        TEXT NOT NULL,  -- 'RED', 'YELLOW', 'DOUBLE_YELLOW', 'GREEN'
  previous      TEXT
);
SELECT create_hypertable('signal_states', 'time');

-- Track Circuit Occupancy
CREATE TABLE track_circuit_states (
  time          TIMESTAMPTZ NOT NULL,
  tc_id         TEXT NOT NULL,
  section       TEXT NOT NULL,
  is_occupied   BOOLEAN NOT NULL,
  impedance     DOUBLE PRECISION
);
SELECT create_hypertable('track_circuit_states', 'time');

-- Point Machine Metrics
CREATE TABLE point_machine_metrics (
  time          TIMESTAMPTZ NOT NULL,
  pm_id         TEXT NOT NULL,
  station       TEXT NOT NULL,
  current_draw  DOUBLE PRECISION,
  position      TEXT,  -- 'NORMAL', 'REVERSE', 'OOC'
  throw_time_ms INT
);
SELECT create_hypertable('point_machine_metrics', 'time');

-- S&T Equipment RUL Predictions
CREATE TABLE rul_predictions (
  time          TIMESTAMPTZ NOT NULL,
  equipment_id  TEXT NOT NULL,
  rul_days      DOUBLE PRECISION,
  confidence    DOUBLE PRECISION,
  failure_mode  TEXT,
  urgency       TEXT
);
SELECT create_hypertable('rul_predictions', 'time');
```

---

## Indexing Strategy

| Table | Index | Purpose |
|-------|-------|---------|
| Block | `(status, department)` | Filter blocks by status per department |
| Block | `(section, requestedDate)` | Section-level date queries |
| Block | `(fromKm, toKm)` | Spatial overlap detection for shadow blocks |
| TrackDefect | `(type, isOverdue)` | Quick IMR overdue alerting |
| Corridor | `(section, startTime, endTime)` | Corridor availability lookup |
| AuditLog | `(resource, resourceId)` | Resource-specific audit trail |
| AuditLog | `(userId, createdAt)` | User activity history |

---

## Migration Guidelines

> [!IMPORTANT]
> 1. Always create a new migration file — NEVER edit existing migrations.
> 2. Test migrations on a staging database before production.
> 3. All destructive operations (column drops, table drops) require Architecture Team approval.
> 4. Seed data must be updated alongside schema changes.

---

## Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Author | RailNexus Architecture Team |
