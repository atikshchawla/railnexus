"""Phase 7B Safe Database Pruning and Planning History Maintenance Utility.

This utility audits and safely prunes superseded, duplicate, and unreferenced
planning data while strictly protecting:
  1. Authoritative OperationalBlocks and BlockDepartments.
  2. Complete AuditLogs and Conflict resolution events.
  3. All BlockProposals in ACCEPTED, REJECTED, or OVERRIDDEN status.
  4. OptimizationRuns containing protected proposals.
  5. The currently active/latest OptimizationRun.
  6. All MaintenanceRequests and Predictions (backlog integrity).

DEFAULT MODE IS DRY RUN (--dry-run). Deletion requires explicit --execute.
"""

from __future__ import annotations

import argparse
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import sqlite3
import sys
from typing import Any


@dataclass
class PrunePlan:
    dry_run: bool = True
    active_run_id: str | None = None
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    # Retained counts
    retained_counts: dict[str, int] = field(default_factory=dict)
    # Deletion counts by table
    delete_counts: dict[str, int] = field(default_factory=dict)

    # Detailed lists of IDs to delete
    delete_runs: list[str] = field(default_factory=list)
    delete_proposals: list[str] = field(default_factory=list)
    delete_proposal_items: int = 0
    delete_proposal_depts: int = 0
    delete_cache_rows: list[str] = field(default_factory=list)

    # Protected entity summaries
    protected_run_ids: list[str] = field(default_factory=list)
    protected_proposal_ids: list[str] = field(default_factory=list)
    protected_operational_block_ids: list[str] = field(default_factory=list)
    protected_audit_log_count: int = 0

    # Categorized reasons
    reasons: dict[str, str] = field(default_factory=dict)

    # Before / After counts
    before_counts: dict[str, int] = field(default_factory=dict)
    after_counts: dict[str, int] = field(default_factory=dict)


def analyze_database(
    db_path: str = "railnexus.db",
    active_run_id: str | None = None,
    prune_cache: bool = True,
    prune_superseded: bool = True,
    prune_empty_runs: bool = True,
) -> PrunePlan:
    """Perform read-only dependency analysis and generate a safe PrunePlan."""
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    plan = PrunePlan(dry_run=True, active_run_id=active_run_id)

    # 1. Count existing rows across all tables
    tables = [
        "operational_blocks",
        "block_departments",
        "audit_logs",
        "conflicts",
        "conflict_resolution_events",
        "block_proposals",
        "proposal_items",
        "proposal_departments",
        "optimization_runs",
        "maintenance_requests",
        "predictions",
        "optimized_blocks",
        "demo_integration_requests",
    ]
    for tbl in tables:
        cur.execute(f"SELECT COUNT(*) FROM {tbl}")
        plan.before_counts[tbl] = cur.fetchone()[0]

    # 2. Identify strictly protected OperationalBlocks
    cur.execute("SELECT id, origin_proposal_id FROM operational_blocks")
    op_blocks = cur.fetchall()
    plan.protected_operational_block_ids = [r["id"] for r in op_blocks]
    accepted_prop_ids = set(r["origin_proposal_id"] for r in op_blocks if r["origin_proposal_id"])

    # 3. Identify strictly protected AuditLogs
    cur.execute("SELECT COUNT(*) FROM audit_logs")
    plan.protected_audit_log_count = cur.fetchone()[0]

    # 4. Identify all proposals that must be protected:
    #    - Proposals referenced by OperationalBlocks
    #    - Proposals in ACCEPTED or REJECTED or OVERRIDDEN status
    cur.execute(
        "SELECT id, run_id, status FROM block_proposals WHERE status IN ('ACCEPTED', 'REJECTED', 'OVERRIDDEN')"
    )
    protected_props_rows = cur.fetchall()
    protected_prop_ids = set(r["id"] for r in protected_props_rows) | accepted_prop_ids
    plan.protected_proposal_ids = sorted(list(protected_prop_ids))

    # Optimization runs that spawned protected proposals MUST be protected
    runs_with_protected_props = set(r["run_id"] for r in protected_props_rows if r["run_id"])

    # Identify the latest run (or user-specified active run)
    cur.execute("SELECT id, created_at FROM optimization_runs ORDER BY created_at DESC LIMIT 1")
    latest_run_row = cur.fetchone()
    latest_run_id = latest_run_row["id"] if latest_run_row else None

    effective_active_run_id = active_run_id or latest_run_id
    plan.active_run_id = effective_active_run_id

    # 5. Identify protected runs
    protected_run_ids = set(runs_with_protected_props)
    if effective_active_run_id:
        protected_run_ids.add(effective_active_run_id)
    plan.protected_run_ids = sorted(list(protected_run_ids))

    # 6. Categorize Optimization Runs
    cur.execute('''
        SELECT r.id, r.input_requests_hash, r.created_at,
               COUNT(p.id) as prop_count,
               SUM(CASE WHEN p.status IN ('ACCEPTED', 'REJECTED', 'OVERRIDDEN') THEN 1 ELSE 0 END) as decisive_count
        FROM optimization_runs r
        LEFT JOIN block_proposals p ON p.run_id = r.id
        GROUP BY r.id
        ORDER BY r.created_at ASC
    ''')
    all_runs = cur.fetchall()

    candidate_runs_to_delete = set()
    candidate_props_to_delete = set()

    for r in all_runs:
        run_id = r["id"]
        prop_count = r["prop_count"]
        decisive_count = r["decisive_count"]

        # Never delete protected runs
        if run_id in protected_run_ids:
            continue

        # Case 1: Empty runs with 0 proposals
        if prop_count == 0 and prune_empty_runs:
            candidate_runs_to_delete.add(run_id)
            plan.reasons[f"run:{run_id}"] = "Empty optimization run (0 proposals produced)"
            continue

        # Case 2: Superseded runs containing ONLY unreviewed PROPOSED proposals
        if decisive_count == 0 and prune_superseded:
            candidate_runs_to_delete.add(run_id)
            plan.reasons[f"run:{run_id}"] = (
                f"Superseded planning cycle ({prop_count} unreviewed PROPOSED proposals, none accepted/rejected)"
            )
            # Find proposals for this run
            cur.execute("SELECT id FROM block_proposals WHERE run_id = ?", (run_id,))
            for p in cur.fetchall():
                if p["id"] not in protected_prop_ids:
                    candidate_props_to_delete.add(p["id"])
                    plan.reasons[f"proposal:{p['id']}"] = f"Unreviewed proposal in superseded run {run_id[:8]}"

    plan.delete_runs = sorted(list(candidate_runs_to_delete))
    plan.delete_proposals = sorted(list(candidate_props_to_delete))

    # Count cascading proposal items and departments
    if candidate_props_to_delete:
        q_marks = ",".join("?" for _ in candidate_props_to_delete)
        cur.execute(
            f"SELECT COUNT(*) FROM proposal_items WHERE proposal_id IN ({q_marks})",
            list(candidate_props_to_delete),
        )
        plan.delete_proposal_items = cur.fetchone()[0]

        cur.execute(
            f"SELECT COUNT(*) FROM proposal_departments WHERE proposal_id IN ({q_marks})",
            list(candidate_props_to_delete),
        )
        plan.delete_proposal_depts = cur.fetchone()[0]

    # Legacy cache table: optimized_blocks
    if prune_cache:
        cur.execute("SELECT id FROM optimized_blocks")
        plan.delete_cache_rows = [r["id"] for r in cur.fetchall()]
        plan.reasons["table:optimized_blocks"] = (
            "Legacy solver execution cache (Phase 3/4 non-authoritative JSON cache)"
        )

    # Compute planned delete counts
    plan.delete_counts = {
        "optimization_runs": len(plan.delete_runs),
        "block_proposals": len(plan.delete_proposals),
        "proposal_items": plan.delete_proposal_items,
        "proposal_departments": plan.delete_proposal_depts,
        "optimized_blocks": len(plan.delete_cache_rows),
        "operational_blocks": 0,
        "block_departments": 0,
        "audit_logs": 0,
        "maintenance_requests": 0,
        "predictions": 0,
        "conflicts": 0,
        "conflict_resolution_events": 0,
    }

    # Compute planned after counts
    for tbl, before in plan.before_counts.items():
        deleted = plan.delete_counts.get(tbl, 0)
        plan.after_counts[tbl] = max(0, before - deleted)
        plan.retained_counts[tbl] = plan.after_counts[tbl]

    con.close()
    return plan


def execute_prune(db_path: str, plan: PrunePlan) -> dict[str, int]:
    """Execute the plan transactionally with strict invariant verification."""
    con = sqlite3.connect(db_path)
    cur = con.cursor()

    try:
        cur.execute("PRAGMA foreign_keys = ON")
        cur.execute("BEGIN TRANSACTION")

        deleted_actual = defaultdict(int)

        # 1. Delete proposal items for candidate proposals
        if plan.delete_proposals:
            q_marks = ",".join("?" for _ in plan.delete_proposals)
            cur.execute(
                f"DELETE FROM proposal_items WHERE proposal_id IN ({q_marks})",
                plan.delete_proposals,
            )
            deleted_actual["proposal_items"] = cur.rowcount

            cur.execute(
                f"DELETE FROM proposal_departments WHERE proposal_id IN ({q_marks})",
                plan.delete_proposals,
            )
            deleted_actual["proposal_departments"] = cur.rowcount

            cur.execute(
                f"DELETE FROM block_proposals WHERE id IN ({q_marks})",
                plan.delete_proposals,
            )
            deleted_actual["block_proposals"] = cur.rowcount

        # 2. Delete runs
        if plan.delete_runs:
            q_marks = ",".join("?" for _ in plan.delete_runs)
            cur.execute(
                f"DELETE FROM optimization_runs WHERE id IN ({q_marks})",
                plan.delete_runs,
            )
            deleted_actual["optimization_runs"] = cur.rowcount

        # 3. Delete cache if planned
        if plan.delete_cache_rows:
            cur.execute("DELETE FROM optimized_blocks")
            deleted_actual["optimized_blocks"] = cur.rowcount

        # Verification: Assert safety invariants
        cur.execute("SELECT COUNT(*) FROM operational_blocks")
        op_count = cur.fetchone()[0]
        if op_count != plan.before_counts["operational_blocks"]:
            raise RuntimeError(
                f"Safety violation: operational_blocks changed from {plan.before_counts['operational_blocks']} to {op_count}!"
            )

        cur.execute("SELECT COUNT(*) FROM audit_logs")
        audit_count = cur.fetchone()[0]
        if audit_count != plan.before_counts["audit_logs"]:
            raise RuntimeError("Safety violation: audit_logs were modified!")

        cur.execute("SELECT COUNT(*) FROM maintenance_requests")
        req_count = cur.fetchone()[0]
        if req_count != plan.before_counts["maintenance_requests"]:
            raise RuntimeError("Safety violation: maintenance_requests were modified!")

        con.commit()
        return dict(deleted_actual)
    except Exception as e:
        con.rollback()
        raise e
    finally:
        con.close()


def print_prune_report(plan: PrunePlan):
    """Format and print the clean report."""
    mode_label = "DRY RUN (READ-ONLY AUDIT — NO DELETION)" if plan.dry_run else "EXECUTED"
    print("=" * 70)
    print(f"RailNexus Safe Database Pruning Report [{mode_label}]")
    print(f"Timestamp: {plan.timestamp}")
    print(f"Active Run Protected: {plan.active_run_id}")
    print("=" * 70)

    print("\n1. PROTECTED ARTIFACTS (NEVER DELETED):")
    print(f"  Operational Blocks (Authoritative Possessions): {len(plan.protected_operational_block_ids)} retained (100%)")
    print(f"  Audit Logs (Regulatory Audit Trail):           {plan.protected_audit_log_count} retained (100%)")
    print(f"  Accepted/Rejected Proposals:                  {len(plan.protected_proposal_ids)} retained")
    print(f"  Active & Canonical Optimization Runs:         {len(plan.protected_run_ids)} retained")
    print(f"  Maintenance Requests & Predictions:           {plan.before_counts.get('maintenance_requests', 0)} retained (100%)")

    print("\n2. PROPOSED CLEANUP CANDIDATES:")
    print(f"  Empty Optimization Runs (0 proposals):        {sum(1 for r, reason in plan.reasons.items() if 'Empty' in reason)}")
    print(f"  Superseded Runs (unreviewed proposals only):  {sum(1 for r, reason in plan.reasons.items() if 'Superseded' in reason)}")
    print(f"  Total Optimization Runs to Prune:             {len(plan.delete_runs)}")
    print(f"  Total Superseded Proposals to Prune:          {len(plan.delete_proposals)}")
    print(f"  Cascaded Proposal Items:                      {plan.delete_proposal_items}")
    print(f"  Cascaded Proposal Departments:                {plan.delete_proposal_depts}")
    print(f"  Legacy Solver JSON Cache Rows:                {len(plan.delete_cache_rows)}")

    print("\n3. BEFORE / AFTER ROW COUNTS:")
    header = f"  {'Table':<30} | {'Before':<8} | {'Delete':<8} | {'After':<8}"
    print(header)
    print("  " + "-" * (len(header) - 2))
    for tbl in plan.before_counts:
        before = plan.before_counts[tbl]
        to_delete = plan.delete_counts.get(tbl, 0)
        after = plan.after_counts.get(tbl, before)
        print(f"  {tbl:<30} | {before:<8} | {to_delete:<8} | {after:<8}")

    print("\n4. CLEANUP JUSTIFICATIONS:")
    if plan.reasons.get("table:optimized_blocks"):
        print(f"  • optimized_blocks: {plan.reasons['table:optimized_blocks']}")
    print("  • optimization_runs: Pruning zero-result runs and historical unreviewed runs where proposals were never accepted or rejected.")
    print("  • block_proposals: Pruning only unreviewed PROPOSED records belonging to superseded planning cycles.")
    print("  • Zero modifications made to operational possessions, audit logs, or maintenance requests.")

    print("\n" + "=" * 70)
    if plan.dry_run:
        print("RESULT: DRY RUN COMPLETED SUCCESSFULLY. ZERO RECORDS DELETED.")
    else:
        print("RESULT: PRUNE TRANSACTION COMMITTED SUCCESSFULLY.")
    print("=" * 70 + "\n")


def main():
    parser = argparse.ArgumentParser(description="RailNexus Safe Database Pruning Utility")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Perform analysis without deleting (default)")
    parser.add_argument("--execute", action="store_true", default=False, help="Explicitly execute database deletions")
    parser.add_argument("--db", type=str, default="railnexus.db", help="Path to SQLite database")
    parser.add_argument("--active-run-id", type=str, default=None, help="Explicit active run ID to protect")
    parser.add_argument("--no-cache", action="store_true", default=False, help="Do not prune legacy optimized_blocks cache")
    parser.add_argument("--json", action="store_true", default=False, help="Output JSON format")

    args = parser.parse_args()

    # Determine execution mode: --execute overrides default dry-run
    is_dry_run = not args.execute

    plan = analyze_database(
        db_path=args.db,
        active_run_id=args.active_run_id,
        prune_cache=not args.no_cache,
    )
    plan.dry_run = is_dry_run

    if not is_dry_run:
        execute_prune(args.db, plan)

    if args.json:
        out = {
            "dry_run": plan.dry_run,
            "active_run_id": plan.active_run_id,
            "delete_counts": plan.delete_counts,
            "before_counts": plan.before_counts,
            "after_counts": plan.after_counts,
            "protected_operational_blocks": len(plan.protected_operational_block_ids),
            "protected_proposals": len(plan.protected_proposal_ids),
            "protected_runs": len(plan.protected_run_ids),
            "protected_audit_logs": plan.protected_audit_log_count,
        }
        print(json.dumps(out, indent=2))
    else:
        print_prune_report(plan)


if __name__ == "__main__":
    main()
