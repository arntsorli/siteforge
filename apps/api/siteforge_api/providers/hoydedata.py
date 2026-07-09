import hashlib
import re
import xml.etree.ElementTree as ET
from pathlib import Path

import httpx
from shapely.geometry import Polygon
from shapely.geometry.base import BaseGeometry

from siteforge_api.providers.base import ResolvedTile, TerrainProvider, TileRef
from siteforge_api.schemas import DataSource, ProviderInfo
from siteforge_api.settings import Settings


ATOM_NS = {"atom": "http://www.w3.org/2005/Atom", "georss": "http://www.georss.org/georss"}
DTM1_FEED_URL = "https://nedlasting.geonorge.no/geonorge/ATOM/hoydedata/datasett/DTM1.atom"
NLOD_URL = "https://data.norge.no/nlod/no/2.0/"
ATTRIBUTION = "Kartverket / Geonorge / Hoydedata DTM1"
ACCURACY_WARNING = (
    "DTM1 is bare-earth elevation data for rough planning only. It is not a survey or "
    "construction-ready model and may omit buildings, vegetation, site walls, and recent changes."
)


class HoydedataDtm1Provider(TerrainProvider):
    id = "hoydedata-dtm1"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.cache_dir = settings.cache_dir / self.id
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.feed_path = self.cache_dir / "DTM1.atom"

    def info(self) -> ProviderInfo:
        return ProviderInfo(
            id=self.id,
            name="Hoydedata DTM1",
            dataset="National 1 m digital terrain model",
            crs="EPSG:25833",
            licenseName="NLOD 2.0",
            licenseUrl=NLOD_URL,
            attribution=ATTRIBUTION,
            live=True,
        )

    async def resolve_tiles(self, area_wgs84: BaseGeometry) -> list[TileRef]:
        feed_text = await self._get_feed()
        root = ET.fromstring(feed_text)
        tiles: list[TileRef] = []

        for entry in root.findall("atom:entry", ATOM_NS):
            polygon_text = entry.findtext("georss:polygon", namespaces=ATOM_NS)
            link = self._geotiff_link(entry)
            if not polygon_text or link is None:
                continue

            polygon = _georss_polygon_to_shape(polygon_text)
            if not polygon.intersects(area_wgs84):
                continue

            title = entry.findtext("atom:title", default=Path(link).name, namespaces=ATOM_NS)
            crs = "EPSG:25833"
            category = entry.find("atom:category", ATOM_NS)
            if category is not None and category.attrib.get("label"):
                crs = "EPSG:25833" if "25833" in category.attrib.get("term", "") else category.attrib["label"]

            tiles.append(
                TileRef(
                    id=_tile_id(link),
                    title=title,
                    href=link,
                    polygon_wgs84=polygon,
                    crs=crs,
                    license_name="NLOD 2.0",
                    license_url=NLOD_URL,
                    attribution=ATTRIBUTION,
                )
            )

        return tiles

    async def download_tile(self, tile: TileRef) -> ResolvedTile:
        target = self.cache_dir / f"{tile.id}.tif"
        if not target.exists():
            async with httpx.AsyncClient(timeout=120) as client:
                response = await client.get(tile.href)
                response.raise_for_status()
                target.write_bytes(response.content)

        source = DataSource(
            id=f"source-{tile.id}",
            provider="Kartverket / Geonorge",
            dataset="Hoydedata DTM1",
            sourceUrl=tile.href,
            licenseName=tile.license_name,
            licenseUrl=tile.license_url,
            attribution=tile.attribution,
            resolutionMeters=1,
            crs="EPSG:25833",
            accuracyWarning=ACCURACY_WARNING,
        )
        return ResolvedTile(ref=tile, path=target, source=source)

    async def _get_feed(self) -> str:
        if self.feed_path.exists():
            return self.feed_path.read_text(encoding="utf-8")

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.get(DTM1_FEED_URL)
            response.raise_for_status()
            text = response.text
            self.feed_path.write_text(text, encoding="utf-8")
            return text

    @staticmethod
    def _geotiff_link(entry: ET.Element) -> str | None:
        for link in entry.findall("atom:link", ATOM_NS):
            if link.attrib.get("type") == "application/geotiff":
                return link.attrib.get("href")
        return None


def _georss_polygon_to_shape(text: str) -> Polygon:
    numbers = [float(value) for value in re.split(r"\s+", text.strip()) if value]
    pairs = list(zip(numbers[0::2], numbers[1::2], strict=False))
    # GeoRSS simple polygons are lat lon pairs. Shapely expects x y, so use lon lat.
    coordinates = [(lon, lat) for lat, lon in pairs]
    return Polygon(coordinates)


def _tile_id(url: str) -> str:
    stem = Path(url).stem
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:8]
    return f"{stem}-{digest}"
