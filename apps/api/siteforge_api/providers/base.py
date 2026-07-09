from dataclasses import dataclass
from pathlib import Path

from shapely.geometry.base import BaseGeometry

from siteforge_api.schemas import DataSource, ProviderInfo


@dataclass(frozen=True)
class TileRef:
    id: str
    title: str
    href: str
    polygon_wgs84: BaseGeometry
    crs: str
    license_name: str
    license_url: str
    attribution: str


@dataclass(frozen=True)
class ResolvedTile:
    ref: TileRef
    path: Path
    source: DataSource


class TerrainProvider:
    id: str

    def info(self) -> ProviderInfo:
        raise NotImplementedError

    async def resolve_tiles(self, area_wgs84: BaseGeometry) -> list[TileRef]:
        raise NotImplementedError

    async def download_tile(self, tile: TileRef) -> ResolvedTile:
        raise NotImplementedError
