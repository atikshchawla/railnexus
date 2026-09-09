import type { BlockRecord, ConflictRecord } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Blocks ─────────────────────────────────────────────────

export async function fetchBlocks() {
  return request<BlockRecord[]>("/blocks");
}

export async function approveBlock(id: string) {
  return request(`/blocks/${id}/approve`, { method: "POST" });
}

export async function rejectBlock(id: string) {
  return request(`/blocks/${id}/reject`, { method: "POST" });
}

export async function fetchMaintenance(status?: string) {
  return request(`/maintenance${status ? `?status=${encodeURIComponent(status)}` : ""}`);
}

export async function createMaintenance(payload: Record<string, unknown>) {
  return request("/maintenance", { method: "POST", body: JSON.stringify(payload) });
}

export async function predictMaintenance(id: string) {
  return request(`/maintenance/${id}/predict`, { method: "POST" });
}

export async function optimizeMaintenance(payload: {
  request_ids: string[];
  max_group_size?: number;
  max_spatial_gap_km?: number;
  weights?: Record<string, number>;
}) {
  return request("/optimizer/optimize", { method: "POST", body: JSON.stringify(payload) });
}

export async function fetchPredictions() {
  return request("/predictions");
}

export async function fetchAssets(sectionId?: string) {
  return request(`/assets${sectionId ? `?section_id=${encodeURIComponent(sectionId)}` : ""}`);
}

export async function fetchTrains() {
  return request("/trains");
}

export async function fetchTopology(sectionId?: string) {
  return request(`/topology${sectionId ? `?section_id=${encodeURIComponent(sectionId)}` : ""}`);
}

// ── Conflicts ──────────────────────────────────────────────

export async function fetchConflicts() {
  return request<ConflictRecord[]>("/conflicts");
}

export async function previewConflictResolution(id: string, action: string) {
  return request(`/conflicts/${id}/preview`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export async function resolveConflict(id: string, action: string) {
  return request(`/conflicts/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

// ── Analytics ──────────────────────────────────────────────

export async function fetchAnalytics() {
  return request("/analytics");
}

// ── Health ─────────────────────────────────────────────────

export async function fetchHealth() {
  const res = await fetch(`${API_BASE.replace(/\/api$/, "")}/health`);
  if (!res.ok) throw new Error("Backend unavailable");
  return res.json();
}
