from fastapi import HTTPException


def ensure_unique_ids(ids: list[str]) -> None:
    if len(ids) != len(set(ids)):
        raise HTTPException(status_code=422, detail="request ids must be unique")
