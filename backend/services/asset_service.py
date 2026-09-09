import json
from sqlalchemy.orm import Session

from backend.api.schemas.asset import AssetCreate
from backend.database.models.asset import Asset
from backend.repositories.asset_repository import AssetRepository


class AssetService:
    def __init__(self, repository: AssetRepository | None = None):
        self.repository = repository or AssetRepository()

    def create(self, db: Session, payload: AssetCreate) -> Asset:
        asset = Asset(
            asset_code=payload.asset_code,
            asset_type=payload.asset_type,
            section_id=payload.section_id,
            location_km=payload.location_km,
            department=payload.department,
            commissioned_at=payload.commissioned_at,
            status=payload.status,
            metadata_json=json.dumps(payload.metadata),
        )
        return self.repository.create(db, asset)
