import hashlib
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database.models.optimized_block import OptimizedBlock


class OptimizedBlockRepository:
    """Handles caching and retrieval of optimizer results."""

    @staticmethod
    def _make_hash(request_ids: list[str]) -> str:
        """SHA-1 of the sorted, comma-joined request IDs."""
        key = ",".join(sorted(request_ids))
        return hashlib.sha1(key.encode()).hexdigest()

    def get_cached(self, db: Session, request_ids: list[str]) -> dict | None:
        """Return the cached optimizer result if the request set hasn't changed."""
        h = self._make_hash(request_ids)
        row = db.scalar(
            select(OptimizedBlock)
            .where(OptimizedBlock.request_ids_hash == h)
            .order_by(OptimizedBlock.created_at.desc())
        )
        if row and row.result_json:
            # Merge any stored operator overrides back into the result
            result = dict(row.result_json)
            result["_cache_id"] = row.id
            result["_operator_overrides"] = row.operator_overrides or {}
            return result
        return None

    def save(self, db: Session, request_ids: list[str], result: dict) -> OptimizedBlock:
        """Persist a fresh optimizer result, replacing any previous entry for this ID set."""
        h = self._make_hash(request_ids)
        # Remove stale entries for this exact request set
        existing = db.scalars(
            select(OptimizedBlock).where(OptimizedBlock.request_ids_hash == h)
        ).all()
        for old in existing:
            db.delete(old)

        row = OptimizedBlock(
            request_ids_hash=h,
            request_ids=request_ids,
            section_id=result.get("selected_blocks", [{}])[0].get("section_id", ""),
            predicted_duration_minutes=result.get("selected_blocks", [{}])[0].get(
                "predicted_duration_minutes", 0.0
            ),
            result_json=result,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    def save_overrides(self, db: Session, cache_id: str, overrides: dict) -> bool:
        """Persist operator time overrides and/or dissolution choices."""
        row = db.get(OptimizedBlock, cache_id)
        if not row:
            return False
        row.operator_overrides = overrides
        db.commit()
        return True
