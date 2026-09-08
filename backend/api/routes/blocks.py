import asyncio
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.database.models.block import BlockRecord
from backend.database.models.conflict import ConflictRecord
from backend.database.models.train import Train
from backend.services.rules import derive_urgency_tier, create_audit_entry, is_batch_eligible
from backend.services.conflict_engine import detect_conflicts
from backend.services.ai_integration import generate_ai_suggestion
from backend.services.block_service import process_block_conflicts_async

router = APIRouter()

# Simple global pubsub for WebSocket broadcasts (in-memory for demo)
class Broadcaster:
    def __init__(self):
        self.queues = []
    def add_queue(self, q: asyncio.Queue):
        self.queues.append(q)
    def remove_queue(self, q: asyncio.Queue):
        self.queues.remove(q)
    async def broadcast(self, message: dict):
        for q in self.queues:
            await q.put(message)

broadcaster = Broadcaster()

@router.get("/blocks")
def list_blocks(db: Session = Depends(get_db)):
    blocks = db.query(BlockRecord).all()
    # Serialize to JSON structure matching frontend
    return [
        {
            "id": b.id,
            "department": b.department,
            "category": b.category,
            "description": b.description,
            "location": b.location,
            "scheduledWindow": b.scheduledWindow,
            "urgency": b.urgency,
            "status": b.status,
            "source": b.source,
            "conflict": b.conflict,
            "aiSuggestion": b.aiSuggestion,
            "evidence": b.evidence,
            "auditTrail": b.auditTrail,
        }
        for b in blocks
    ]

@router.post("/blocks")
async def create_block(payload: dict, db: Session = Depends(get_db)):
    # Calculate urgency
    tier = derive_urgency_tier(payload.get("urgency", {}).get("timeToBreachHours"))
    urgency = payload.get("urgency", {})
    urgency["tier"] = tier
    
    # Audit trail
    audit = create_audit_entry("System", "Scheduler", "Created")
    
    block = BlockRecord(
        id=payload.get("id", f"BLK-{str(uuid.uuid4())[:8].upper()}"),
        department=payload.get("department"),
        category=payload.get("category"),
        description=payload.get("description"),
        location=payload.get("location"),
        scheduledWindow=payload.get("scheduledWindow"),
        urgency=urgency,
        status="Submitted",
        source={"system": "Manual", "lastUpdated": "Just now"},
        auditTrail=[audit],
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    
    # Run conflict detection asynchronously to not block return
    asyncio.create_task(process_block_conflicts_async(broadcaster))
    
    message = {"type": "BLOCK_CREATED", "payload": {"id": block.id}}
    asyncio.create_task(broadcaster.broadcast(message))
    
    return {"id": block.id}

@router.post("/blocks/{block_id}/approve")
async def approve_block(block_id: str, db: Session = Depends(get_db)):
    block = db.query(BlockRecord).filter(BlockRecord.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
        
    # Re-validate eligibility on server
    block_dict = {"conflict": block.conflict}
    if not is_batch_eligible(block_dict):
        raise HTTPException(status_code=400, detail="Block has unresolved conflicts and cannot be approved")
        
    block.status = "Approved"
    
    audit = create_audit_entry("Operator", "Controller", "Approved", agreed_with_ai=True if block.aiSuggestion else None)
    
    # Need to create new list to trigger SQLAlchemy JSON mutation detection
    new_audit = list(block.auditTrail)
    new_audit.append(audit)
    block.auditTrail = new_audit
    
    db.commit()
    
    message = {"type": "BLOCK_UPDATED", "payload": {"id": block.id, "status": "Approved"}}
    asyncio.create_task(broadcaster.broadcast(message))
    
    return {"status": "success"}
