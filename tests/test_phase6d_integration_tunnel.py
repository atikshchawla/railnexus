"""Phase 6D — Demo / Integration-Tunnel Alignment Test Suite.

Verifies the three-system boundary between:
1. Demo / Simulation System
2. Integration / Gateway Layer
3. Core RailNexus ABP

Covers:
- Test A: Maintenance ingestion creates unapproved Core MaintenanceRequest.
- Test B: No synthetic approval (status is queued, not approved; resulting_state is clear).
- Test C: External provenance preservation (source_system, external_id in request_data).
- Test D: Idempotency (replay returns stored decision without duplicating Core rows).
- Test E: Boundary isolation (no BlockProposal, OperationalBlock, or approval mutation).
- Test F: Invalid section rejection (outside AJJ-JTJ corridor yields ValueError / HTTP 422).
- Test G: Truthful telemetry behavior (section_entry / running_status do not forge movements).
- Test H: Demo frontend boundary (OptimizerForm does not call Core /api/maintenance).
- Test I: Transactional atomicity (forced failure after staging leaves zero partial records).
- Test J: Department mapping and COA rejection (TMS, SMMS, TDMS valid; COA rejected).
- Test K: Route-level execution (/api/demo-gateway endpoints).
"""

from __future__ import annotations

import os
from pathlib import Path
import unittest
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session, sessionmaker

from backend.api.routes.demo_gateway import get_demo_request, ingest_demo_request, list_demo_requests
from backend.api.schemas.demo import DemoDecision, DemoRequest
from backend.database.connection import Base
from backend.database.models import (
    BlockProposal,
    DemoIntegrationRequest,
    MaintenanceRequest,
    OperationalBlock,
    OptimizationRun,
    Prediction,
    Section,
    Station,
    TrainMovement,
)
from backend.domain.enums import Department, SourceSystem
from backend.services.demo_gateway_service import DemoGatewayService, map_source_and_department
from backend.services.maintenance_service import MaintenanceService
from backend.services.prediction_service import PredictionService


def _make_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def _set_fk(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


class TestPhase6DIntegrationTunnel(unittest.TestCase):
    def setUp(self):
        self.engine = _make_engine()
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.db: Session = self.SessionLocal()

        # Seed minimal topology required for AJJ-SHU
        self.station_ajj = Station(code="AJJ", name="Arakkonam Jn", division="MAS", zone="SR", km_location=68.5)
        self.station_shu = Station(code="SHU", name="Sholinghur", division="MAS", zone="SR", km_location=89.8)
        self.section = Section(
            id="AJJ-SHU",
            division="MAS",
            start_station_code="AJJ",
            end_station_code="SHU",
            start_km=68.5,
            end_km=89.8,
            distance_km=21.3,
            track_count=2,
            mps_kmh=130.0,
        )
        self.db.add_all([self.station_ajj, self.station_shu, self.section])
        self.db.commit()

        self.maintenance_service = MaintenanceService()
        self.prediction_service = PredictionService()
        self.service = DemoGatewayService(
            maintenance_service=self.maintenance_service,
            prediction_service=self.prediction_service,
        )

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def _sample_maintenance_request(self, department: str = "TMS", section_id: str = "AJJ-SHU") -> DemoRequest:
        return DemoRequest(
            request_id=uuid4(),
            department=department,
            type="maintenance_block",
            train_id=None,
            section_id=section_id,
            description="Track Renewal near AJJ km 10",
            raised_at=datetime(2026, 9, 26, 10, 0, 0, tzinfo=timezone.utc),
        )

    # ── Test A: Maintenance Ingestion Creates Core Request ──────────────────
    def test_a_maintenance_ingestion_creates_core_request(self):
        req = self._sample_maintenance_request(department="TMS")
        decision = self.service.ingest(self.db, req)

        # 1. Assert integration record is persisted
        ledger = self.db.get(DemoIntegrationRequest, str(req.request_id))
        self.assertIsNotNone(ledger)
        self.assertEqual(ledger.status, "queued")
        self.assertEqual(ledger.resulting_state, "clear")
        self.assertIsNotNone(ledger.maintenance_request_id)

        # 2. Assert Core MaintenanceRequest is created
        core_mr = self.db.get(MaintenanceRequest, ledger.maintenance_request_id)
        self.assertIsNotNone(core_mr)
        self.assertEqual(core_mr.section_id, "AJJ-SHU")
        self.assertEqual(core_mr.work_type, "DEMO_MAINTENANCE_BLOCK")

        # 3. Assert Core request is NOT approved
        self.assertEqual(core_mr.status, "pending")

        # 4. Assert NO BlockProposal is created automatically
        proposals = self.db.scalars(select(BlockProposal)).all()
        self.assertEqual(len(proposals), 0)

        # 5. Assert NO OperationalBlock is created automatically
        blocks = self.db.scalars(select(OperationalBlock)).all()
        self.assertEqual(len(blocks), 0)

    # ── Test B: No Synthetic Approval ───────────────────────────────────────
    def test_b_no_synthetic_approval(self):
        req = self._sample_maintenance_request(department="SMMS")
        decision = self.service.ingest(self.db, req)

        # Assert response is NOT approved
        self.assertNotEqual(decision.status, "approved")
        self.assertEqual(decision.status, "queued")
        self.assertEqual(decision.resulting_state, "clear")

        # Assert integration ledger is NOT approved
        ledger = self.db.get(DemoIntegrationRequest, str(req.request_id))
        self.assertNotEqual(ledger.status, "approved")
        self.assertEqual(ledger.status, "queued")

    # ── Test C: External Provenance Preservation ────────────────────────────
    def test_c_provenance_preservation(self):
        test_cases = [
            ("TMS", SourceSystem.TMS.value, Department.ENGG.value),
            ("SMMS", SourceSystem.SMMS.value, Department.SNT.value),
            ("TDMS", SourceSystem.TDMS.value, Department.TRD.value),
        ]

        for demo_dept, expected_src, expected_dept in test_cases:
            req = self._sample_maintenance_request(department=demo_dept)
            self.service.ingest(self.db, req)

            ledger = self.db.get(DemoIntegrationRequest, str(req.request_id))
            core_mr = self.db.get(MaintenanceRequest, ledger.maintenance_request_id)

            self.assertIsNotNone(core_mr)
            self.assertEqual(core_mr.department, expected_dept)

            # Check request_data JSON preserves provenance
            request_data = core_mr.request_data or {}
            self.assertEqual(request_data.get("source_system"), expected_src)
            self.assertEqual(request_data.get("external_id"), str(req.request_id))

            # Check external_payload retains raw demo attributes
            external_payload = request_data.get("external_payload") or {}
            self.assertEqual(external_payload.get("department"), demo_dept)
            self.assertEqual(external_payload.get("type"), "maintenance_block")

    # ── Test D: Idempotency ─────────────────────────────────────────────────
    def test_d_idempotency_returns_stored_decision_without_duplication(self):
        req = self._sample_maintenance_request()
        decision_1 = self.service.ingest(self.db, req)
        decision_2 = self.service.ingest(self.db, req)

        self.assertEqual(decision_1.request_id, decision_2.request_id)
        self.assertEqual(decision_1.status, decision_2.status)
        self.assertIn("Idempotent replay", decision_2.notes)

        # Core rows must not be duplicated
        total_mr = self.db.scalars(select(MaintenanceRequest)).all()
        self.assertEqual(len(total_mr), 1)

        total_ledger = self.db.scalars(select(DemoIntegrationRequest)).all()
        self.assertEqual(len(total_ledger), 1)

    # ── Test E: Boundary Isolation ──────────────────────────────────────────
    def test_e_boundary_isolation_preserves_core_lifecycle(self):
        req = self._sample_maintenance_request()
        self.service.ingest(self.db, req)

        # Verify no proposals or operational blocks exist
        self.assertEqual(len(self.db.scalars(select(BlockProposal)).all()), 0)
        self.assertEqual(len(self.db.scalars(select(OperationalBlock)).all()), 0)

        # Verify static imports: Core modules must not import Demo Gateway
        core_files = [
            "backend/services/optimization_service.py",
            "backend/services/conflict_service.py",
            "backend/services/approval_service.py",
            "backend/repositories/operational_block_repository.py",
        ]
        for rel_path in core_files:
            content = Path(rel_path).read_text(encoding="utf-8")
            self.assertNotIn("demo_gateway", content)
            self.assertNotIn("DemoGatewayService", content)

    # ── Test F: Invalid Section Rejection ───────────────────────────────────
    def test_f_invalid_section_rejection(self):
        req = self._sample_maintenance_request(section_id="NDLS-CNB")
        with self.assertRaises(ValueError) as ctx:
            self.service.ingest(self.db, req)
        self.assertIn("outside the trained AJJ-JTJ corridor", str(ctx.exception))

        # Test route level raises HTTP 422
        with self.assertRaises(HTTPException) as http_ctx:
            ingest_demo_request(req, db=self.db)
        self.assertEqual(http_ctx.exception.status_code, 422)

    # ── Test G: Truthful Telemetry Behavior ─────────────────────────────────
    def test_g_telemetry_requests_do_not_fabricate_train_movements(self):
        entry_req = DemoRequest(
            request_id=uuid4(),
            department="TDMS",
            type="section_entry",
            train_id="12005",
            section_id="AJJ-SHU",
            description="Train 12005 section entry",
            raised_at=datetime.now(timezone.utc),
        )
        entry_decision = self.service.ingest(self.db, entry_req)
        self.assertEqual(entry_decision.status, "queued")
        self.assertEqual(entry_decision.resulting_state, "clear")
        self.assertIn("Section-entry telemetry recorded", entry_decision.notes)

        running_req = DemoRequest(
            request_id=uuid4(),
            department="TMS",
            type="running_status",
            train_id="12005",
            section_id="AJJ-SHU",
            description="Train 12005 running late by 15 min",
            raised_at=datetime.now(timezone.utc),
        )
        running_decision = self.service.ingest(self.db, running_req)
        self.assertEqual(running_decision.status, "queued")
        self.assertEqual(running_decision.resulting_state, "clear")
        self.assertIn("Running-status telemetry recorded", running_decision.notes)

        # Assert no fake Core records were created
        self.assertEqual(len(self.db.scalars(select(MaintenanceRequest)).all()), 0)
        self.assertEqual(len(self.db.scalars(select(TrainMovement)).all()), 0)
        self.assertEqual(len(self.db.scalars(select(OperationalBlock)).all()), 0)

    # ── Test H: Demo Frontend Boundary ──────────────────────────────────────
    def test_h_demo_frontend_does_not_call_core_maintenance_directly(self):
        frontend_form = Path("demo/frontend/src/components/OptimizerForm.jsx")
        self.assertTrue(frontend_form.exists(), "OptimizerForm.jsx must exist")
        content = frontend_form.read_text(encoding="utf-8")

        # Ingestion must not call Core /api/maintenance directly
        self.assertNotIn("fetch('http://localhost:8000/api/maintenance',", content)
        self.assertNotIn("fetch(\"http://localhost:8000/api/maintenance\",", content)
        self.assertNotIn("/api/maintenance/${req.id}/predict", content)

        # Submissions must route via integration endpoints
        self.assertTrue(
            "/api/demo-gateway/requests" in content or "api/inject" in content or ":9002/requests" in content,
            "OptimizerForm must route through the Demo Integration path",
        )

    # ── Test I: Transactional Atomicity (Rollback on Failure) ────────────────
    def test_i_transactional_atomicity_rolls_back_partial_state(self):
        req = self._sample_maintenance_request(department="TMS")

        # Monkey-patch _make_decision to force an unexpected failure AFTER
        # DemoIntegrationRequest, MaintenanceRequest, and Prediction have all been staged/flushed.
        original_make_decision = self.service._make_decision

        def failing_make_decision(r, mid):
            # Assert that prior to rollback, rows are visible in the flushed session
            staged_ledger = self.db.get(DemoIntegrationRequest, str(r.request_id))
            self.assertIsNotNone(staged_ledger, "DemoIntegrationRequest should be staged")
            staged_mr = self.db.get(MaintenanceRequest, mid)
            self.assertIsNotNone(staged_mr, "MaintenanceRequest should be staged")
            staged_pred = self.db.scalars(select(Prediction).where(Prediction.maintenance_request_id == mid)).first()
            self.assertIsNotNone(staged_pred, "Prediction should be staged")
            raise RuntimeError("Forced simulation failure after Core staging")

        self.service._make_decision = failing_make_decision
        try:
            with self.assertRaises(RuntimeError) as ctx:
                self.service.ingest(self.db, req)
            self.assertIn("Forced simulation failure after Core staging", str(ctx.exception))

            # Verify that DemoGatewayService.ingest() transaction rollback completely
            # cleared all flushed entities from the session/database.
            self.assertEqual(len(self.db.scalars(select(DemoIntegrationRequest)).all()), 0)
            self.assertEqual(len(self.db.scalars(select(MaintenanceRequest)).all()), 0)
            self.assertEqual(len(self.db.scalars(select(Prediction)).all()), 0)
        finally:
            self.service._make_decision = original_make_decision

    # ── Test J: Department Mapping Helper and COA Rejection ───────────────────
    def test_j_department_mapping_and_coa_rejection(self):
        # Valid engineering maintenance sources
        self.assertEqual(map_source_and_department("TMS"), ("TMS", "ENGG"))
        self.assertEqual(map_source_and_department("SMMS"), ("SMMS", "S&T"))
        self.assertEqual(map_source_and_department("TDMS"), ("TDMS", "TRD"))
        self.assertEqual(map_source_and_department("ENGG"), ("TMS", "ENGG"))
        self.assertEqual(map_source_and_department("S&T"), ("SMMS", "S&T"))
        self.assertEqual(map_source_and_department("TRD"), ("TDMS", "TRD"))

        # COA / OPERATING / TRAFFIC are movement/timetable systems and must be rejected
        for invalid_src in ("COA", "OPERATING", "TRAFFIC"):
            with self.assertRaises(ValueError) as ctx:
                map_source_and_department(invalid_src)
            self.assertIn("traffic operations source", str(ctx.exception))

        # Unsupported arbitrary departments must be rejected
        with self.assertRaises(ValueError) as ctx:
            map_source_and_department("UNKNOWN")
        self.assertIn("Unsupported maintenance department", str(ctx.exception))

    # ── Test K: Route Level Verification ────────────────────────────────────
    def test_k_route_endpoints(self):
        req = self._sample_maintenance_request()
        decision = ingest_demo_request(req, db=self.db)
        self.assertEqual(decision.status, "queued")

        requests_list = list_demo_requests(db=self.db)
        self.assertEqual(len(requests_list), 1)
        self.assertEqual(requests_list[0].request_id, str(req.request_id))

        single = get_demo_request(str(req.request_id), db=self.db)
        self.assertEqual(single.request_id, str(req.request_id))
        self.assertEqual(single.status, "queued")

        # Unknown ID returns 404
        with self.assertRaises(HTTPException) as ctx:
            get_demo_request(str(uuid4()), db=self.db)
        self.assertEqual(ctx.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
