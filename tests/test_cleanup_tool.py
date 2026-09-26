"""Unit tests for Phase 7B Safe Database Pruning and Cleanup Tool."""

from __future__ import annotations

import os
import sqlite3
import tempfile
import unittest

from backend.scripts.prune_planning_history import analyze_database, execute_prune


class TestCleanupTool(unittest.TestCase):
    def setUp(self):
        self.temp_db_fd, self.temp_db_path = tempfile.mkstemp(suffix=".db")
        self.con = sqlite3.connect(self.temp_db_path)
        cur = self.con.cursor()

        # Create minimal required schema matching railnexus.db
        cur.executescript('''
            CREATE TABLE operational_blocks (
                id VARCHAR(36) PRIMARY KEY,
                origin_proposal_id VARCHAR(36),
                status VARCHAR(20) NOT NULL
            );
            CREATE TABLE block_departments (
                block_id VARCHAR(36),
                department VARCHAR(20)
            );
            CREATE TABLE audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_name VARCHAR(50),
                entity_id VARCHAR(50),
                action VARCHAR(50)
            );
            CREATE TABLE conflicts (
                id VARCHAR(36) PRIMARY KEY,
                status VARCHAR(20)
            );
            CREATE TABLE conflict_resolution_events (
                id VARCHAR(36) PRIMARY KEY,
                conflict_id VARCHAR(36)
            );
            CREATE TABLE optimization_runs (
                id VARCHAR(36) PRIMARY KEY,
                input_requests_hash VARCHAR(64),
                created_at DATETIME
            );
            CREATE TABLE block_proposals (
                id VARCHAR(36) PRIMARY KEY,
                run_id VARCHAR(36),
                status VARCHAR(20)
            );
            CREATE TABLE proposal_items (
                proposal_id VARCHAR(36),
                maintenance_request_id VARCHAR(36)
            );
            CREATE TABLE proposal_departments (
                proposal_id VARCHAR(36),
                department VARCHAR(20)
            );
            CREATE TABLE maintenance_requests (
                id VARCHAR(36) PRIMARY KEY,
                status VARCHAR(20)
            );
            CREATE TABLE predictions (
                id VARCHAR(36) PRIMARY KEY,
                maintenance_request_id VARCHAR(36)
            );
            CREATE TABLE optimized_blocks (
                id VARCHAR(36) PRIMARY KEY
            );
            CREATE TABLE demo_integration_requests (
                request_id VARCHAR(36) PRIMARY KEY
            );
        ''')

        # Seed test data:
        # Run 1: Canonical run with 1 ACCEPTED proposal -> OperationalBlock OP-1
        cur.execute("INSERT INTO optimization_runs VALUES ('RUN-1', 'HASH-1', '2026-09-20 10:00:00')")
        cur.execute("INSERT INTO block_proposals VALUES ('PROP-ACCEPTED-1', 'RUN-1', 'ACCEPTED')")
        cur.execute("INSERT INTO proposal_items VALUES ('PROP-ACCEPTED-1', 'REQ-1')")
        cur.execute("INSERT INTO proposal_departments VALUES ('PROP-ACCEPTED-1', 'ENGG')")
        cur.execute("INSERT INTO operational_blocks VALUES ('OP-1', 'PROP-ACCEPTED-1', 'APPROVED')")
        cur.execute("INSERT INTO block_departments VALUES ('OP-1', 'ENGG')")
        cur.execute("INSERT INTO audit_logs VALUES (1, 'BlockProposal', 'PROP-ACCEPTED-1', 'PROPOSAL_APPROVED')")

        # Run 2: Canonical run with 1 REJECTED proposal
        cur.execute("INSERT INTO optimization_runs VALUES ('RUN-2', 'HASH-2', '2026-09-21 10:00:00')")
        cur.execute("INSERT INTO block_proposals VALUES ('PROP-REJECTED-1', 'RUN-2', 'REJECTED')")
        cur.execute("INSERT INTO proposal_items VALUES ('PROP-REJECTED-1', 'REQ-2')")
        cur.execute("INSERT INTO proposal_departments VALUES ('PROP-REJECTED-1', 'TRD')")
        cur.execute("INSERT INTO audit_logs VALUES (2, 'BlockProposal', 'PROP-REJECTED-1', 'PROPOSAL_REJECTED')")

        # Run 3: Empty run (0 proposals)
        cur.execute("INSERT INTO optimization_runs VALUES ('RUN-EMPTY', 'HASH-EMPTY', '2026-09-22 10:00:00')")

        # Run 4: Superseded run with 1 unreviewed PROPOSED proposal
        cur.execute("INSERT INTO optimization_runs VALUES ('RUN-SUPERSEDED', 'HASH-SUP', '2026-09-23 10:00:00')")
        cur.execute("INSERT INTO block_proposals VALUES ('PROP-UNREVIEWED', 'RUN-SUPERSEDED', 'PROPOSED')")
        cur.execute("INSERT INTO proposal_items VALUES ('PROP-UNREVIEWED', 'REQ-3')")
        cur.execute("INSERT INTO proposal_departments VALUES ('PROP-UNREVIEWED', 'S&T')")

        # Run 5: Latest active run with 1 PROPOSED proposal
        cur.execute("INSERT INTO optimization_runs VALUES ('RUN-ACTIVE', 'HASH-ACTIVE', '2026-09-26 10:00:00')")
        cur.execute("INSERT INTO block_proposals VALUES ('PROP-ACTIVE', 'RUN-ACTIVE', 'PROPOSED')")
        cur.execute("INSERT INTO proposal_items VALUES ('PROP-ACTIVE', 'REQ-4')")
        cur.execute("INSERT INTO proposal_departments VALUES ('PROP-ACTIVE', 'ENGG')")

        # Maintenance requests & predictions
        for i in range(1, 5):
            cur.execute(f"INSERT INTO maintenance_requests VALUES ('REQ-{i}', 'pending')")
            cur.execute(f"INSERT INTO predictions VALUES ('PRED-{i}', 'REQ-{i}')")

        # Legacy cache row
        cur.execute("INSERT INTO optimized_blocks VALUES ('CACHE-1')")

        self.con.commit()

    def tearDown(self):
        self.con.close()
        os.close(self.temp_db_fd)
        if os.path.exists(self.temp_db_path):
            os.remove(self.temp_db_path)

    def test_dry_run_analyzes_without_deleting(self):
        plan = analyze_database(self.temp_db_path, active_run_id="RUN-ACTIVE")
        self.assertTrue(plan.dry_run)
        self.assertEqual(plan.active_run_id, "RUN-ACTIVE")

        # Should protect RUN-1 (accepted), RUN-2 (rejected), RUN-ACTIVE (active)
        self.assertIn("RUN-1", plan.protected_run_ids)
        self.assertIn("RUN-2", plan.protected_run_ids)
        self.assertIn("RUN-ACTIVE", plan.protected_run_ids)

        # Should propose pruning RUN-EMPTY and RUN-SUPERSEDED
        self.assertIn("RUN-EMPTY", plan.delete_runs)
        self.assertIn("RUN-SUPERSEDED", plan.delete_runs)
        self.assertIn("PROP-UNREVIEWED", plan.delete_proposals)
        self.assertIn("CACHE-1", plan.delete_cache_rows)

        # Never touch operational blocks, audit logs, or maintenance requests
        self.assertEqual(plan.delete_counts["operational_blocks"], 0)
        self.assertEqual(plan.delete_counts["audit_logs"], 0)
        self.assertEqual(plan.delete_counts["maintenance_requests"], 0)

        # Verify nothing was deleted in DB
        cur = self.con.cursor()
        cur.execute("SELECT COUNT(*) FROM optimization_runs")
        self.assertEqual(cur.fetchone()[0], 5)

    def test_execute_prunes_only_unprotected_records(self):
        plan = analyze_database(self.temp_db_path, active_run_id="RUN-ACTIVE")
        plan.dry_run = False
        deleted = execute_prune(self.temp_db_path, plan)

        cur = self.con.cursor()

        # OperationalBlock OP-1 must remain untouched
        cur.execute("SELECT id FROM operational_blocks")
        self.assertEqual([r[0] for r in cur.fetchall()], ["OP-1"])

        # Audit logs must remain untouched
        cur.execute("SELECT COUNT(*) FROM audit_logs")
        self.assertEqual(cur.fetchone()[0], 2)

        # Maintenance requests and predictions must remain untouched
        cur.execute("SELECT COUNT(*) FROM maintenance_requests")
        self.assertEqual(cur.fetchone()[0], 4)
        cur.execute("SELECT COUNT(*) FROM predictions")
        self.assertEqual(cur.fetchone()[0], 4)

        # Protected proposals remain
        cur.execute("SELECT id FROM block_proposals ORDER BY id")
        props = [r[0] for r in cur.fetchall()]
        self.assertEqual(props, ["PROP-ACCEPTED-1", "PROP-ACTIVE", "PROP-REJECTED-1"])

        # Protected runs remain
        cur.execute("SELECT id FROM optimization_runs ORDER BY id")
        runs = [r[0] for r in cur.fetchall()]
        self.assertEqual(runs, ["RUN-1", "RUN-2", "RUN-ACTIVE"])

        # Cache deleted
        cur.execute("SELECT COUNT(*) FROM optimized_blocks")
        self.assertEqual(cur.fetchone()[0], 0)


if __name__ == "__main__":
    unittest.main()
