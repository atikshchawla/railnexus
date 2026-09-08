import datetime
from sqlalchemy.orm import Session
from backend.database.connection import SessionLocal
from backend.database.models.block import BlockRecord
from backend.services.rules import derive_urgency_tier, create_audit_entry

def seed():
    db = SessionLocal()
    
    # Check if we already have blocks
    if db.query(BlockRecord).count() > 0:
        print("Database already seeded")
        db.close()
        return

    today = datetime.datetime.utcnow().date().isoformat()
    
    blocks = [
        {
            "id": "BLK-4521",
            "department": "Engg",
            "category": "IMR",
            "description": "Rail fracture repair",
            "location": {"kmStart": 244, "kmEnd": 248, "line": "UP"},
            "scheduledWindow": {"start": f"{today}T14:00:00Z", "end": f"{today}T16:00:00Z"},
            "urgency": {"timeToBreachHours": 18},
            "status": "Under review",
            "source": {"system": "TMS", "lastUpdated": "2m ago"},
            "auditTrail": [create_audit_entry("R. Sharma", "JE/PWay", "Acknowledged")]
        },
        {
            "id": "BLK-4520",
            "department": "S&T",
            "category": "PM",
            "description": "Track circuit relay replacement",
            "location": {"kmStart": 250, "kmEnd": 252, "line": "DN"},
            "scheduledWindow": {"start": f"{today}T10:00:00Z", "end": f"{today}T12:30:00Z"},
            "urgency": {"timeToBreachHours": 336},
            "status": "Submitted",
            "source": {"system": "TDMS", "lastUpdated": "8m ago"},
            "auditTrail": []
        }
    ]
    
    for b in blocks:
        b["urgency"]["tier"] = derive_urgency_tier(b["urgency"]["timeToBreachHours"])
        record = BlockRecord(
            id=b["id"],
            department=b["department"],
            category=b["category"],
            description=b["description"],
            location=b["location"],
            scheduledWindow=b["scheduledWindow"],
            urgency=b["urgency"],
            status=b["status"],
            source=b["source"],
            auditTrail=b["auditTrail"]
        )
        db.add(record)
        
    db.commit()
    db.close()
    print("Seeding complete")

if __name__ == "__main__":
    seed()
