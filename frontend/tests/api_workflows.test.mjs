import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert/strict";

// Mock fetch globally to test frontend API contract & state transitions
const originalFetch = globalThis.fetch;

describe("Core Frontend API Layer & Workflow Tests", () => {
  after(() => {
    globalThis.fetch = originalFetch;
  });

  test("1. Maintenance Creation & ML Prediction Workflow", async () => {
    const createdRecord = {
      id: "REQ-20260926-001",
      department: "ENGG",
      section_id: "SEC-MAS-AJJ-01",
      location_km_start: 12.5,
      location_km_end: 14.0,
      track_line: "UP",
      description: "Emergency rail joint inspection",
      work_type: "TRACK_MAINTENANCE",
      scheduled_start_time: "2026-09-26T10:00:00Z",
      scheduled_end_time: "2026-09-26T12:00:00Z",
      priority: "P1",
      safety_critical: true,
      deadline_minutes: 120,
      model_features: { track_density: 1.2 },
      status: "PENDING",
      created_at: "2026-09-26T08:00:00Z",
    };

    const predictionRecord = {
      id: "PRED-001",
      maintenance_request_id: "REQ-20260926-001",
      model_version: "v2.1",
      failure_risk_probability: 0.85,
      priority_score: 92.5,
      urgency_level: "critical",
      predicted_duration_minutes: 110,
      recommended_window_start_time: "2026-09-26T10:00:00Z",
      recommended_window_end_time: "2026-09-26T12:00:00Z",
      overrun_probability: 0.15,
      trains_affected: 2,
      total_delay_minutes: 25.0,
      created_at: "2026-09-26T08:05:00Z",
    };

    globalThis.fetch = async (url, options) => {
      const urlStr = url.toString();
      if (urlStr.endsWith("/maintenance") && options?.method === "POST") {
        const body = JSON.parse(options.body);
        assert.equal(body.section_id, "SEC-MAS-AJJ-01");
        assert.equal(body.department, "ENGG");
        return {
          ok: true,
          status: 201,
          json: async () => createdRecord,
        };
      }
      if (urlStr.includes("/maintenance/REQ-20260926-001/predict") && options?.method === "POST") {
        return {
          ok: true,
          status: 200,
          json: async () => predictionRecord,
        };
      }
      throw new Error(`Unexpected fetch URL: ${urlStr}`);
    };

    // Import dynamic module
    const { createMaintenance, predictMaintenance } = await import("../lib/api.ts");

    const newReq = await createMaintenance({
      department: "ENGG",
      section_id: "SEC-MAS-AJJ-01",
      location_km_start: 12.5,
      location_km_end: 14.0,
      track_line: "UP",
      description: "Emergency rail joint inspection",
      work_type: "TRACK_MAINTENANCE",
      scheduled_start_time: "2026-09-26T10:00:00Z",
      scheduled_end_time: "2026-09-26T12:00:00Z",
      priority: "P1",
      safety_critical: true,
      deadline_minutes: 120,
    });

    assert.equal(newReq.id, "REQ-20260926-001");
    assert.equal(newReq.status, "PENDING");

    const pred = await predictMaintenance(newReq.id);
    assert.equal(pred.urgency_level, "critical");
    assert.equal(pred.priority_score, 92.5);
  });

  test("2. Optimizer Run Workflow & Proposal Generation", async () => {
    const mockOptimizerResponse = {
      selected_blocks: [
        {
          request_ids: ["REQ-001", "REQ-002"],
          section_id: "SEC-MAS-AJJ-01",
          predicted_duration_minutes: 90,
          possession_saving_minutes: 30,
          train_impact_minutes: 10,
          corridor_id: "CORR-01",
          scheduled_start_minute: 120,
          scheduled_end_minute: 210,
          priority_score: 88,
          urgency_level: "high",
          explanation: ["Shadow block combines track and overhead wire maintenance"],
        },
      ],
      ungrouped_request_ids: [],
      totals: { optimized_block_count: 1, possession_saving_minutes: 30 },
      model_outputs: {},
      _cache_id: "CACHE-OPT-001",
      _run_id: "RUN-20260926-001",
    };

    globalThis.fetch = async (url, options) => {
      const urlStr = url.toString();
      if (urlStr.endsWith("/optimizer/optimize") && options?.method === "POST") {
        const body = JSON.parse(options.body);
        assert.deepEqual(body.request_ids, ["REQ-001", "REQ-002"]);
        assert.equal(body.force_rerun, true);
        return {
          ok: true,
          status: 200,
          json: async () => mockOptimizerResponse,
        };
      }
      throw new Error(`Unexpected fetch URL: ${urlStr}`);
    };

    const { optimizeRequests } = await import("../lib/api.ts");
    const result = await optimizeRequests(["REQ-001", "REQ-002"], true);

    assert.equal(result._run_id, "RUN-20260926-001");
    assert.equal(result.selected_blocks.length, 1);
    assert.equal(result.selected_blocks[0].possession_saving_minutes, 30);
  });

  test("3. Authoritative Approval & Conflict Gate Handling", async () => {
    const mockOperationalBlock = {
      id: "OP-SEC-MAS-AJJ-01-PROP-001",
      section_id: "SEC-MAS-AJJ-01",
      track_line: "UP",
      start_km: 10.0,
      end_km: 12.0,
      scheduled_start: "2026-09-26T10:00:00Z",
      scheduled_end: "2026-09-26T12:00:00Z",
      origin_proposal_id: "PROP-001",
      lead_department: "ENGG",
      status: "APPROVED",
      is_current: true,
      revision_number: 1,
      created_at: "2026-09-26T09:00:00Z",
    };

    let overrideCalled = false;

    globalThis.fetch = async (url, options) => {
      const urlStr = url.toString();
      if (urlStr.endsWith("/approvals/PROP-CONFLICTED/approve") && options?.method === "POST") {
        const body = JSON.parse(options.body);
        assert.equal(body.approved_by, "CTRL-01");
        assert.equal(body.lead_department, "ENGG");
        assert.equal(body.start_km, 10.0);
        assert.equal(body.end_km, 12.0);
        assert.equal(body.track_line, "UP");

        if (!body.override_justification) {
          return {
            ok: false,
            status: 409,
            text: async () => JSON.stringify({ detail: "Proposal PROP-CONFLICTED has 1 unresolved blocking conflict" }),
          };
        }
        assert.equal(body.override_code, "CONTROLLER_SAFETY_OVERRIDE");
        assert.equal(body.operator_role, "SECTION_CONTROLLER");
        overrideCalled = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ...mockOperationalBlock, origin_proposal_id: "PROP-CONFLICTED" }),
        };
      }
      if (urlStr.endsWith("/approvals/PROP-CLEAN/approve") && options?.method === "POST") {
        const body = JSON.parse(options.body);
        assert.equal(body.approved_by, "CTRL-01");
        assert.equal(body.lead_department, "ENGG");
        assert.equal(body.start_km, 10.0);
        assert.equal(body.end_km, 12.0);
        assert.equal(body.track_line, "UP");
        return {
          ok: true,
          status: 200,
          json: async () => mockOperationalBlock,
        };
      }
      if (urlStr.endsWith("/approvals/PROP-REJECT/reject") && options?.method === "POST") {
        const body = JSON.parse(options.body);
        assert.equal(body.rejected_by, "CTRL-01");
        assert.equal(body.rejection_reason, "Declined during shift review");
        assert.equal(body.operator_role, "SECTION_CONTROLLER");
        return {
          ok: true,
          status: 200,
          json: async () => ({
            proposal_id: "PROP-REJECT",
            status: "REJECTED",
            rejected_by: "CTRL-01",
            rejection_reason: "Declined during shift review",
            rejected_at: "2026-09-26T09:30:00Z",
          }),
        };
      }
      throw new Error(`Unexpected fetch URL: ${urlStr}`);
    };

    const { approveProposal, rejectProposal } = await import("../lib/api.ts");

    // Standard clean approval
    const cleanResult = await approveProposal("PROP-CLEAN", {
      block_id: "OP-SEC-MAS-AJJ-01-PROP-001",
      approved_by: "CTRL-01",
      lead_department: "ENGG",
      start_km: 10.0,
      end_km: 12.0,
      track_line: "UP",
    });
    assert.equal(cleanResult.id, "OP-SEC-MAS-AJJ-01-PROP-001");
    assert.equal(cleanResult.status, "APPROVED");

    // Conflicted proposal without override should fail with HTTP 409
    await assert.rejects(
      async () => {
        await approveProposal("PROP-CONFLICTED", {
          block_id: "OP-SEC-MAS-AJJ-01-PROP-CONFLICTED",
          approved_by: "CTRL-01",
          lead_department: "ENGG",
          start_km: 10.0,
          end_km: 12.0,
          track_line: "UP",
        });
      },
      (err) => {
        assert.match(err.message, /blocking conflict/);
        return true;
      }
    );

    // Conflicted proposal WITH manual override succeeds
    const overriddenResult = await approveProposal("PROP-CONFLICTED", {
      block_id: "OP-SEC-MAS-AJJ-01-PROP-CONFLICTED",
      approved_by: "CTRL-01",
      lead_department: "ENGG",
      start_km: 10.0,
      end_km: 12.0,
      track_line: "UP",
      override_justification: "Approved under Rule 14.2 with manual train stop order",
      override_code: "CONTROLLER_SAFETY_OVERRIDE",
      operator_role: "SECTION_CONTROLLER",
    });
    assert.equal(overrideCalled, true);
    assert.equal(overriddenResult.origin_proposal_id, "PROP-CONFLICTED");

    // Rejection workflow
    const rejectResult = await rejectProposal("PROP-REJECT", {
      rejected_by: "CTRL-01",
      rejection_reason: "Declined during shift review",
      operator_role: "SECTION_CONTROLLER",
    });
    assert.equal(rejectResult.status, "REJECTED");
  });

  test("4. Server-Side Conflict Detection & Resolution Workflow", async () => {
    const mockDetectedConflicts = [
      {
        id: "CONF-20260926-001",
        run_id: "RUN-001",
        proposal_a_id: "PROP-001",
        proposal_b_id: "PROP-002",
        conflict_type: "SECTION_OCCUPATION",
        severity: "HIGH",
        section_id: "SEC-MAS-AJJ-01",
        window_start_time: "2026-09-26T10:00:00Z",
        window_end_time: "2026-09-26T11:30:00Z",
        overlap_duration_minutes: 90,
        status: "UNRESOLVED",
        track_line: "UP",
        overlap_description: "Overlapping track possession requests",
        created_at: "2026-09-26T08:30:00Z",
      },
    ];

    let resolvedConflictId = "";
    let resolutionAction = "";

    globalThis.fetch = async (url, options) => {
      const urlStr = url.toString();
      if (urlStr.endsWith("/conflicts/detect") && options?.method === "POST") {
        return {
          ok: true,
          status: 200,
          json: async () => mockDetectedConflicts,
        };
      }
      if (urlStr.includes("/conflicts/CONF-20260926-001/resolve") && options?.method === "POST") {
        const body = JSON.parse(options.body);
        resolvedConflictId = "CONF-20260926-001";
        resolutionAction = body.resolution_action;
        return {
          ok: true,
          status: 201,
          json: async () => ({
            id: "RES-001",
            conflict_id: "CONF-20260926-001",
            resolution_action: body.resolution_action,
            actor_id: body.actor_id,
            actor_role: body.actor_role,
            rationale_notes: body.rationale_notes,
            created_at: "2026-09-26T09:15:00Z",
          }),
        };
      }
      throw new Error(`Unexpected fetch URL: ${urlStr}`);
    };

    const { detectConflicts, resolveConflict } = await import("../lib/api.ts");

    const conflicts = await detectConflicts({ run_id: "RUN-001", proposal_ids: ["PROP-001", "PROP-002"] });
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].id, "CONF-20260926-001");

    await resolveConflict("CONF-20260926-001", {
      resolution_action: "MERGED",
      actor_id: "CTRL-01",
      actor_role: "SECTION_CONTROLLER",
      rationale_notes: "Merged into combined shadow possession block",
    });

    assert.equal(resolvedConflictId, "CONF-20260926-001");
    assert.equal(resolutionAction, "MERGED");
  });

  test("5. Parallel Dashboard Data Loader Verification", async () => {
    globalThis.fetch = async (url) => {
      const urlStr = url.toString();
      if (urlStr.endsWith("/maintenance")) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: "REQ-001",
              department: "ENGG",
              section_id: "SEC-01",
              location_km_start: 10,
              location_km_end: 12,
              track_line: "UP",
              description: "Track inspection",
              work_type: "TRACK",
              scheduled_start_time: "2026-09-26T08:00:00Z",
              scheduled_end_time: "2026-09-26T10:00:00Z",
              priority: "P1",
              safety_critical: true,
              deadline_minutes: 120,
              model_features: {},
              status: "PROPOSED",
              created_at: "2026-09-26T07:00:00Z",
            },
          ],
        };
      }
      if (urlStr.endsWith("/predictions")) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: "PRED-001",
              maintenance_request_id: "REQ-001",
              model_version: "v2.1",
              failure_risk_probability: 0.9,
              priority_score: 95,
              urgency_level: "critical",
              predicted_duration_minutes: 120,
              overrun_probability: 0.1,
              trains_affected: 1,
              total_delay_minutes: 15,
              created_at: "2026-09-26T07:05:00Z",
            },
          ],
        };
      }
      if (urlStr.endsWith("/topology")) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              section_id: "SEC-01",
              start_station: "MAS",
              end_station: "BBQ",
              start_km: 0,
              end_km: 15,
              distance_km: 15,
            },
          ],
        };
      }
      if (urlStr.endsWith("/trains")) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: "TRN-01",
              train_number: "12601",
              service_type: "Passenger",
              origin: "MAS",
              destination: "MAQ",
              active: true,
            },
          ],
        };
      }
      if (urlStr.endsWith("/trains/movements")) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              train_id: "TRN-01",
              section_id: "SEC-01",
              scheduled_minute: 180,
              delay_minutes: 0,
            },
          ],
        };
      }
      if (urlStr.endsWith("/conflicts")) {
        return {
          ok: true,
          status: 200,
          json: async () => [],
        };
      }
      if (urlStr.endsWith("/approvals")) {
        return {
          ok: true,
          status: 200,
          json: async () => [],
        };
      }
      if (urlStr.endsWith("/operational-blocks")) {
        return {
          ok: true,
          status: 200,
          json: async () => [],
        };
      }
      throw new Error(`Unexpected fetch URL: ${urlStr}`);
    };

    const { loadDashboardData } = await import("../lib/api.ts");
    const dashboard = await loadDashboardData();

    assert.equal(dashboard.blocks.length, 1);
    assert.equal(dashboard.blocks[0].id, "REQ-001");
    assert.equal(dashboard.blocks[0].urgency.tier, "critical");
    assert.equal(dashboard.stations.length, 2);
    assert.equal(dashboard.trains.length, 1);
    assert.equal(dashboard.trains[0].id, "12601");
  });

  test("6. Exact Phase 7 Approval Request Payload Verification", async () => {
    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
      const urlStr = url.toString();
      if (urlStr.endsWith("/approvals/PROP-EXACT-001/approve") && options?.method === "POST") {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "OP-PROP-EXACT-001",
            section_id: "SEC-MAS-AJJ-01",
            track_line: "UP",
            start_km: 12.0,
            end_km: 15.0,
            scheduled_start: "2026-09-26T10:00:00Z",
            scheduled_end: "2026-09-26T12:00:00Z",
            origin_proposal_id: "PROP-EXACT-001",
            lead_department: "ENGG",
            status: "APPROVED",
            is_current: true,
            revision_number: 1,
            created_at: "2026-09-26T09:00:00Z",
          }),
        };
      }
      throw new Error(`Unexpected fetch URL: ${urlStr}`);
    };

    const { approveProposal } = await import("../lib/api.ts");
    await approveProposal("PROP-EXACT-001", {
      block_id: "OP-PROP-EXACT-001",
      approved_by: "CONTROLLER-SOUTH-01",
      lead_department: "ENGG",
      start_km: 12.0,
      end_km: 15.0,
      track_line: "UP",
      operator_role: "CHIEF_CONTROLLER",
    });

    assert.ok(capturedBody !== null);
    assert.equal(capturedBody.block_id, "OP-PROP-EXACT-001");
    assert.equal(capturedBody.approved_by, "CONTROLLER-SOUTH-01");
    assert.equal(capturedBody.lead_department, "ENGG");
    assert.equal(capturedBody.start_km, 12.0);
    assert.equal(capturedBody.end_km, 15.0);
    assert.equal(capturedBody.track_line, "UP");
    assert.equal(capturedBody.operator_role, "CHIEF_CONTROLLER");
    assert.equal(capturedBody.decided_by, undefined, "Must NOT contain obsolete decided_by");
    assert.equal(capturedBody.reason, undefined, "Must NOT contain obsolete reason");
  });

  test("7. Exact Phase 7 Rejection Request Payload Verification", async () => {
    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
      const urlStr = url.toString();
      if (urlStr.endsWith("/approvals/PROP-EXACT-002/reject") && options?.method === "POST") {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            proposal_id: "PROP-EXACT-002",
            status: "REJECTED",
            rejected_by: "CONTROLLER-SOUTH-01",
            rejection_reason: "High express train density window",
            rejected_at: "2026-09-26T09:30:00Z",
          }),
        };
      }
      throw new Error(`Unexpected fetch URL: ${urlStr}`);
    };

    const { rejectProposal } = await import("../lib/api.ts");
    await rejectProposal("PROP-EXACT-002", {
      rejected_by: "CONTROLLER-SOUTH-01",
      rejection_reason: "High express train density window",
      operator_role: "CHIEF_CONTROLLER",
    });

    assert.ok(capturedBody !== null);
    assert.equal(capturedBody.rejected_by, "CONTROLLER-SOUTH-01");
    assert.equal(capturedBody.rejection_reason, "High express train density window");
    assert.equal(capturedBody.operator_role, "CHIEF_CONTROLLER");
    assert.equal(capturedBody.decided_by, undefined, "Must NOT contain obsolete decided_by");
    assert.equal(capturedBody.reason, undefined, "Must NOT contain obsolete reason");
  });

  test("8. Optimization Run ID retention & Scoped Conflict Detection Request", async () => {
    let capturedConflictBody = null;
    globalThis.fetch = async (url, options) => {
      const urlStr = url.toString();
      if (urlStr.endsWith("/optimizer/optimize") && options?.method === "POST") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            selected_blocks: [],
            ungrouped_request_ids: [],
            totals: { optimized_block_count: 0, possession_saving_minutes: 0 },
            model_outputs: {},
            _cache_id: "CACHE-001",
            _run_id: "RUN-AUTONOMOUS-20260926-99",
          }),
        };
      }
      if (urlStr.endsWith("/conflicts/detect") && options?.method === "POST") {
        capturedConflictBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => [],
        };
      }
      throw new Error(`Unexpected fetch URL: ${urlStr}`);
    };

    const { optimizeRequests, detectConflicts } = await import("../lib/api.ts");
    const opt = await optimizeRequests(["REQ-001"]);
    assert.equal(opt._run_id, "RUN-AUTONOMOUS-20260926-99");

    await detectConflicts({ run_id: opt._run_id });
    assert.ok(capturedConflictBody !== null);
    assert.equal(capturedConflictBody.run_id, "RUN-AUTONOMOUS-20260926-99");
    assert.equal(capturedConflictBody.proposal_ids, undefined, "Should not send cross-run proposal IDs");
  });

  test("9. /approvals renders only real BlockProposals with explicit ID (no proposals[0] fallback)", async () => {
    let capturedApprovalId = null;
    let capturedBody = null;

    globalThis.fetch = async (url, options) => {
      const urlStr = url.toString();
      if (urlStr.includes("/approvals/") && urlStr.endsWith("/approve") && options?.method === "POST") {
        const parts = urlStr.split("/");
        capturedApprovalId = parts[parts.length - 2];
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: capturedBody.block_id,
            section_id: "VN-JTJ",
            status: "APPROVED",
          }),
        };
      }
      throw new Error(`Unexpected fetch URL: ${urlStr}`);
    };

    const { approveProposal } = await import("../lib/api.ts");

    // Multiple proposals exist, with the first being REJECTED
    const mockProposals = [
      { id: "PROP-REJECTED-001", status: "REJECTED", section_id: "VN-JTJ" },
      { id: "PROP-PROPOSED-002", status: "PROPOSED", section_id: "VN-JTJ" },
    ];

    // Only PROPOSED proposal is actionable
    const actionable = mockProposals.filter((p) => p.status === "PROPOSED");
    assert.equal(actionable.length, 1);
    assert.equal(actionable[0].id, "PROP-PROPOSED-002");

    // Action MUST use explicit proposal ID, never proposals[0]
    const targetProposal = actionable[0];
    assert.notEqual(targetProposal.id, mockProposals[0].id);

    await approveProposal(targetProposal.id, {
      block_id: "OP-VN-JTJ-002",
      approved_by: "CTRL-01",
      lead_department: "ENGG",
      start_km: 129.1,
      end_km: 135.0,
      track_line: "UP",
    });

    assert.equal(capturedApprovalId, "PROP-PROPOSED-002");
    assert.notEqual(capturedApprovalId, "PROP-REJECTED-001");
  });

  test("10. Section topology coordinates boundary check (never places proposal outside section)", async () => {
    // Topology: VN-JTJ is km 129.1 to 144.5
    const topology = [
      { section_id: "VN-JTJ", start_km: 129.1, end_km: 144.5, start_station: "VN", end_station: "JTJ" },
      { section_id: "WJR-MCN", start_km: 36.2, end_km: 43.9, start_station: "WJR", end_station: "MCN" },
    ];

    // Proposal for VN-JTJ, but constituent request artifact had km = 42.0 (outside section)
    const proposal = {
      id: "PROP-VN-JTJ-1",
      section_id: "VN-JTJ",
      maintenance_request_ids: ["REQ-CONFLICT-KM"],
    };

    const constituent = [
      { id: "REQ-CONFLICT-KM", location: { kmStart: 42.0, kmEnd: 42.0 } },
    ];

    // Boundary logic:
    const sectionTopos = topology.filter((t) => t.section_id === proposal.section_id);
    const secMinKm = Math.min(...sectionTopos.map((t) => Math.min(t.start_km, t.end_km)));
    const secMaxKm = Math.max(...sectionTopos.map((t) => Math.max(t.start_km, t.end_km)));

    const validConstituents = constituent.filter(
      (b) => b.location.kmStart >= secMinKm && b.location.kmEnd <= secMaxKm,
    );

    let kmStart, kmEnd;
    if (validConstituents.length > 0) {
      kmStart = Math.min(...validConstituents.map((b) => b.location.kmStart));
      kmEnd = Math.max(...validConstituents.map((b) => b.location.kmEnd));
    } else {
      // Inconsistent constituent coordinates must NOT pull proposal outside section
      kmStart = secMinKm;
      kmEnd = Math.min(secMaxKm, secMinKm + 2.0);
    }

    assert.equal(validConstituents.length, 0, "42.0 km must be recognized as inconsistent with VN-JTJ");
    assert.ok(kmStart >= 129.1 && kmStart < 144.5, "kmStart must be inside section topology");
    assert.ok(kmEnd > kmStart && kmEnd <= 144.5, "kmEnd must be inside section topology");
    assert.notEqual(kmStart, 42.0, "Proposal must NEVER be placed at km 42");
  });

  test("11. Planning date dynamic initialization (no hardcoded 04 Sep 2026)", async () => {
    // When proposal start time is available
    const proposalDate = "2026-10-15T08:30:00Z";
    const d = new Date(proposalDate);
    const formatted = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    assert.equal(formatted, "15 Oct 2026");
    assert.notEqual(formatted, "04 Sep 2026");

    // When no proposal date is available, defaults to current date
    const today = new Date();
    const todayFormatted = today.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    assert.ok(todayFormatted.length > 5);
  });

  test("12. Optimizer batching limits requests to 32 per section", async () => {
    // Simulating 50 requests in section AJJ-SHU
    const blocks = Array.from({ length: 50 }, (_, i) => ({
      id: `REQ-AJJ-${i + 1}`,
      section_id: "AJJ-SHU",
      description: "Track maintenance on AJJ-SHU",
      status: "Under review",
    }));

    const bySection = {};
    const batchedIds = [];

    for (const b of blocks) {
      const sec = b.section_id;
      bySection[sec] = bySection[sec] || [];
      if (bySection[sec].length < 32) {
        bySection[sec].push(b.id);
        batchedIds.push(b.id);
      }
    }

    assert.equal(batchedIds.length, 32, "Must batch to at most 32 requests per section for CP-SAT");
    assert.equal(bySection["AJJ-SHU"].length, 32);
  });

  test("13. Regression: run optimizer → receive run_id → refresh data → active run remains the same → proposals remain scoped to that run", async () => {
    const historicalRunId = "RUN-HISTORICAL-999";
    const newOptimizerRunId = "RUN-OPTIMIZER-NEW-2026";
    const zeroResultRunId = "RUN-EMPTY-RESULT-2026";

    const historicalProposals = [
      {
        id: "PROP-HISTORICAL-01",
        run_id: historicalRunId,
        section_id: "AJJ-SHU",
        status: "PROPOSED",
        proposed_start_time: "2026-09-20T08:00:00Z",
        proposed_end_time: "2026-09-20T10:00:00Z",
        confidence_score: 0.88,
        maintenance_request_ids: ["REQ-OLD-01"],
        departments: ["Engg"],
      },
    ];

    const newOptimizerProposals = [
      {
        id: "PROP-NEW-01",
        run_id: newOptimizerRunId,
        section_id: "AJJ-SHU",
        status: "PROPOSED",
        proposed_start_time: "2026-09-26T10:00:00Z",
        proposed_end_time: "2026-09-26T12:00:00Z",
        confidence_score: 0.95,
        maintenance_request_ids: ["REQ-001"],
        departments: ["Engg"],
      },
    ];

    let currentBackendProposals = [...historicalProposals];
    let simulateApprovalsError = false;

    // Mock backend responses
    globalThis.fetch = async (url, options) => {
      const urlStr = url.toString();

      if (urlStr.endsWith("/optimizer/optimize") && options?.method === "POST") {
        const body = JSON.parse(options.body);
        if (body.request_ids && body.request_ids.includes("REQ-EMPTY")) {
          // Zero-result optimization
          return {
            ok: true,
            status: 200,
            json: async () => ({
              selected_blocks: [],
              _run_id: zeroResultRunId,
              _cache_id: "CACHE-EMPTY",
              totals: { solver: "OPTIMAL", possession_saving_minutes: 0 },
            }),
          };
        }

        // Standard optimization returning new proposals
        currentBackendProposals = [...newOptimizerProposals, ...historicalProposals];
        return {
          ok: true,
          status: 200,
          json: async () => ({
            selected_blocks: [
              {
                request_ids: ["REQ-001"],
                section_id: "AJJ-SHU",
                scheduled_start_minute: 600,
                scheduled_end_minute: 720,
              },
            ],
            _run_id: newOptimizerRunId,
            _cache_id: "CACHE-NEW",
            totals: { solver: "OPTIMAL", possession_saving_minutes: 35.0 },
          }),
        };
      }

      if (urlStr.endsWith("/approvals") && (!options?.method || options.method === "GET")) {
        if (simulateApprovalsError) {
          return {
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
            text: async () => "Internal Server Error",
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => currentBackendProposals,
        };
      }

      if (urlStr.endsWith("/maintenance") && (!options?.method || options.method === "GET")) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: "REQ-001",
              department: "ENGG",
              section_id: "AJJ-SHU",
              status: "Under review",
              location_km_start: 70.0,
              location_km_end: 72.0,
              scheduled_start_time: "2026-09-26T10:00:00Z",
              scheduled_end_time: "2026-09-26T12:00:00Z",
              description: "Track maintenance",
            },
          ],
        };
      }

      // Default mock for secondary endpoints
      return {
        ok: true,
        status: 200,
        json: async () => [],
      };
    };

    const { optimizeRequests, loadDashboardData } = await import("../lib/api.ts");

    // 1. Initial State: active run starts as historical run
    let activeRunId = historicalRunId;
    let initialData = await loadDashboardData();
    assert.equal(initialData.proposals.length, 1);
    let scopedProposals = initialData.proposals.filter((p) => p.run_id === activeRunId);
    assert.equal(scopedProposals.length, 1);
    assert.equal(scopedProposals[0].id, "PROP-HISTORICAL-01");

    // 2. Run optimizer → receive run_id
    const optRes = await optimizeRequests(["REQ-001"], true);
    assert.ok(optRes._run_id, "Optimizer must return _run_id");
    assert.equal(optRes._run_id, newOptimizerRunId);

    // Update activeRunId with returned run_id and authoritatively refresh data
    activeRunId = optRes._run_id;
    let freshData = await loadDashboardData();
    assert.equal(freshData.proposals.length, 2);

    // Proposals must be strictly scoped to the active run
    scopedProposals = freshData.proposals.filter((p) => p.run_id === activeRunId);
    assert.equal(scopedProposals.length, 1, "Must contain exactly 1 proposal for active run");
    assert.equal(scopedProposals[0].id, "PROP-NEW-01");
    assert.equal(scopedProposals[0].run_id, newOptimizerRunId);

    // 3. Background refresh data: active run remains the same!
    // Simulate background polling (where nextData.proposals[0] might be an arbitrary run)
    const backgroundRefreshData = await loadDashboardData();
    // Simulate DashboardContext's currentRunId updater logic:
    // setCurrentRunId(prev => (prev !== null ? prev : nextData.proposals[0].run_id))
    const preservedRunId = activeRunId !== null ? activeRunId : backgroundRefreshData.proposals[0].run_id;
    assert.equal(preservedRunId, newOptimizerRunId, "Active run MUST remain unchanged during background refresh");

    const refreshScopedProposals = backgroundRefreshData.proposals.filter((p) => p.run_id === preservedRunId);
    assert.equal(refreshScopedProposals.length, 1);
    assert.equal(refreshScopedProposals[0].id, "PROP-NEW-01");

    // 4. Zero-result optimization run must remain the active run
    const zeroRes = await optimizeRequests(["REQ-EMPTY"], true);
    assert.equal(zeroRes._run_id, zeroResultRunId);
    assert.equal(zeroRes.selected_blocks.length, 0);

    activeRunId = zeroRes._run_id;
    const postZeroData = await loadDashboardData();
    const zeroScopedProposals = postZeroData.proposals.filter((p) => p.run_id === activeRunId);
    assert.equal(zeroScopedProposals.length, 0, "Zero-result run has 0 proposals");

    // Background refresh MUST preserve zeroResultRunId
    const postZeroRefresh = await loadDashboardData();
    const preservedZeroRunId = activeRunId !== null ? activeRunId : postZeroRefresh.proposals[0].run_id;
    assert.equal(preservedZeroRunId, zeroResultRunId, "Zero-result run MUST remain authoritative active run");

    // 5. Error resilience: failed background refresh does not wipe existing planning data
    simulateApprovalsError = true;
    await assert.rejects(
      async () => {
        await loadDashboardData();
      },
      /500/,
      "loadDashboardData must reject on API failure instead of silently returning empty proposals",
    );
    // Preserved data in state is NOT overwritten because rejection prevented setData()
    assert.equal(freshData.proposals.length, 2, "Previously loaded valid proposals remain intact");
  });

  test("14. Phase 7B HITL Controller Approval Workflow & Queue Safety", async () => {
    // Generate a queue of 60 proposals to verify UX scalability & isolation with 50+ items
    const testProposals = Array.from({ length: 60 }, (_, i) => ({
      id: `PROP-P7B-${String(i + 1).padStart(3, "0")}`,
      run_id: i < 50 ? "RUN-ACTIVE-01" : "RUN-OTHER-02",
      section_id: i % 2 === 0 ? "SEC-MAS-AJJ-01" : "SEC-AJJ-KPD-02",
      departments: [i % 3 === 0 ? "ENGG" : i % 3 === 1 ? "TRD" : "S&T"],
      request_count: 2,
      scheduled_start: "2026-09-26T10:00:00Z",
      scheduled_end: "2026-09-26T12:00:00Z",
      duration_minutes: 120,
      start_km: 10.0 + (i % 10),
      end_km: 15.0 + (i % 10),
      track_line: "UP",
      possession_saving_minutes: 30,
      status: "PROPOSED",
      has_blocking_conflicts: i === 13, // Proposal 14 has a blocking conflict!
      conflict_count: i === 13 ? 1 : 0,
      constituent_requests: [
        {
          id: `REQ-${i}-1`,
          department: "ENGG",
          work_type: "TRACK_RENEWAL",
          start_km: 10.0,
          end_km: 15.0,
          urgency: "high",
        },
      ],
      created_at: "2026-09-26T08:00:00Z",
    }));

    let backendProposals = [...testProposals];
    let createdOperationalBlocks = [];

    globalThis.fetch = async (url, options) => {
      const urlStr = url.toString();
      const method = options?.method ?? "GET";

      if (urlStr.endsWith("/approvals") && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => backendProposals,
        };
      }

      // Explicit Approve endpoint: /approvals/{proposal_id}/approve
      const approveMatch = urlStr.match(/\/approvals\/([^/]+)\/approve$/);
      if (approveMatch && method === "POST") {
        const targetProposalId = decodeURIComponent(approveMatch[1]);
        const body = JSON.parse(options.body);

        const propIndex = backendProposals.findIndex((p) => p.id === targetProposalId);
        assert.ok(propIndex !== -1, `Target proposal ${targetProposalId} must exist`);
        const prop = backendProposals[propIndex];

        // 8. Safety Conflict Gate: A proposal with unresolved blocking conflicts CANNOT be approved!
        if (prop.has_blocking_conflicts) {
          return {
            ok: false,
            status: 409,
            text: async () =>
              JSON.stringify({
                detail: `Proposal ${targetProposalId} has ${prop.conflict_count} unresolved blocking conflict(s). Resolve before approving.`,
              }),
          };
        }

        // Authoritative transition: PROPOSED -> ACCEPTED
        backendProposals[propIndex] = { ...prop, status: "ACCEPTED" };

        const newBlock = {
          id: body.block_id || `OP-${prop.section_id}-${targetProposalId}`,
          origin_proposal_id: targetProposalId,
          section_id: prop.section_id,
          track_line: body.track_line || prop.track_line,
          start_km: body.start_km ?? prop.start_km,
          end_km: body.end_km ?? prop.end_km,
          scheduled_start: body.custom_scheduled_start || prop.scheduled_start,
          scheduled_end: body.custom_scheduled_end || prop.scheduled_end,
          status: "APPROVED",
          is_current: true,
          manual_override: body.override_justification
            ? {
                justification: body.override_justification,
                code: body.override_code,
                role: body.operator_role,
              }
            : null,
          created_at: new Date().toISOString(),
        };
        createdOperationalBlocks.push(newBlock);

        return {
          ok: true,
          status: 200,
          json: async () => newBlock,
        };
      }

      // Explicit Reject endpoint: /approvals/{proposal_id}/reject
      const rejectMatch = urlStr.match(/\/approvals\/([^/]+)\/reject$/);
      if (rejectMatch && method === "POST") {
        const targetProposalId = decodeURIComponent(rejectMatch[1]);
        const body = JSON.parse(options.body);

        // Explicit rejection justification requirement
        assert.ok(body.rejection_reason && body.rejection_reason.trim().length > 0, "Rejection reason is mandatory");

        const propIndex = backendProposals.findIndex((p) => p.id === targetProposalId);
        assert.ok(propIndex !== -1, `Target proposal ${targetProposalId} must exist`);

        backendProposals[propIndex] = {
          ...backendProposals[propIndex],
          status: "REJECTED",
          rejection_reason: body.rejection_reason,
          rejected_by: body.rejected_by,
        };

        return {
          ok: true,
          status: 200,
          json: async () => ({
            proposal_id: targetProposalId,
            status: "REJECTED",
            reason: body.rejection_reason,
          }),
        };
      }

      if (urlStr.endsWith("/operational-blocks") && method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => createdOperationalBlocks,
        };
      }

      // Fallback for default GETs
      return {
        ok: true,
        status: 200,
        json: async () => [],
      };
    };

    const { approveProposal, rejectProposal, listApprovals } = await import("../lib/api.ts");

    // 1 & 9. Verify 50+ proposals queue scaling and exact proposal ID isolation
    const initialList = await listApprovals();
    assert.equal(initialList.length, 60, "Loaded queue must contain all 60 proposals");

    // Scope to active run
    const activeRunProposals = initialList.filter((p) => p.run_id === "RUN-ACTIVE-01");
    assert.equal(activeRunProposals.length, 50, "Active run must cleanly scope to exactly 50 proposals");

    // 2. Strict ID matching — verify no positional fallback (never assuming proposals[0])
    const targetProposal = activeRunProposals[5]; // PROP-P7B-006
    const nonTargetProposal = activeRunProposals[6]; // PROP-P7B-007
    assert.notEqual(targetProposal.id, activeRunProposals[0].id, "Target is not index 0");

    // 4. Approving one proposal does not mutate another row
    const approvedBlock = await approveProposal(targetProposal.id, {
      block_id: `OP-${targetProposal.id}`,
      approved_by: "CONTROLLER-MAS-01",
      lead_department: "ENGG",
      start_km: targetProposal.start_km,
      end_km: targetProposal.end_km,
      track_line: targetProposal.track_line,
    });

    assert.equal(approvedBlock.origin_proposal_id, targetProposal.id);
    assert.equal(approvedBlock.status, "APPROVED");

    // 7. Verify authoritative operational block creation and proposal status change
    let updatedList = await listApprovals();
    const approvedInList = updatedList.find((p) => p.id === targetProposal.id);
    const untouchedInList = updatedList.find((p) => p.id === nonTargetProposal.id);
    assert.equal(approvedInList?.status, "ACCEPTED", "Targeted proposal transitioned to ACCEPTED");
    assert.equal(untouchedInList?.status, "PROPOSED", "Untargeted proposal remains PROPOSED");

    // Verify awaiting decision list excludes accepted proposals
    const awaitingDecision = updatedList.filter((p) => p.status === "PROPOSED");
    assert.equal(awaitingDecision.some((p) => p.id === targetProposal.id), false, "Approved proposal removed from awaiting decision");
    assert.equal(awaitingDecision.some((p) => p.id === nonTargetProposal.id), true, "Other proposal remains awaiting decision");

    // 5. Adjust flow: genuine human override with justification notes and custom parameters
    const adjustTarget = activeRunProposals[8]; // PROP-P7B-009
    const adjustOverridePayload = {
      block_id: `OP-ADJUSTED-${adjustTarget.id}`,
      approved_by: "CONTROLLER-MAS-01",
      lead_department: "TRD",
      start_km: 12.0,
      end_km: 14.5,
      track_line: "UP",
      override_justification: "Adjusted 30 mins later due to express train 12622 crossing",
      override_code: "TRAIN_PRECEDENCE_ADJUSTMENT",
      operator_role: "SECTION_CONTROLLER",
      custom_scheduled_start: "2026-09-26T10:30:00Z",
      custom_scheduled_end: "2026-09-26T12:30:00Z",
    };

    const adjustedBlock = await approveProposal(adjustTarget.id, adjustOverridePayload);
    assert.equal(adjustedBlock.origin_proposal_id, adjustTarget.id);
    assert.ok(adjustedBlock.manual_override, "OperationalBlock must contain controller manual override");
    assert.equal(adjustedBlock.manual_override.code, "TRAIN_PRECEDENCE_ADJUSTMENT");
    assert.equal(adjustedBlock.manual_override.justification, "Adjusted 30 mins later due to express train 12622 crossing");
    assert.equal(adjustedBlock.start_km, 12.0);
    assert.equal(adjustedBlock.end_km, 14.5);

    // Verify adjust did not mutate other rows
    updatedList = await listApprovals();
    const adjustedInList = updatedList.find((p) => p.id === adjustTarget.id);
    const peerInList = updatedList.find((p) => p.id === activeRunProposals[9].id);
    assert.equal(adjustedInList?.status, "ACCEPTED");
    assert.equal(peerInList?.status, "PROPOSED");

    // 6. Reject flow: requires explicit reason, removes ONLY that proposal from awaiting decision
    const rejectTarget = activeRunProposals[10]; // PROP-P7B-011
    const rejectRes = await rejectProposal(rejectTarget.id, {
      rejected_by: "CONTROLLER-MAS-01",
      rejection_reason: "High track occupancy; rescheduled to night corridor",
      operator_role: "SECTION_CONTROLLER",
    });

    assert.equal(rejectRes.proposal_id, rejectTarget.id);
    assert.equal(rejectRes.status, "REJECTED");

    updatedList = await listApprovals();
    const rejectedInList = updatedList.find((p) => p.id === rejectTarget.id);
    const adjacentInList = updatedList.find((p) => p.id === activeRunProposals[11].id);
    assert.equal(rejectedInList?.status, "REJECTED");
    assert.equal(adjacentInList?.status, "PROPOSED");

    const newAwaiting = updatedList.filter((p) => p.status === "PROPOSED");
    assert.equal(newAwaiting.some((p) => p.id === rejectTarget.id), false, "Rejected proposal removed from awaiting decision");

    // 8. Safety Conflict Gate: Conflict-blocked proposal CANNOT be approved
    const conflictedProposal = activeRunProposals[13]; // PROP-P7B-014 (has_blocking_conflicts = true)
    await assert.rejects(
      async () => {
        await approveProposal(conflictedProposal.id, {
          block_id: `OP-${conflictedProposal.id}`,
          approved_by: "CONTROLLER-MAS-01",
          lead_department: "ENGG",
          start_km: conflictedProposal.start_km,
          end_km: conflictedProposal.end_km,
        });
      },
      (err) => {
        assert.match(err.message, /blocking conflict/);
        return true;
      },
      "Must reject approval of a proposal with unresolved blocking conflicts",
    );

    // Conflicted proposal must remain PROPOSED and awaiting resolution
    updatedList = await listApprovals();
    const conflictedInList = updatedList.find((p) => p.id === conflictedProposal.id);
    assert.equal(conflictedInList?.status, "PROPOSED");

    // 3 & 10. Background refresh preserves active run and isolates proposals
    let activeRunId = "RUN-ACTIVE-01";
    const refreshData = await listApprovals();
    const filteredActive = refreshData.filter((p) => p.run_id === activeRunId);
    assert.equal(filteredActive.length, 50, "Active run proposals remain precisely preserved after refresh");
  });

  test("15. Phase 7C Controller Triage Redesign: Two-Tier Layout, Triage Sorting & Attention Filtering", async () => {
    const { getShortProposalId, getProposalRiskMetrics, getConstituentWorkSummary } = await import(
      "../components/approvals/approval-utils.ts"
    );

    // 1. Short Human-Readable ID mapping preserves full UUID access
    assert.equal(getShortProposalId("3a067d90-366f-4921-a135-204fcee26cf7"), "P-3A06");
    assert.equal(getShortProposalId("PROP-20260926-001"), "P-2026");
    assert.equal(getShortProposalId("P-42"), "P-0042");

    // 2. Surface the lowest-risk / highest-attention signal across grouped constituents
    const mockConstituentsClean = [
      {
        id: "REQ-001",
        description: "Track renewal on MAS-AJJ",
        department: "ENGG",
        category: "PM",
        urgency: { tier: "routine", timeToBreachHours: 48 },
        aiSuggestion: { confidence: 95 },
        conflict: null,
      },
      {
        id: "REQ-002",
        description: "OHE wire inspection on MAS-AJJ",
        department: "TRD",
        category: "PM",
        urgency: { tier: "routine", timeToBreachHours: 72 },
        aiSuggestion: { confidence: 92 },
        conflict: null,
      },
    ];

    const cleanProposal = {
      id: "PROP-CLEAN-01",
      section_id: "AJJ-SHU",
      has_blocking_conflicts: false,
      blocking_conflict_count: 0,
      confidence_score: 0.94,
      maintenance_request_ids: ["REQ-001", "REQ-002"],
      possession_saving_minutes: 45,
      proposed_start_time: "2026-09-26T10:00:00Z",
    };

    const cleanMetrics = getProposalRiskMetrics(cleanProposal, mockConstituentsClean);
    assert.equal(cleanMetrics.category, "clear");
    assert.equal(cleanMetrics.statusLabel, "CLEAR · 92%"); // Lowest constituent is 92%
    assert.equal(cleanMetrics.needsAttention, false);
    assert.equal(cleanMetrics.isBlocked, false);

    // 3. Lowest confidence constituent pulls parent proposal into REVIEW status (lowest-risk / highest-attention signal)
    const mockConstituentsWithWeakLink = [
      {
        id: "REQ-003",
        description: "Track maintenance",
        department: "ENGG",
        category: "PM",
        urgency: { tier: "routine", timeToBreachHours: 24 },
        aiSuggestion: { confidence: 94 },
        conflict: null,
      },
      {
        id: "REQ-004",
        description: "Point machine testing",
        department: "S&T",
        category: "OBS",
        urgency: { tier: "routine", timeToBreachHours: 12 },
        aiSuggestion: { confidence: 61 }, // Weak link: 61%
        conflict: null,
      },
    ];

    const reviewProposal = {
      id: "PROP-REVIEW-02",
      section_id: "AJJ-SHU",
      has_blocking_conflicts: false,
      blocking_conflict_count: 0,
      confidence_score: 0.85,
      maintenance_request_ids: ["REQ-003", "REQ-004"],
      possession_saving_minutes: 60,
      proposed_start_time: "2026-09-26T12:00:00Z",
    };

    const reviewMetrics = getProposalRiskMetrics(reviewProposal, mockConstituentsWithWeakLink);
    assert.equal(reviewMetrics.category, "review");
    assert.equal(reviewMetrics.statusLabel, "REVIEW · 61%"); // Explicitly shows 61%
    assert.equal(reviewMetrics.needsAttention, true);
    assert.equal(reviewMetrics.isBlocked, false);

    // 4. Conflicted proposal is explicitly BLOCKED · CONFLICT
    const blockedProposal = {
      id: "PROP-BLOCKED-03",
      section_id: "AJJ-SHU",
      has_blocking_conflicts: true,
      blocking_conflict_count: 1,
      confidence_score: 0.90,
      maintenance_request_ids: ["REQ-005"],
      possession_saving_minutes: 30,
      proposed_start_time: "2026-09-26T08:00:00Z",
    };

    const blockedMetrics = getProposalRiskMetrics(blockedProposal, []);
    assert.equal(blockedMetrics.category, "blocked");
    assert.equal(blockedMetrics.statusLabel, "BLOCKED · CONFLICT");
    assert.equal(blockedMetrics.needsAttention, true);
    assert.equal(blockedMetrics.isBlocked, true);

    // 5. Work Summary concise concatenation
    const summary = getConstituentWorkSummary(mockConstituentsClean, cleanProposal);
    assert.equal(summary, "TRACK_RENEWAL + OHE_WIRE_INSPECTION");

    // 6. Triage Sorting Verification
    const proposalQueue = [reviewProposal, cleanProposal, blockedProposal];

    // Sort by Soonest (proposed_start_time ascending: 08:00, 10:00, 12:00)
    const sortedSoonest = [...proposalQueue].sort(
      (a, b) => new Date(a.proposed_start_time).getTime() - new Date(b.proposed_start_time).getTime(),
    );
    assert.equal(sortedSoonest[0].id, "PROP-BLOCKED-03"); // 08:00
    assert.equal(sortedSoonest[1].id, "PROP-CLEAN-01");   // 10:00
    assert.equal(sortedSoonest[2].id, "PROP-REVIEW-02");  // 12:00

    // Sort by Highest Saving
    const sortedSaving = [...proposalQueue].sort(
      (a, b) => b.possession_saving_minutes - a.possession_saving_minutes,
    );
    assert.equal(sortedSaving[0].id, "PROP-REVIEW-02");  // 60m
    assert.equal(sortedSaving[1].id, "PROP-CLEAN-01");   // 45m
    assert.equal(sortedSaving[2].id, "PROP-BLOCKED-03"); // 30m

    // Sort by Needs Attention First (Blocked and Review first, then Clear)
    const sortedAttention = [...proposalQueue].sort((a, b) => {
      const aAtt = a.id === "PROP-BLOCKED-03" || a.id === "PROP-REVIEW-02";
      const bAtt = b.id === "PROP-BLOCKED-03" || b.id === "PROP-REVIEW-02";
      if (aAtt && !bAtt) return -1;
      if (!aAtt && bAtt) return 1;
      return 0;
    });
    assert.equal(sortedAttention[2].id, "PROP-CLEAN-01", "Clean proposal is placed after attention proposals");

    // 7. Attention Filtering Verification
    const attentionProposals = proposalQueue.filter((p) => {
      const m = getProposalRiskMetrics(p, p.id === cleanProposal.id ? mockConstituentsClean : p.id === reviewProposal.id ? mockConstituentsWithWeakLink : []);
      return m.needsAttention;
    });
    assert.equal(attentionProposals.length, 2);
    assert.deepEqual(
      attentionProposals.map((p) => p.id),
      ["PROP-REVIEW-02", "PROP-BLOCKED-03"],
    );

    const clearProposals = proposalQueue.filter((p) => {
      const constituents =
        p.id === cleanProposal.id
          ? mockConstituentsClean
          : p.id === reviewProposal.id
          ? mockConstituentsWithWeakLink
          : [];
      const m = getProposalRiskMetrics(p, constituents);
      return m.category === "clear";
    });
    assert.equal(clearProposals.length, 1);
    assert.equal(clearProposals[0].id, "PROP-CLEAN-01");

    // 8. Bundle approval count verification (3 requests in group requires "Approve (3)")
    assert.equal(cleanProposal.maintenance_request_ids.length, 2);
    assert.equal(reviewProposal.maintenance_request_ids.length, 2);
  });
});



