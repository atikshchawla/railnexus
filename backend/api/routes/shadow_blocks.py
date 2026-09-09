from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.schemas.shadow_block import ShadowBlockRequest, ShadowBlockResponse
from backend.database.connection import get_db
from backend.repositories.maintenance_repository import MaintenanceRepository
from backend.services.shadow_block_service import compare_requests

router = APIRouter(prefix="/shadow-blocks", tags=["shadow blocks"])
repository = MaintenanceRepository()


@router.post("", response_model=list[ShadowBlockResponse])
def shadow_blocks(payload: ShadowBlockRequest, db: Session = Depends(get_db)):
    requests = [repository.get(db, request_id) for request_id in payload.request_ids]
    if any(request is None for request in requests):
        raise HTTPException(status_code=404, detail="one or more maintenance requests not found")
    return compare_requests([request for request in requests if request is not None], payload.max_spatial_gap_km)
