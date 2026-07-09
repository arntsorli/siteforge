from siteforge_api.schemas import AreaDataStatus, BBoxGeometry, DataSourceStatus
from siteforge_api.settings import Settings

FORTENVEGEN_AREA = BBoxGeometry(
    west=10.5006,
    south=60.3724,
    east=10.5054,
    north=60.3748,
)


def fortenvegen_data_status(settings: Settings) -> AreaDataStatus:
    dtm_cache_dir = settings.cache_dir / "hoydedata-dtm1"
    cached_tiles = sorted(dtm_cache_dir.glob("*.tif")) if dtm_cache_dir.exists() else []
    dtm_status = "cached" if cached_tiles else "live"

    return AreaDataStatus(
        id="fortenvegen-100-gran",
        label="Fortenvegen 100, 2750 Gran",
        area=FORTENVEGEN_AREA,
        sources=[
            DataSourceStatus(
                id="openstreetmap-base",
                kind="map",
                label="Map context",
                provider="OpenStreetMap",
                status="live",
                sourceUrl="https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                licenseName="Open Database License / tile usage policy",
                licenseUrl="https://www.openstreetmap.org/copyright",
                attribution="OpenStreetMap contributors",
                crs="EPSG:3857",
                note="Used only as a 2D context layer in the MVP.",
            ),
            DataSourceStatus(
                id="hoydedata-dtm1",
                kind="dtm",
                label="Bare-earth terrain",
                provider="Kartverket / Geonorge / Høydedata",
                status=dtm_status,
                sourceUrl="https://nedlasting.geonorge.no/geonorge/ATOM/hoydedata/datasett/DTM1.atom",
                licenseName="NLOD 2.0",
                licenseUrl="https://data.norge.no/nlod/no/2.0/",
                attribution="Kartverket / Geonorge / Høydedata DTM1",
                crs="EPSG:25833",
                resolutionMeters=1,
                note=(
                    f"{len(cached_tiles)} cached DTM tile(s) found."
                    if cached_tiles
                    else (
                        "Live DTM1 tile lookup/download is available through the terrain "
                        "job endpoint."
                    )
                ),
            ),
            DataSourceStatus(
                id="hoydedata-dom-lidar",
                kind="surface",
                label="Surface / LiDAR",
                provider="Kartverket / Geonorge / Høydedata",
                status="planned",
                sourceUrl="https://www.kartverket.no/api-og-data/terrengdata",
                licenseName="NLOD 2.0",
                licenseUrl="https://data.norge.no/nlod/no/2.0/",
                attribution="Kartverket / Geonorge / Høydedata",
                crs="EPSG:25833",
                note=(
                    "DOM/point-cloud surface extraction is planned after the DTM "
                    "terrain slice is stable."
                ),
            ),
            DataSourceStatus(
                id="flat-imagery-fallback",
                kind="imagery",
                label="Flat imagery fallback",
                provider="SiteForge",
                status="fallback",
                sourceUrl="app://siteforge/flat-imagery-fallback",
                licenseName="Generated fallback",
                licenseUrl="https://github.com/arntsorli/siteforge",
                attribution="SiteForge fallback layer",
                note=(
                    "Used when terrain or LiDAR data is unavailable; not a measured "
                    "elevation source."
                ),
            ),
        ],
        warnings=[
            (
                "Rough planning only; verify all dimensions and elevations before "
                "design or construction use."
            ),
            (
                "Fortenvegen preset is based on OpenStreetMap/Nominatim geocoding "
                "and should be checked."
            ),
        ],
    )
