# 🧱 Block Planning Service

> **Module Path:** `lib/services/block-planning/`
> **Owner:** Core Engineering Team
> **Priority:** Critical — this is the central domain service of RailNexus.

---

## Purpose

The Block Planning Service is the **heart of RailNexus**. It manages the complete lifecycle of maintenance blocks — from creation of a request, through shadow block identification, to scheduling, approval, execution, and closure.

---

## Responsibilities

| # | Responsibility | Description |
|---|---------------|-------------|
| 1 | **Block Request Management** | CRUD operations for maintenance block requests from all three departments (Engg, TRD, S&T). |
| 2 | **Shadow Block Identification** | Detect when multiple department tasks overlap spatially, and propose consolidated shadow blocks. |
| 3 | **Corridor Analysis** | Parse COA timetable data to identify available time windows (corridors) for block insertion. |
| 4 | **Priority Classification** | Classify blocks by urgency: IMR (forced, 3-day deadline), Predictive (PINN-generated), Preventive, Routine. |
| 5 | **Block Lifecycle Tracking** | Track state transitions: `DRAFT → PROPOSED → UNDER_REVIEW → APPROVED → ACTIVE → COMPLETED → ARCHIVED`. |
| 6 | **Conflict Detection** | Identify scheduling conflicts (overlapping blocks, timetable violations, resource collisions). |

---

## Block Lifecycle State Machine

```
                    ┌─────────────┐
                    │   DRAFT     │  (SSE creates request)
                    └──────┬──────┘
                           │ submit()
                    ┌──────▼──────┐
                    │  PROPOSED   │  (AI attaches optimization data)
                    └──────┬──────┘
                           │ route_for_review()
                    ┌──────▼──────┐
               ┌────┤ UNDER_REVIEW│  (Controller reviews)
               │    └──────┬──────┘
               │           │ approve()
        reject()│    ┌──────▼──────┐
               │    │  APPROVED   │  (Scheduled for execution)
               │    └──────┬──────┘
               │           │ activate()
               │    ┌──────▼──────┐
               │    │   ACTIVE    │  (Block in progress, track occupied)
               │    └──────┬──────┘
               │           │ complete()
               │    ┌──────▼──────┐
               │    │ COMPLETED   │  (Work done, track restored)
               │    └──────┬──────┘
               │           │ archive()
               │    ┌──────▼──────┐
               └───►│  ARCHIVED   │  (Historical record)
                    │  / REJECTED │
                    └─────────────┘
```

---

## Data Model (Summary)

> Full schema in [`03-data-models/`](../03-data-models/database-schema.md)

```typescript
interface Block {
  id: string;                    // UUID
  department: 'ENGINEERING' | 'TRD' | 'S&T';
  type: 'TRAFFIC_BLOCK' | 'POWER_BLOCK' | 'SHADOW_BLOCK' | 'INTEGRATED_BLOCK';
  priority: 'IMR' | 'PREDICTIVE' | 'PREVENTIVE' | 'ROUTINE';
  status: BlockStatus;
  
  // Spatial
  division: string;
  section: string;
  fromStation: string;
  toStation: string;
  fromKm: number;
  toKm: number;
  lineType: 'UP' | 'DOWN' | 'BOTH';
  
  // Temporal
  requestedDate: Date;
  requestedStartTime: Date;
  requestedEndTime: Date;
  scheduledStartTime?: Date;
  scheduledEndTime?: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  
  // Work Details
  workDescription: string;
  machineryRequired: string[];
  staffCount: number;
  estimatedDurationMinutes: number;
  
  // Relationships
  parentBlockId?: string;        // If this is a shadow block, reference to parent
  shadowBlocks: Block[];         // Child shadow blocks
  defectId?: string;             // Link to TMS/SMMS defect that triggered this
  scheduleId?: string;           // Link to RBP schedule entry
  
  // Authorization
  requestedBy: string;           // SSE/JE user ID
  approvedBy?: string;           // Controller user ID
  privateNumber?: string;        // Encrypted PN for execution
  disconnectionMemoId?: string;  // Link to DM if S&T work involved
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  aiConfidenceScore?: number;    // AI's confidence in the proposed timing
  corridorUtilization?: number;  // % of available corridor used by this block
}
```

---

## API Surface

### Internal (TypeScript module API)

```typescript
// lib/services/block-planning/index.ts

export class BlockService {
  // CRUD
  static async create(input: CreateBlockInput): Promise<Block>;
  static async getById(id: string): Promise<Block>;
  static async getAll(filters: BlockFilters): Promise<PaginatedResult<Block>>;
  static async update(id: string, input: UpdateBlockInput): Promise<Block>;
  
  // Lifecycle
  static async submit(id: string): Promise<Block>;
  static async approve(id: string, approverId: string): Promise<Block>;
  static async reject(id: string, reason: string): Promise<Block>;
  static async activate(id: string, privateNumber: string): Promise<Block>;
  static async complete(id: string): Promise<Block>;
  
  // Intelligence
  static async findShadowOpportunities(blockId: string): Promise<ShadowOpportunity[]>;
  static async checkConflicts(block: Block): Promise<Conflict[]>;
  static async estimateImpact(block: Block): Promise<ImpactAssessment>;
}

export class CorridorService {
  static async findAvailableCorridors(params: CorridorSearchParams): Promise<Corridor[]>;
  static async evaluateCorridorFit(block: Block, corridor: Corridor): Promise<FitResult>;
}
```

### External (REST API)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/blocks` | Create a new block request |
| `GET` | `/api/blocks` | List blocks with filters (status, department, date range) |
| `GET` | `/api/blocks/:id` | Get block details |
| `PATCH` | `/api/blocks/:id` | Update block details |
| `POST` | `/api/blocks/:id/submit` | Submit block for AI optimization |
| `POST` | `/api/blocks/:id/approve` | Approve block (Controller role) |
| `POST` | `/api/blocks/:id/reject` | Reject block with reason |
| `POST` | `/api/blocks/:id/activate` | Activate block (begin execution) |
| `POST` | `/api/blocks/:id/complete` | Mark block as completed |
| `GET` | `/api/blocks/:id/shadows` | Get shadow block opportunities |
| `GET` | `/api/blocks/:id/conflicts` | Check for scheduling conflicts |
| `GET` | `/api/blocks/:id/impact` | Get impact assessment |
| `GET` | `/api/corridors` | Find available corridors |

---

## Events Emitted (Kafka)

| Event | Payload | Consumers |
|-------|---------|-----------|
| `block.created` | `{ blockId, department, priority }` | AI Optimizer, Notification Service |
| `block.submitted` | `{ blockId, optimizationData }` | AI Optimizer |
| `block.approved` | `{ blockId, approverId }` | Notification Service, Scheduling Service |
| `block.rejected` | `{ blockId, reason }` | Notification Service |
| `block.activated` | `{ blockId, privateNumber }` | Digital Twin, Safety System, Kavach Feed |
| `block.completed` | `{ blockId, actualDuration }` | Analytics, Scheduling Service |
| `block.conflict_detected` | `{ blockId, conflictDetails }` | Notification Service |

---

## Shadow Block Algorithm (Pseudocode)

```
function findShadowOpportunities(primaryBlock):
    // 1. Get all pending tasks within the spatial range of the primary block
    pendingTasks = queryPendingTasks(
        fromKm: primaryBlock.fromKm,
        toKm: primaryBlock.toKm,
        section: primaryBlock.section,
        departments: ALL except primaryBlock.department
    )
    
    // 2. Filter tasks that can physically fit within the block duration
    feasibleTasks = pendingTasks.filter(task =>
        task.estimatedDuration <= primaryBlock.duration AND
        noPhysicalCollision(task.machinery, primaryBlock.machinery)
    )
    
    // 3. Check TRD power isolation compatibility
    if primaryBlock.department == 'ENGINEERING':
        trdTasks = feasibleTasks.filter(t => t.department == 'TRD')
        for task in trdTasks:
            if requiresPowerBlock(task):
                // TRD can work if OHE is already de-energized for safety
                task.shadowCompatibility = 'REQUIRES_POWER_ISOLATION'
    
    // 4. Sequence S&T disconnection requirements
    s&tTasks = feasibleTasks.filter(t => t.department == 'S&T')
    for task in s&tTasks:
        if requiresDisconnection(task):
            task.disconnectionMemo = generateDisconnectionMemo(task)
    
    // 5. Return scored opportunities
    return feasibleTasks.map(task => ({
        task,
        timeSaved: task.estimatedDuration, // Hours saved by bundling
        confidenceScore: calculateConfidence(task, primaryBlock),
        constraints: getConstraints(task, primaryBlock)
    }))
```

---

## Error Handling

| Error Code | Condition | Response |
|------------|-----------|----------|
| `BLOCK_001` | IMR deadline violated (>3 days from detection) | Force-insert block, alert DRM |
| `BLOCK_002` | Corridor not available | Suggest alternative corridors |
| `BLOCK_003` | Shadow block physical collision | Reject shadow, explain machinery conflict |
| `BLOCK_004` | Block overlaps with approved block | Return conflict details |
| `BLOCK_005` | Private Number validation failed | Reject activation, require re-exchange |

---

## Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Author | RailNexus Architecture Team |
