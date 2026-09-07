# ✅ Approval & Workflow Service

> **Module Path:** `lib/services/approval/`
> **Owner:** Core Engineering Team
> **Priority:** Critical (safety-critical authorization chain)

---

## Purpose

Manages the **multi-role approval workflow** for block proposals, including the legally mandated **Private Number exchange** and **Disconnection Memo** generation. Every block must pass through this service before track possession is authorized.

---

## Approval Chain

```
SSE/JE (Requestor)
    │
    │  submits block request
    ▼
AI Optimizer (Auto)
    │
    │  attaches optimization data, shadow blocks, corridor fit
    ▼
Section Controller
    │
    │  reviews traffic impact, approves/rejects
    │  (for strategic: routes to DRM)
    ▼
Station Master (Execution)
    │
    │  exchanges Private Number with SSE
    │  fetters signals, grants track possession
    ▼
Block ACTIVE
    │
    │  work executes
    ▼
SSE confirms completion
    │
    │  submits Reconnection Memo (if S&T)
    ▼
Station Master unfetters signals
    │
    ▼
Block COMPLETED
```

---

## Role Permissions (RBAC Matrix)

| Action | SSE/JE | Station Master | Section Controller | ADRM | DRM |
|--------|--------|---------------|-------------------|------|-----|
| Create block request | ✅ | ❌ | ❌ | ❌ | ❌ |
| Submit for optimization | ✅ | ❌ | ❌ | ❌ | ❌ |
| Approve daily block | ❌ | ❌ | ✅ | ✅ | ✅ |
| Approve weekly schedule | ❌ | ❌ | ✅ | ✅ | ✅ |
| Approve 26-week RBP | ❌ | ❌ | ❌ | ❌ | ✅ |
| Exchange Private Number | ✅ | ✅ | ❌ | ❌ | ❌ |
| Issue Disconnection Memo | ✅ (S&T) | ❌ | ❌ | ❌ | ❌ |
| Confirm Reconnection | ✅ (S&T) | ❌ | ❌ | ❌ | ❌ |
| Emergency block cancel | ❌ | ❌ | ✅ | ✅ | ✅ |
| Override AI proposal | ❌ | ❌ | ✅ | ✅ | ✅ |

---

## Private Number Exchange Protocol

The Private Number (PN) exchange is the **most safety-critical digital operation** in the system. It serves as a cryptographic, procedural handshake verifying that signals are locked and the track is secured.

### Flow

```
1. Controller approves block
2. System generates a unique PN (cryptographically secure, 6-digit)
3. Station Master receives PN notification
4. SSE receives PN notification
5. Both parties must acknowledge the SAME PN
6. On dual acknowledgment:
   - EI interface receives "fetter" command
   - Signals protecting the block section lock to RED
   - Block status transitions to ACTIVE
   - Kavach receives block zone data
7. PN is logged with timestamps, user IDs, and IP addresses
8. PN expires when block is completed and Reconnection confirmed
```

### Security Requirements

| Requirement | Implementation |
|-------------|---------------|
| PN uniqueness | UUID-derived, collision-free |
| PN encryption | AES-256 at rest, TLS 1.3 in transit |
| Dual-party verification | Both SM and SSE must acknowledge |
| Tamper-proof logging | Kafka immutable log + PostgreSQL audit table |
| Expiry | PN invalid after block completion + reconnection |
| Replay prevention | Each PN is single-use, timestamped |

---

## Disconnection Memo Service

Per G&SR regulations, any S&T maintenance that involves disconnecting signalling equipment requires a formal Disconnection Memo.

```typescript
interface DisconnectionMemo {
  id: string;
  blockId: string;
  
  // Equipment
  equipmentType: 'RELAY' | 'POINT_MACHINE' | 'TRACK_CIRCUIT' | 'SIGNAL' | 'EI_MODULE';
  equipmentId: string;
  location: string;              // Station + km marker
  
  // Authorization
  issuedBy: string;              // S&T SSE user ID
  issuedAt: Date;
  
  // Disconnection
  disconnectedAt?: Date;
  disconnectedBy?: string;
  
  // Reconnection
  reconnectedAt?: Date;
  reconnectedBy?: string;
  reconnectionTestResult?: 'PASS' | 'FAIL';
  
  // Digital Signature
  signature: string;             // Cryptographic signature of the memo content
  signatureAlgorithm: 'RSA-SHA256';
  
  status: 'ISSUED' | 'ACTIVE' | 'RECONNECTED' | 'VERIFIED';
}
```

---

## API Surface

```typescript
export class ApprovalService {
  static async submitForApproval(blockId: string): Promise<ApprovalRequest>;
  static async approve(requestId: string, approverId: string): Promise<ApprovalResult>;
  static async reject(requestId: string, reason: string): Promise<ApprovalResult>;
  static async getApprovalStatus(blockId: string): Promise<ApprovalStatus>;
  static async getPendingApprovals(userId: string): Promise<ApprovalRequest[]>;
}

export class PrivateNumberService {
  static async generate(blockId: string): Promise<PrivateNumber>;
  static async acknowledgeBySSE(pnId: string, sseId: string): Promise<void>;
  static async acknowledgeBySM(pnId: string, smId: string): Promise<void>;
  static async verifyDualAcknowledgment(pnId: string): Promise<boolean>;
  static async invalidate(pnId: string, reason: string): Promise<void>;
}

export class DisconnectionMemoService {
  static async issue(input: IssueMemoInput): Promise<DisconnectionMemo>;
  static async activateDisconnection(memoId: string): Promise<DisconnectionMemo>;
  static async confirmReconnection(memoId: string, testResult: string): Promise<DisconnectionMemo>;
  static async verify(memoId: string): Promise<VerificationResult>;
}
```

---

## Events

| Event | Consumers |
|-------|-----------|
| `approval.requested` | Notification (push to Controller) |
| `approval.approved` | Block Planning, Scheduling, Notification |
| `approval.rejected` | Block Planning, Notification |
| `pn.generated` | Notification (push to SM + SSE) |
| `pn.dual_acknowledged` | Safety System, Digital Twin, Kavach |
| `pn.invalidated` | Safety System, Digital Twin |
| `memo.issued` | Audit Log |
| `memo.reconnected` | Safety System, Block Planning |

---

## Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Author | RailNexus Architecture Team |
