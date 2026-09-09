"""Singleton loader for the AI/ML ModelPipeline.

Initializes once at startup. Falls back to None if model files are missing
so the app never crashes without AI — blocks just show aiSuggestion: null.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ai_ml.pipeline import ModelPipeline

logger = logging.getLogger(__name__)

_pipeline: "ModelPipeline | None" = None
_loaded = False


def load_pipeline(model_dir: Path | None = None) -> None:
    """Attempt to load the ML pipeline once. Safe to call multiple times."""
    global _pipeline, _loaded
    if _loaded:
        return
    _loaded = True
    try:
        from ai_ml.pipeline import ModelPipeline
        from backend.utils.config import get_settings

        directory = model_dir or get_settings().ai_model_dir
        _pipeline = ModelPipeline(directory)
        logger.info("AI/ML pipeline loaded from %s", directory)
    except Exception as exc:
        logger.warning("AI/ML pipeline unavailable — running without AI: %s", exc)
        _pipeline = None


def get_pipeline() -> "ModelPipeline | None":
    """Return the loaded pipeline, or None if unavailable."""
    if not _loaded:
        load_pipeline()
    return _pipeline
