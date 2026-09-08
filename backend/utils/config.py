from functools import lru_cache
import os
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")


class Settings:
    app_name: str = os.getenv("RAILNEXUS_APP_NAME", "RailNexus Backend")
    database_url: str = os.getenv(
        "RAILNEXUS_DATABASE_URL",
        f"sqlite:///{PROJECT_ROOT / 'railnexus.db'}",
    )
    ai_model_dir: Path = Path(os.getenv("RAILNEXUS_MODEL_DIR", "")) if os.getenv("RAILNEXUS_MODEL_DIR") else PROJECT_ROOT / "ai_ml" / "models"
    cors_origins: list[str] = [origin.strip() for origin in os.getenv("RAILNEXUS_CORS_ORIGINS", "http://localhost:3000").split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
