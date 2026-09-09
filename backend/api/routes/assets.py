import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.api.schemas.asset import AssetCreate, AssetRead
from backend.database.connection import get_db
from backend.repositories.asset_repository import AssetRepository
from backend.services.asset_service import AssetService

router = APIRouter(prefix="/assets", tags=["assets"])
repository = AssetRepository()
service = AssetService(repository)


def serialize_asset(asset):
    return {
        "id": asset.id,
        "asset_code": asset.asset_code,
        "asset_type": asset.asset_type,
        "section_id": asset.section_id,
        "location_km": asset.location_km,
        "department": asset.department,
        "commissioned_at": asset.commissioned_at,
        "status": asset.status,
        "metadata": json.loads(asset.metadata_json or "{}"),
        "created_at": asset.created_at,
        "updated_at": asset.updated_at,
    }


@router.get("", response_model=list[AssetRead])
def list_assets(section_id: str | None = Query(default=None), db: Session = Depends(get_db)):
    return [serialize_asset(asset) for asset in repository.list(db, section_id=section_id)]


@router.post("", response_model=AssetRead, status_code=201)
def create_asset(payload: AssetCreate, db: Session = Depends(get_db)):
    return serialize_asset(service.create(db, payload))


@router.get("/{asset_id}", response_model=AssetRead)
def get_asset(asset_id: str, db: Session = Depends(get_db)):
    asset = repository.get(db, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="asset not found")
    return serialize_asset(asset)
