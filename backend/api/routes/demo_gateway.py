from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.schemas.demo import DemoDecision, DemoIntegrationRead, DemoRequest
from backend.database.connection import get_db
from backend.database.models.demo import DemoIntegrationRequest
from backend.services.demo_gateway_service import DemoGatewayService

router = APIRouter(prefix="/demo-gateway", tags=["demo-gateway"])
service = DemoGatewayService()


@router.post("/requests", response_model=DemoDecision, status_code=202)
def ingest_demo_request(payload: DemoRequest, db: Session = Depends(get_db)) -> DemoDecision:
    try:
        return service.ingest(db, payload)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/requests", response_model=list[DemoIntegrationRead])
def list_demo_requests(db: Session = Depends(get_db)) -> list[DemoIntegrationRequest]:
    return list(db.query(DemoIntegrationRequest).order_by(DemoIntegrationRequest.created_at.desc()).limit(500))


@router.get("/requests/{request_id}", response_model=DemoIntegrationRead)
def get_demo_request(request_id: str, db: Session = Depends(get_db)) -> DemoIntegrationRequest:
    record = db.get(DemoIntegrationRequest, request_id)
    if record is None:
        raise HTTPException(status_code=404, detail="demo request not found")
    return record
