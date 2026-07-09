from pathlib import Path

import trimesh

from siteforge_api.schemas import ExportRecord, SiteForgeProject, utc_now
from siteforge_api.settings import Settings


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
        if obj.type not in {"building", "garage", "outbuilding"}:
            continue
        box = trimesh.creation.box(extents=(10, obj.heightMeters, 8))
        box.visual.face_colors = _hex_to_rgba(obj.materialColor)
        box.apply_translation((0, obj.heightMeters / 2, 0))
        scene.add_geometry(box, node_name=obj.id)

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
    updated = project.model_copy(update={"exports": [*project.exports, record], "updatedAt": utc_now()})
    return save_project(updated, settings)


def _hex_to_rgba(value: str) -> tuple[int, int, int, int]:
    color = value.lstrip("#")
    if len(color) != 6:
        return (215, 137, 74, 255)
    return (int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16), 255)

