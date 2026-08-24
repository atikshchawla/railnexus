# 🔐 Auth & RBAC Service

> **Module Path:** `lib/services/auth/`
> **Owner:** Platform Engineering Team
> **Priority:** Critical (gates all system access)

---

## Purpose

Manages authentication (who are you?), authorization (what can you do?), and session management for all RailNexus users. Implements a strict Role-Based Access Control (RBAC) model aligned with Indian Railways' organizational hierarchy.

---

## Authentication Flow

```
User enters credentials
        │
        ▼
NextAuth.js validates against:
├── Railway employee database (primary)
├── LDAP/Active Directory (if available)
└── Local Prisma user table (fallback)
        │
        ▼
MFA challenge (for Controller and above)
        │
        ▼
JWT issued (8-hour expiry)
        │
        ▼
Session stored in Redis
```

---

## Role Hierarchy

```
SYSTEM_ADMIN
    │
    ├── DRM (Divisional Railway Manager)
    │   │
    │   ├── ADRM (Additional DRM)
    │   │   │
    │   │   └── SECTION_CONTROLLER
    │   │       │
    │   │       ├── STATION_MASTER
    │   │       │
    │   │       └── SSE (Senior Section Engineer)
    │   │           │
    │   │           └── JE (Junior Engineer)
    │   │
    │   └── EMPOWERED_COMMITTEE (cross-departmental)
    │
    └── SAFETY_AUDITOR (read-only, cross-divisional)
```

---

## Permission Matrix (Detailed)

| Permission | JE | SSE | SM | Controller | ADRM | DRM | Admin |
|-----------|----|----|-----|-----------|------|-----|-------|
| `block:create` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `block:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `block:update` | ✅* | ✅* | ❌ | ❌ | ❌ | ❌ | ✅ |
| `block:approve_daily` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `block:approve_weekly` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `block:approve_strategic` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `block:emergency_cancel` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `pn:exchange` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `memo:issue` | ✅† | ✅† | ❌ | ❌ | ❌ | ❌ | ❌ |
| `memo:reconnect` | ✅† | ✅† | ❌ | ❌ | ❌ | ❌ | ❌ |
| `schedule:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `schedule:lock` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `twin:view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `audit:read` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `user:manage` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

*Only own blocks, before submission. †S&T department only.

---

## API Surface

```typescript
export class AuthService {
  static async login(credentials: LoginInput): Promise<Session>;
  static async logout(sessionId: string): Promise<void>;
  static async validateSession(token: string): Promise<User>;
  static async refreshToken(token: string): Promise<string>;
}

export class RBACService {
  static async checkPermission(userId: string, action: string, resource: string): Promise<boolean>;
  static async getUserPermissions(userId: string): Promise<Permission[]>;
  static async assignRole(userId: string, roleId: string): Promise<void>;
  static async createRole(input: CreateRoleInput): Promise<Role>;
}
```

---

## Security Specifications

| Aspect | Specification |
|--------|--------------|
| Password hashing | bcrypt (cost factor 12) |
| JWT algorithm | RS256 (asymmetric) |
| Token expiry | Access: 1 hour, Refresh: 8 hours |
| MFA | TOTP (Google Authenticator compatible) |
| Brute force protection | 5 attempts → 15 min lockout |
| Session concurrency | Max 3 active sessions per user |
| IP whitelisting | Optional, per-role configurable |

---

## Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Author | RailNexus Architecture Team |
