from pathlib import Path
from uuid import uuid4
from contextlib import contextmanager

import numpy as np
import rasterio
from rasterio.io import MemoryFile
from rasterio.mask import mask
from rasterio.merge import merge
from shapely.geometry import mapping

from siteforge_api.providers.base import TerrainProvider
from siteforge_api.schemas import (
    AreaGeometry,
    ArchitectureObject,
    DataSource,
    ExportRecord,
    LocalOrigin,
    PolygonGeometry,
    SiteForgeProject,
    TerrainJobResponse,
    TerrainLayer,
    utc_now,
)
from siteforge_api.services.geometry import (
    NORWAY_PROJECTED,
    WGS84,
    area_to_shape,
    bbox_tuple,
    coordinates_from_bounds,
    reproject_shape,
    validate_area_size,
)
from siteforge_api.services.mesh import synthetic_terrain_to_glb, terrain_array_to_glb
from siteforge_api.settings import Settings

ROUGH_WARNING = (
    "Rough planning only. SiteForge output is not surveying, engineering documentation, "
    "or construction-ready geometry."
)


class TerrainGenerationError(RuntimeError):
    pass


async def generate_terrain_project(
    *,
    name: str | None,
    area: AreaGeometry,
    provider: TerrainProvider,
    settings: Settings,
) -> TerrainJobResponse:
    project_id = f"project-{uuid4().hex[:10]}"
    project_dir = settings.projects_dir / project_id
    project_dir.mkdir(parents=True, exist_ok=True)

    shape_wgs84 = area_to_shape(area)
    validate_area_size(shape_wgs84, settings.max_area_sq_m)

    terrain_path = project_dir / "terrain.glb"
    metadata_path = project_dir / "terrain.metadata.json"
    project_path = project_dir / "project.json"

    data_sources: list[DataSource]
    bounds_wgs84 = bbox_tuple(shape_wgs84)
    warnings = [ROUGH_WARNING]

    try:
        mesh_result, data_sources = await _generate_from_provider(
            provider=provider,
            shape_wgs84=shape_wgs84,
            output_path=terrain_path,
            settings=settings,
        )
    except Exception as exc:
        if not settings.allow_synthetic_fallback:
            raise TerrainGenerationError(str(exc)) from exc
        mesh_result = synthetic_terrain_to_glb(terrain_path, settings.max_mesh_vertices)
        data_sources = [
            DataSource(
                id="source-synthetic-fallback",
                provider="SiteForge",
                dataset="Synthetic fallback terrain",
                sourceUrl="data:sitforge-synthetic-fallback",
                licenseName="Generated sample",
                licenseUrl="https://github.com/arntsorli/siteforge",
                attribution="SiteForge synthetic fallback terrain",
                resolutionMeters=mesh_result.resolution_meters,
                crs=NORWAY_PROJECTED,
                accuracyWarning=(
                    "Live terrain generation failed, so this scene uses synthetic fallback terrain. "
                    f"Original error: {exc}"
                ),
            )
        ]
        warnings.append(data_sources[0].accuracyWarning)

    terrain_layer = TerrainLayer(
        id="layer-dtm",
        kind="dtm",
        artifactUri=f"/artifacts/{project_id}/terrain.glb",
        metadataUri=f"/artifacts/{project_id}/terrain.metadata.json",
        resolutionMeters=mesh_result.resolution_meters,
        bounds=bounds_wgs84,
        verticalDatum="Source provider vertical datum",
        sourceIds=[source.id for source in data_sources],
        visible=True,
    )

    now = utc_now()
    project = SiteForgeProject(
        id=project_id,
        name=name or "Untitled SiteForge scene",
        createdAt=now,
        updatedAt=now,
        areaGeometry=area,
        crs=NORWAY_PROJECTED,
        localOrigin=LocalOrigin(
            east=mesh_result.origin_east,
            north=mesh_result.origin_north,
            elevation=mesh_result.origin_elevation,
            crs=NORWAY_PROJECTED,
        ),
        layers=[terrain_layer],
        dataSources=data_sources,
        objects=[_default_building(bounds_wgs84)],
        exports=[
            ExportRecord(
                id="export-terrain-glb",
                format="glb",
                artifactUri=f"/artifacts/{project_id}/terrain.glb",
                generatedAt=now,
                includedLayers=["layer-dtm"],
                includedObjects=[],
                sourceMetadata=data_sources,
            )
        ],
        warnings=warnings,
    )

    metadata = {
        "projectId": project.id,
        "mesh": mesh_result.__dict__,
        "sources": [source.model_dump() for source in data_sources],
        "warnings": warnings,
    }
    metadata_path.write_text(_json(metadata), encoding="utf-8")
    project_path.write_text(project.model_dump_json(indent=2), encoding="utf-8")

    return TerrainJobResponse(
        project=project,
        terrainGlbUrl=f"/artifacts/{project_id}/terrain.glb",
        metadataUrl=f"/artifacts/{project_id}/terrain.metadata.json",
    )


async def _generate_from_provider(
    *,
    provider: TerrainProvider,
    shape_wgs84,
    output_path: Path,
    settings: Settings,
):
    tiles = await provider.resolve_tiles(shape_wgs84)
    if not tiles:
        raise TerrainGenerationError("No DTM1 tiles intersect the selected area.")
    if len(tiles) > settings.max_provider_tiles:
        raise TerrainGenerationError(
            f"Selected area intersects {len(tiles)} source tiles; MVP limit is "
            f"{settings.max_provider_tiles}. Try a smaller area."
        )

    resolved = [await provider.download_tile(tile) for tile in tiles]
    raster_paths = [tile.path for tile in resolved]
    data_sources = [tile.source for tile in resolved]
    shape_projected = reproject_shape(shape_wgs84, WGS84, NORWAY_PROJECTED)

    with _open_mosaic(raster_paths) as dataset:
        clipped, clipped_transform = mask(
            dataset,
            [mapping(shape_projected)],
            crop=True,
            filled=True,
            nodata=np.nan,
        )

    mesh_result = terrain_array_to_glb(
        clipped[0],
        clipped_transform,
        output_path,
        settings.max_mesh_vertices,
    )
    return mesh_result, data_sources


@contextmanager
def _open_mosaic(paths: list[Path]):
    datasets = [rasterio.open(path) for path in paths]
    memfile: MemoryFile | None = None
    try:
        mosaic, transform = merge(datasets)
        profile = datasets[0].profile.copy()
        if not np.issubdtype(mosaic.dtype, np.floating):
            mosaic = mosaic.astype("float32")
        profile.update(
            driver="GTiff",
            height=mosaic.shape[1],
            width=mosaic.shape[2],
            transform=transform,
            count=mosaic.shape[0],
            dtype=str(mosaic.dtype),
            nodata=np.nan,
        )
        memfile = MemoryFile()
        with memfile.open(**profile) as dataset:
            dataset.write(mosaic)
        with memfile.open() as dataset:
            yield dataset
    finally:
        for dataset in datasets:
            dataset.close()
        if memfile is not None:
            memfile.close()


def _default_building(bounds: tuple[float, float, float, float]) -> ArchitectureObject:
    west, south, east, north = bounds
    cx = (west + east) / 2
    cy = (south + north) / 2
    width = min((east - west) * 0.18, 0.00025)
    depth = min((north - south) * 0.16, 0.00018)
    coords = [
        (cx - width, cy - depth),
        (cx + width, cy - depth),
        (cx + width, cy + depth),
        (cx - width, cy + depth),
        (cx - width, cy - depth),
    ]
    return ArchitectureObject(
        name="Rough building volume",
        footprint=PolygonGeometry(coordinates=[coords]),
    )


def _json(value: dict) -> str:
    import json

    return json.dumps(value, indent=2)
