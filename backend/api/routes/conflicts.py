import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.database.models.block import BlockRecord
from backend.database.models.conflict import ConflictRecord
from backend.services.rules import create_audit_entry

# We'll import the broadcaster from blocks for demo simplicity
from backend.api.routes.blocks import broadcaster

router = APIRouter()

@router.get("/conflicts")
def list_conflicts(db: Session = Depends(get_db)):
    conflicts = db.query(ConflictRecord).all()
    return [
        {
            "id": c.id,
            "blockAId": c.blockAId,
            "blockBId": c.blockBId,
            "overlapDescription": c.overlapDescription,
            "status": c.status,
            "windowStart": c.windowStart,
            "resolution": c.resolution
        }
        for c in conflicts
    ]

@router.post("/conflicts/{conflict_id}/preview")
def preview_resolution(conflict_id: str, payload: dict, db: Session = Depends(get_db)):
    action = payload.get("action")
    if action not in ("merge", "sequence"):
        raise HTTPException(status_code=400, detail="Invalid action")
        
    c = db.query(ConflictRecord).filter(ConflictRecord.id == conflict_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Conflict not found")
        
    if not c.blockBId:
        return {"preview": "Cannot merge block with train. Use sequence or hold."}
        
    # Read-only preview
    a = db.query(BlockRecord).filter(BlockRecord.id == c.blockAId).first()
    b = db.query(BlockRecord).filter(BlockRecord.id == c.blockBId).first()
    
    if action == "merge":
        min_start = min(a.scheduledWindow["start"], b.scheduledWindow["start"])
        max_end = max(a.scheduledWindow["end"], b.scheduledWindow["end"])
        
        return {
            "action": "merge",
            "preview": {
                "department": f"{a.department} & {b.department}",
                "scheduledWindow": {"start": min_start, "end": max_end},
                "description": f"MERGED: {a.description} | {b.description}"
            }
        }
    return {"preview": "Sequence preview not fully implemented in demo"}

@router.post("/conflicts/{conflict_id}/resolve")
async def resolve_conflict(conflict_id: str, payload: dict, db: Session = Depends(get_db)):
    action = payload.get("action")
    
    c = db.query(ConflictRecord).filter(ConflictRecord.id == conflict_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Conflict not found")
        
    if c.status == "Resolved":
        raise HTTPException(status_code=400, detail="Conflict already resolved")
        
    c.status = "Resolved"
    c.resolution = {
        "action": action.capitalize(),
        "actor": "Operator",
        "timestamp": create_audit_entry("System", "", "")["timestamp"]
    }
    
    a = db.query(BlockRecord).filter(BlockRecord.id == c.blockAId).first()
    if a:
        a.conflict = {"conflictId": c.id, "severity": "high", "status": "Resolved"}
        a_audit = list(a.auditTrail)
        a_audit.append(create_audit_entry("Operator", "Controller", f"Resolved conflict via {action}"))
        a.auditTrail = a_audit
        
    if c.blockBId:
        b = db.query(BlockRecord).filter(BlockRecord.id == c.blockBId).first()
        if b:
            b.conflict = {"conflictId": c.id, "severity": "high", "status": "Resolved"}
            b_audit = list(b.auditTrail)
            b_audit.append(create_audit_entry("Operator", "Controller", f"Resolved conflict via {action}"))
            b.auditTrail = b_audit
            
    db.commit()
    
    await broadcaster.broadcast({"type": "CONFLICT_RESOLVED", "payload": {"id": c.id}})
    if a:
        await broadcaster.broadcast({"type": "BLOCK_UPDATED", "payload": {"id": a.id}})
    if c.blockBId:
        await broadcaster.broadcast({"type": "BLOCK_UPDATED", "payload": {"id": c.blockBId}})
        
    return {"status": "success"}
