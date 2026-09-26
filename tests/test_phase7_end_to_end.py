"""Verification test for Phase 7 complete end-to-end Core lifecycle:
Maintenance Request → Prediction → Optimization Run → Block Proposal → Conflict Detection → Approval/Reject → Operational Block.
"""

from __future__ import annotations

import unittest
from datetime import datetime, timezone
from uuid import uuid4

from backend.database.connection import SessionLocal
from backend.database.models import (
    MaintenanceRequest,
    OptimizationRun,
    BlockProposal,
    OperationalBlock,
)

from backend.services.maintenance_service import MaintenanceService
from backend.services.prediction_service import PredictionService
from backend.services.optimization_service import OptimizationService
from backend.services.conflict_service import ConflictService
from backend.services.approval_service import ApprovalService

from backend.api.schemas.maintenance import MaintenanceCreate
from backend.api.schemas.prediction import PipelineOptimizeRequest
from backend.api.schemas.conflict import ConflictDetectRequest
from backend.api.schemas.approval import ProposalApproveRequest, ProposalRejectRequest


def _make_features(section_id: str, dept: str, km: float, duration: int = 90) -> dict:
    return {
        "asset_age_days": 1500,
        "days_since_last_maintenance": 60,
        "previous_failure_count": 0,
        "lifetime_tonnage_mgt": 300.0,
        "tonnage_since_last_maintenance_mgt": 50.0,
        "daily_train_count": 100,
        "daily_tonnage_mgt": 2.0,
        "inspection_score": 70,
        "rainfall_mm": 5.0,
        "temperature_mean_c": 28.0,
        "max_wind_speed_kmh": 15.0,
        "is_heavy_rain_day": False,
        "asset_type": "TRACK_CIRCUIT",
        "department": dept,
        "section_id": section_id,
        "planned_duration_minutes": duration,
        "severity_score": 7,
        "workers_required": 4,
        "equipment_count": 2,
        "workload_per_worker": 15.0,
        "weather_risk": 0.1,
        "congestion_score": 0.2,
        "current_delay_minutes": 0,
        "window_average_delay_minutes": 5,
        "window_peak_delay_minutes": 10,
        "accumulated_tonnage_mgt": 300.0,
        "trains_in_section": 4,
        "section_complexity": 0.5,
        "traffic_density": 0.6,
        "safety_critical": True,
        "is_heatwave_day": False,
        "is_rain_day": True,
        "request_hour": 10,
        "request_day_of_week": 1,
        "request_month": 9,
        "request_is_weekend": False,
        "location_km_marker": km,
        "window_train_count": 25,
        "planned_start_hour": 10,
        "work_type": "RAIL_REPLACEMENT",
        "priority": "HIGH",
        "earliest_start_minute": 480,
        "latest_end_minute": 900,
    }


class TestPhase7EndToEnd(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        self.maint_service = MaintenanceService()
        self.pred_service = PredictionService()
        self.opt_service = OptimizationService()
        self.conflict_service = ConflictService()
        self.approval_service = ApprovalService()

    def tearDown(self):
        self.db.close()

    def test_complete_core_workflow(self):
        # 1. Select/create maintenance requests (compatible ENGG + TRD on AJJ-SHU)
        req_create1 = MaintenanceCreate(
            section_id="AJJ-SHU",
            department="ENGG",
            work_type="RAIL_REPLACEMENT",
            location_km=10.0,
            priority="HIGH",
            safety_critical=True,
            deadline_minutes=1440,
            model_features=_make_features("AJJ-SHU", "ENGG", 10.0, 120),
        )
        r1 = self.maint_service.create(self.db, req_create1)
        pred1 = self.pred_service.predict(self.db, r1)
        self.assertGreater(pred1.predicted_duration_minutes, 0)

        req_create2 = MaintenanceCreate(
            section_id="AJJ-SHU",
            department="TRD",
            work_type="OHE_MAINTENANCE",
            location_km=11.5,
            priority="MEDIUM",
            safety_critical=False,
            deadline_minutes=1440,
            model_features=_make_features("AJJ-SHU", "TRD", 11.5, 90),
        )
        r2 = self.maint_service.create(self.db, req_create2)
        pred2 = self.pred_service.predict(self.db, r2)
        self.assertGreater(pred2.predicted_duration_minutes, 0)

        # 2. Optimization Run with CP-SAT
        opt_req = PipelineOptimizeRequest(
            request_ids=[r1.id, r2.id],
            force_rerun=True,
            max_group_size=4,
            max_spatial_gap_km=10.0,
            weights={},
        )
        opt_result = self.opt_service.optimize(self.db, opt_req)
        self.assertIsNotNone(opt_result)
        run_id = opt_result["_run_id"]
        self.assertTrue(run_id, "OptimizationRun ID must be returned")

        # 3. Confirm new OptimizationRun exists in DB and BlockProposals belong to that exact run
        self.db.expire_all()
        run_record = self.db.query(OptimizationRun).filter_by(id=run_id).first()
        self.assertIsNotNone(run_record)
        proposals = self.db.query(BlockProposal).filter_by(run_id=run_id).all()
        self.assertGreater(len(proposals), 0)
        target_proposal = proposals[0]
        self.assertEqual(target_proposal.run_id, run_id)

        # 4. Detect conflicts using that exact run_id
        conflict_req = ConflictDetectRequest(run_id=run_id)
        detected_conflicts = self.conflict_service.detect_conflicts(self.db, conflict_req)
        self.assertIsInstance(detected_conflicts, list)

        # 5. Approvals list verification
        approvals_list = self.approval_service.list_proposals(self.db, run_id=run_id)
        self.assertTrue(any(p.id == target_proposal.id for p in approvals_list))

        # 6. Approve Proposal with authoritative contract
        approve_req = ProposalApproveRequest(
            block_id=f"OP-{target_proposal.section_id}-{target_proposal.id[:8].upper()}",
            approved_by="CTRL-01",
            lead_department="ENGG",
            start_km=10.0,
            end_km=11.5,
            track_line="UP",
        )
        try:
            op_block = self.approval_service.approve_proposal(self.db, target_proposal.id, approve_req)
        except Exception:
            # If conflict safety gate triggered, test override
            approve_req.override_justification = "Approved under Section Controller emergency order"
            approve_req.override_code = "CONTROLLER_SAFETY_OVERRIDE"
            approve_req.operator_role = "SECTION_CONTROLLER"
            op_block = self.approval_service.approve_proposal(self.db, target_proposal.id, approve_req)

        self.assertEqual(op_block.id, approve_req.block_id)
        self.assertEqual(op_block.status, "APPROVED")

        # 7. Confirm OperationalBlock is created in persistence
        self.db.expire_all()
        persisted_ob = self.db.query(OperationalBlock).filter_by(id=op_block.id).first()
        self.assertIsNotNone(persisted_ob)
        self.assertEqual(persisted_ob.status, "APPROVED")

        # 8. Confirm the proposal/request state changes according to Phase 6C
        updated_proposal = self.db.query(BlockProposal).filter_by(id=target_proposal.id).first()
        self.assertIn(updated_proposal.status, ["ACCEPTED", "OVERRIDDEN"])

        # 9. Verify idempotent retrieval of OperationalBlock
        fetched_ob = self.db.query(OperationalBlock).filter_by(id=persisted_ob.id).first()
        self.assertIsNotNone(fetched_ob)
        self.assertEqual(fetched_ob.id, persisted_ob.id)

    def test_rejection_workflow(self):
        # Create request and proposal
        req_create1 = MaintenanceCreate(
            section_id="VN-JTJ",
            department="ENGG",
            work_type="RAIL_REPLACEMENT",
            location_km=42.0,
            priority="MEDIUM",
            safety_critical=False,
            deadline_minutes=2880,
            model_features=_make_features("VN-JTJ", "ENGG", 42.0, 90),
        )
        r1 = self.maint_service.create(self.db, req_create1)
        self.pred_service.predict(self.db, r1)

        req_create2 = MaintenanceCreate(
            section_id="VN-JTJ",
            department="TRD",
            work_type="RAIL_REPLACEMENT",
            location_km=43.0,
            priority="MEDIUM",
            safety_critical=False,
            deadline_minutes=2880,
            model_features=_make_features("VN-JTJ", "TRD", 43.0, 90),
        )
        r2 = self.maint_service.create(self.db, req_create2)
        self.pred_service.predict(self.db, r2)

        opt_res = self.opt_service.optimize(
            self.db,
            PipelineOptimizeRequest(request_ids=[r1.id, r2.id], force_rerun=True),
        )
        self.db.expire_all()
        proposal = self.db.query(BlockProposal).filter_by(run_id=opt_res["_run_id"]).first()
        self.assertIsNotNone(proposal)

        # Reject proposal
        reject_req = ProposalRejectRequest(
            rejected_by="CTRL-01",
            rejection_reason="Deferred due to special passenger train movement",
            operator_role="SECTION_CONTROLLER",
        )
        res_reject = self.approval_service.reject_proposal(self.db, proposal.id, reject_req)
        self.assertEqual(res_reject["status"], "REJECTED")

        # Verify DB state
        self.db.expire_all()
        persisted_p = self.db.query(BlockProposal).filter_by(id=proposal.id).first()
        self.assertEqual(persisted_p.status, "REJECTED")

    def test_conflict_gate_409_and_override(self):
        from fastapi import HTTPException
        from backend.database.models.conflict import Conflict

        # Create requests and proposal
        req_create1 = MaintenanceCreate(
            section_id="VN-JTJ",
            department="ENGG",
            work_type="RAIL_REPLACEMENT",
            location_km=42.0,
            priority="MEDIUM",
            safety_critical=False,
            deadline_minutes=2880,
            model_features=_make_features("VN-JTJ", "ENGG", 42.0, 90),
        )
        r1 = self.maint_service.create(self.db, req_create1)
        self.pred_service.predict(self.db, r1)

        req_create2 = MaintenanceCreate(
            section_id="VN-JTJ",
            department="TRD",
            work_type="RAIL_REPLACEMENT",
            location_km=43.0,
            priority="MEDIUM",
            safety_critical=False,
            deadline_minutes=2880,
            model_features=_make_features("VN-JTJ", "TRD", 43.0, 90),
        )
        r2 = self.maint_service.create(self.db, req_create2)
        self.pred_service.predict(self.db, r2)

        opt_res = self.opt_service.optimize(
            self.db,
            PipelineOptimizeRequest(request_ids=[r1.id, r2.id], force_rerun=True),
        )
        self.db.expire_all()
        proposal = self.db.query(BlockProposal).filter_by(run_id=opt_res["_run_id"]).first()
        self.assertIsNotNone(proposal)

        # Stage an active blocking conflict for this proposal
        conflict = Conflict(
            id=f"CONF-{uuid4().hex[:8].upper()}",
            conflict_type="SECTION_OCCUPATION",
            severity="CRITICAL",
            proposal_a_id=proposal.id,
            track_line="UP",
            overlap_description="Simultaneous train occupation hazard",
            spatial_km_start=24.0,
            spatial_km_end=26.0,
            temporal_start=proposal.proposed_start_time,
            temporal_end=proposal.proposed_end_time,
            status="UNRESOLVED",
            is_blocking=True,
        )
        self.db.add(conflict)
        self.db.commit()

        # Attempt to approve with active blocking conflict -> MUST raise HTTPException 409 (Safety Gate)
        approve_req = ProposalApproveRequest(
            block_id=f"OP-{proposal.section_id}-{uuid4().hex[:6].upper()}",
            approved_by="CTRL-01",
            lead_department="ENGG",
            start_km=42.0,
            end_km=43.0,
            track_line="UP",
        )
        with self.assertRaises(HTTPException) as cm:
            self.approval_service.approve_proposal(self.db, proposal.id, approve_req)
        self.assertEqual(cm.exception.status_code, 409)
        self.assertIn("unresolved", cm.exception.detail.lower())

        # Resolve the conflict via resolution workflow
        conflict.status = "RESOLVED"
        self.db.commit()

        # Approval must now succeed
        op_block = self.approval_service.approve_proposal(self.db, proposal.id, approve_req)
        self.assertEqual(op_block.status, "APPROVED")

        # Verify DB state reflects ACCEPTED
        self.db.expire_all()
        persisted_p = self.db.query(BlockProposal).filter_by(id=proposal.id).first()
        self.assertEqual(persisted_p.status, "ACCEPTED")

    def test_pipeline_normalization_preserves_persisted_fields(self):
        """Valid persisted domain fields from request columns are preserved in model_features."""
        req = MaintenanceCreate(
            section_id="AJJ-SHU",
            department="ENGG",
            work_type="TRACK_MAINTENANCE",
            location_km=15.5,
            priority="HIGH",
            safety_critical=True,
            deadline_minutes=720,
            model_features={
                "asset_age_days": 1200,
                "days_since_last_maintenance": 45,
                # section_id, department, work_type, priority, safety_critical omitted from model_features dict
            },
        )
        persisted = self.maint_service.create(self.db, req)
        pipeline_req = self.maint_service.to_pipeline_request(persisted)

        # Check preserved features
        features = pipeline_req.get("model_features", {})
        self.assertEqual(features.get("section_id"), "AJJ-SHU")
        self.assertEqual(features.get("department"), "ENGG")
        self.assertEqual(features.get("work_type"), "TRACK_MAINTENANCE")
        self.assertEqual(features.get("priority"), "HIGH")
        self.assertEqual(features.get("safety_critical"), True)
        self.assertEqual(features.get("location_km_marker"), 15.5)

    def test_incomplete_model_features_safely_skipped(self):
        """Incomplete model features are handled explicitly and safely skipped without crashing optimization."""
        # 1. Valid request with all required features
        valid_req = self.maint_service.create(
            self.db,
            MaintenanceCreate(
                section_id="AJJ-SHU",
                department="ENGG",
                work_type="RAIL_REPLACEMENT",
                location_km=5.0,
                priority="HIGH",
                safety_critical=True,
                deadline_minutes=1440,
                model_features=_make_features("AJJ-SHU", "ENGG", 5.0, 60),
            ),
        )
        self.pred_service.predict(self.db, valid_req)

        # 2. Incomplete request lacking failure risk and duration model features
        incomplete_req = self.maint_service.create(
            self.db,
            MaintenanceCreate(
                section_id="AJJ-SHU",
                department="ENGG",
                work_type="TRACK_MAINTENANCE",
                location_km=6.0,
                priority="LOW",
                safety_critical=False,
                deadline_minutes=2880,
                model_features={"some_random_key": 123},  # missing all standard ML model features
            ),
        )

        # Optimize both together
        opt_req = PipelineOptimizeRequest(
            request_ids=[valid_req.id, incomplete_req.id],
            force_rerun=True,
        )
        result = self.opt_service.optimize(self.db, opt_req)

        # Optimization should succeed, skipping incomplete_req explicitly
        self.assertIsNotNone(result)
        self.assertIn("_run_id", result)
        skipped = result.get("skipped_request_ids", [])
        self.assertIn(incomplete_req.id, skipped)

    def test_active_run_filtering(self):
        """Approval proposals can be queried strictly by active run_id without mixing historical runs."""
        # Create two separate optimization runs with paired requests so proposals are generated
        r1_a = self.maint_service.create(
            self.db,
            MaintenanceCreate(
                section_id="AJJ-SHU",
                department="ENGG",
                work_type="RAIL_REPLACEMENT",
                location_km=10.0,
                priority="HIGH",
                safety_critical=True,
                deadline_minutes=1440,
                model_features=_make_features("AJJ-SHU", "ENGG", 10.0, 120),
            ),
        )
        self.pred_service.predict(self.db, r1_a)
        r1_b = self.maint_service.create(
            self.db,
            MaintenanceCreate(
                section_id="AJJ-SHU",
                department="TRD",
                work_type="OHE_MAINTENANCE",
                location_km=11.5,
                priority="MEDIUM",
                safety_critical=False,
                deadline_minutes=1440,
                model_features=_make_features("AJJ-SHU", "TRD", 11.5, 90),
            ),
        )
        self.pred_service.predict(self.db, r1_b)

        res1 = self.opt_service.optimize(
            self.db,
            PipelineOptimizeRequest(
                request_ids=[r1_a.id, r1_b.id],
                force_rerun=True,
                max_group_size=4,
                max_spatial_gap_km=10.0,
            ),
        )
        run_id_1 = res1["_run_id"]

        r2_a = self.maint_service.create(
            self.db,
            MaintenanceCreate(
                section_id="AJJ-SHU",
                department="ENGG",
                work_type="RAIL_REPLACEMENT",
                location_km=14.0,
                priority="HIGH",
                safety_critical=True,
                deadline_minutes=1440,
                model_features=_make_features("AJJ-SHU", "ENGG", 14.0, 120),
            ),
        )
        self.pred_service.predict(self.db, r2_a)
        r2_b = self.maint_service.create(
            self.db,
            MaintenanceCreate(
                section_id="AJJ-SHU",
                department="TRD",
                work_type="OHE_MAINTENANCE",
                location_km=15.5,
                priority="MEDIUM",
                safety_critical=False,
                deadline_minutes=1440,
                model_features=_make_features("AJJ-SHU", "TRD", 15.5, 90),
            ),
        )
        self.pred_service.predict(self.db, r2_b)

        res2 = self.opt_service.optimize(
            self.db,
            PipelineOptimizeRequest(
                request_ids=[r2_a.id, r2_b.id],
                force_rerun=True,
                max_group_size=4,
                max_spatial_gap_km=10.0,
            ),
        )
        run_id_2 = res2["_run_id"]

        self.assertNotEqual(run_id_1, run_id_2)

        # Query proposals for run_id_1 strictly
        proposals_run1 = self.approval_service.list_proposals(self.db, run_id=run_id_1)
        self.assertTrue(len(proposals_run1) > 0)
        for p in proposals_run1:
            self.assertEqual(p.run_id, run_id_1)

        # Query proposals for run_id_2 strictly
        proposals_run2 = self.approval_service.list_proposals(self.db, run_id=run_id_2)
        self.assertTrue(len(proposals_run2) > 0)
        for p in proposals_run2:
            self.assertEqual(p.run_id, run_id_2)


if __name__ == "__main__":
    unittest.main()
