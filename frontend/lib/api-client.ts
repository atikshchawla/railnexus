const API_BASE = "http://localhost:8000/api";

// ── Blocks ─────────────────────────────────────────────────

export async function fetchBlocks() {
  const res = await fetch(`${API_BASE}/blocks`);
  if (!res.ok) throw new Error("Failed to fetch blocks");
  return res.json();
}

export async function approveBlock(id: string) {
  const res = await fetch(`${API_BASE}/blocks/${id}/approve`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to approve block");
  return res.json();
}

export async function rejectBlock(id: string) {
  const res = await fetch(`${API_BASE}/blocks/${id}/reject`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to reject block");
  return res.json();
}

// ── Conflicts ──────────────────────────────────────────────

export async function fetchConflicts() {
  const res = await fetch(`${API_BASE}/conflicts`);
  if (!res.ok) throw new Error("Failed to fetch conflicts");
  return res.json();
}

export async function previewConflictResolution(id: string, action: string) {
  const res = await fetch(`${API_BASE}/conflicts/${id}/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error("Failed to preview resolution");
  return res.json();
}

export async function resolveConflict(id: string, action: string) {
  const res = await fetch(`${API_BASE}/conflicts/${id}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error("Failed to resolve conflict");
  return res.json();
}

// ── Analytics ──────────────────────────────────────────────

export async function fetchAnalytics() {
  const res = await fetch(`${API_BASE}/analytics`);
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

// ── Health ─────────────────────────────────────────────────

export async function fetchHealth() {
  const res = await fetch("http://localhost:8000/health");
  if (!res.ok) throw new Error("Backend unavailable");
  return res.json();
}
