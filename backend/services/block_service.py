import asyncio

from backend.database.models.block import BlockRecord
from backend.database.models.conflict import ConflictRecord
from backend.services.conflict_engine import detect_conflicts
from backend.services.ai_integration import generate_ai_suggestion

async def process_block_conflicts_async(broadcaster):
    """
    Background task to run conflict detection after a block is created/updated.
    """
    # Wait a bit to simulate processing
    await asyncio.sleep(0.5)
    
    # Needs a new DB session for background task
    from backend.database.connection import SessionLocal
    db = SessionLocal()
    try:
        blocks = db.query(BlockRecord).all()
        # Mock trains for demo
        trains = [
            {
                "id": "12005", "name": "Kalka Shatabdi", "type": "Passenger",
                "stops": [
                  {"stationId": "umb", "km": 238, "time": 6 * 3600000},
                  {"stationId": "srs", "km": 241, "time": 6.12 * 3600000},
                  {"stationId": "nrg", "km": 244, "time": 6.22 * 3600000},
                  {"stationId": "bra", "km": 248, "time": 6.38 * 3600000},
                  {"stationId": "sre", "km": 252, "time": 6.55 * 3600000},
                ]
            }
        ]
        
        block_dicts = [{"id": b.id, "department": b.department, "category": b.category, "location": b.location, "scheduledWindow": b.scheduledWindow, "status": b.status} for b in blocks]
        
        conflicts = detect_conflicts(block_dicts, trains)
        
        for c in conflicts:
            # Check if exists
            existing = db.query(ConflictRecord).filter(ConflictRecord.id == c["id"]).first()
            if not existing:
                new_conf = ConflictRecord(
                    id=c["id"],
                    blockAId=c["blockAId"],
                    blockBId=c.get("blockBId"),
                    overlapDescription=c["overlapDescription"],
                    status=c["status"],
                    windowStart=c["windowStart"]
                )
                db.add(new_conf)
                
                # Update block A
                block_a = db.query(BlockRecord).filter(BlockRecord.id == c["blockAId"]).first()
                if block_a:
                    block_a.conflict = {"conflictId": c["id"], "severity": "high", "status": "Unresolved"}
                    block_a.status = "Under review"
                    
                    # Generate AI suggestion
                    sug = generate_ai_suggestion(c)
                    block_a.aiSuggestion = sug
                
                # Update block B if exists
                if c.get("blockBId"):
                    block_b = db.query(BlockRecord).filter(BlockRecord.id == c["blockBId"]).first()
                    if block_b:
                        block_b.conflict = {"conflictId": c["id"], "severity": "high", "status": "Unresolved"}
                        block_b.status = "Under review"
                        block_b.aiSuggestion = sug
                        
                db.commit()
                asyncio.create_task(broadcaster.broadcast({"type": "CONFLICT_CREATED", "payload": {"id": c["id"]}}))
                asyncio.create_task(broadcaster.broadcast({"type": "BLOCK_UPDATED", "payload": {"id": c["blockAId"]}}))
    finally:
        db.close()
