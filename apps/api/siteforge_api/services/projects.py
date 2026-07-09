
import math

import trimesh

from siteforge_api.schemas import (
    ArchitectureObject,
    AreaGeometry,
    ExportRecord,
    SiteForgeProject,
    utc_now,
)
from siteforge_api.settings import Settings

PLANNING_MESH_TYPES = {"building", "garage", "outbuilding", "box", "slab", "cylinder"}


def save_project(project: SiteForgeProject, settings: Settings) -> SiteForgeProject:
    now = utc_now()
    updated = project.model_copy(update={"updatedAt": now})
    project_dir = settings.projects_dir / updated.id
    project_dir.mkdir(parents=True, exist_ok=True)
    (project_dir / "project.json").write_text(updated.model_dump_json(indent=2), encoding="utf-8")
    return updated


def load_project(project_id: str, settings: Settings) -> SiteForgeProject:
    project_path = settings.projects_dir / project_id / "project.json"
    return SiteForgeProject.model_validate_json(project_path.read_text(encoding="utf-8"))


def export_project_glb(project: SiteForgeProject, settings: Settings) -> SiteForgeProject:
    project_dir = settings.projects_dir / project.id
    terrain_path = project_dir / "terrain.glb"
    export_path = project_dir / "siteforge-scene.glb"
    if terrain_path.exists():
        scene = trimesh.load(terrain_path, force="scene")
    else:
        scene = trimesh.Scene()

    for obj in project.objects:
        if obj.type not in PLANNING_MESH_TYPES:
            continue
        center_x, center_z, width, depth = _object_local_frame(obj, project.areaGeometry)
        height = max(0.2, obj.heightMeters)
        if obj.type == "cylinder":
            mesh = trimesh.creation.cylinder(
                radius=max(0.2, min(width, depth) / 2),
                height=height,
                sections=32,
            )
            mesh.apply_transform(
                trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0])
            )
        else:
            mesh = trimesh.creation.box(extents=(width, height, depth))
        mesh.visual.face_colors = _hex_to_rgba(obj.materialColor)
        mesh.apply_translation((center_x, height / 2, center_z))
        scene.add_geometry(mesh, node_name=obj.id)

    scene.export(export_path)
    record = ExportRecord(
        id=f"export-{utc_now()}",
        format="glb",
        artifactUri=f"/artifacts/{project.id}/siteforge-scene.glb",
        generatedAt=utc_now(),
        includedLayers=[layer.id for layer in project.layers],
        includedObjects=[obj.id for obj in project.objects],
        sourceMetadata=project.dataSources,
    )
    updated = project.model_copy(
        update={"exports": [*project.exports, record], "updatedAt": utc_now()}
    )
    return save_project(updated, settings)


def _hex_to_rgba(value: str) -> tuple[int, int, int, int]:
    color = value.lstrip("#")
    if len(color) != 6:
        return (215, 137, 74, 255)
    return (int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16), 255)


def _object_local_frame(
    obj: ArchitectureObject, area: AreaGeometry
) -> tuple[float, float, float, float]:
    ring = obj.footprint.coordinates[0] if obj.footprint.coordinates else []
    positions = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else ring
    if not positions:
        return (0, 0, 8, 6)
    local_points = [_position_to_local(position, area) for position in positions]
    xs = [point[0] for point in local_points]
    zs = [point[1] for point in local_points]
    return (
        sum(xs) / len(xs),
        sum(zs) / len(zs),
        max(0.5, max(xs) - min(xs)),
        max(0.5, max(zs) - min(zs)),
    )


def _position_to_local(position: tuple[float, float], area: AreaGeometry) -> tuple[float, float]:
    lon, lat = position
    center_lon, center_lat = _area_center(area)
    return (
        (lon - center_lon) * _meters_per_degree_lon(center_lat),
        (center_lat - lat) * 111_320,
    )


def _area_center(area: AreaGeometry) -> tuple[float, float]:
    if area.type == "BBox":
        return ((area.west + area.east) / 2, (area.south + area.north) / 2)
    ring = area.coordinates[0] if area.coordinates else []
    positions = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else ring
    if not positions:
        return (0, 0)
    lons = [position[0] for position in positions]
    lats = [position[1] for position in positions]
    return ((min(lons) + max(lons)) / 2, (min(lats) + max(lats)) / 2)


def _meters_per_degree_lon(lat: float) -> float:
    return max(1, 111_320 * math.cos(math.radians(lat)))
