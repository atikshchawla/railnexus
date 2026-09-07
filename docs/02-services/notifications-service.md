# 🔔 Notifications Service

> **Module Path:** `lib/services/notifications/`
> **Owner:** Platform Engineering Team
> **Priority:** High

---

## Purpose

Delivers real-time alerts and notifications to operators across multiple channels. Critical for ensuring safety alerts reach all relevant personnel immediately.

---

## Notification Channels

| Channel | Use Case | Latency Target | Technology |
|---------|----------|----------------|-----------|
| **In-App Push** | All notifications | < 1 second | WebSocket (Socket.IO) |
| **Browser Push** | Block approvals, schedule updates | < 5 seconds | Web Push API |
| **SMS** | Safety alerts, emergency cancellations | < 30 seconds | SMS gateway |
| **Email** | Daily summaries, 26-week schedule publications | < 5 minutes | SMTP |
| **Audible Alarm** | OOC detection, safety-critical events | < 500ms | Browser Audio API |

---

## Notification Priority Matrix

| Priority | Events | Channels | Persistence |
|----------|--------|----------|-------------|
| **CRITICAL** | OOC detected, IMR overdue, Kavach alert, emergency cancellation | In-App + SMS + Audible Alarm | Until acknowledged |
| **HIGH** | Block approved/rejected, PN generated, AI proposal ready | In-App + Browser Push | 24 hours |
| **MEDIUM** | Schedule published, corridor update, RUL warning | In-App + Browser Push | 48 hours |
| **LOW** | Task completed, system maintenance, reports ready | In-App | 7 days |

---

## Notification Templates

### Block Proposal (HIGH)
```
🤖 AI Block Proposal
Block #BLK-{id} | {department} | {section}
"{aiSummary}"
Confidence: {confidence}%
Shadow blocks: {shadowCount}
[Review] [Dismiss]
```

### IMR Alert (CRITICAL)
```
🚨 IMR Defect — ACTION REQUIRED
Defect #{defectId} at Km {location}
Type: {defectType}
Deadline: {deadline} ({hoursRemaining}h remaining)
AI has generated emergency block proposal.
[View Proposal] [View in Twin]
```

### Private Number Generated (HIGH)
```
🔐 Private Number Ready
Block #BLK-{id} approved.
PN: {maskedPN} (tap to reveal)
Awaiting dual acknowledgment:
☐ Station Master
☐ Section Engineer
```

---

## API Surface

```typescript
export class NotificationService {
  static async send(input: SendNotificationInput): Promise<void>;
  static async sendBulk(inputs: SendNotificationInput[]): Promise<void>;
  static async getUnread(userId: string): Promise<Notification[]>;
  static async markRead(notificationId: string): Promise<void>;
  static async markAllRead(userId: string): Promise<void>;
  static async getPreferences(userId: string): Promise<NotificationPreferences>;
  static async updatePreferences(userId: string, prefs: Partial<NotificationPreferences>): Promise<void>;
}
```

---

## Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | `2026-08-24` |
| Author | RailNexus Architecture Team |
