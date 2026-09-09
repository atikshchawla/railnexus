from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.api.schemas.topology import TopologyRead
from backend.database.connection import get_db
from backend.repositories.topology_repository import TopologyRepository

router = APIRouter(prefix="/topology", tags=["topology"])
repository = TopologyRepository()


@router.get("", response_model=list[TopologyRead])
def list_topology(section_id: str | None = Query(default=None), db: Session = Depends(get_db)):
    return repository.list(db, section_id=section_id)