from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SITEFORGE_", env_file=".env")

    data_dir: Path = Field(default=Path("data"))
    max_area_sq_m: float = Field(default=250_000)
    max_mesh_vertices: int = Field(default=40_000)
    max_provider_tiles: int = Field(default=4)
    sample_dtm: Path | None = Field(default=None)
    allow_synthetic_fallback: bool = Field(default=True)
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    @property
    def cache_dir(self) -> Path:
        return self.data_dir / "cache"

    @property
    def projects_dir(self) -> Path:
        return self.data_dir / "projects"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.cache_dir.mkdir(parents=True, exist_ok=True)
    settings.projects_dir.mkdir(parents=True, exist_ok=True)
    return settings

