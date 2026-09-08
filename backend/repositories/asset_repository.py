from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database.models.asset import Asset


class AssetRepository:
    def list(self, db: Session, *, section_id: str | None = None) -> list[Asset]:
        statement = select(Asset).order_by(Asset.asset_code)
        if section_id:
            statement = statement.where(Asset.section_id == section_id)
        return list(db.scalars(statement))

    def get(self, db: Session, asset_id: str) -> Asset | None:
        return db.get(Asset, asset_id)

    def create(self, db: Session, asset: Asset) -> Asset:
        db.add(asset)
        db.commit()
        db.refresh(asset)
        return asset
