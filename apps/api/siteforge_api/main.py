from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from siteforge_api.providers import HoydedataDtm1Provider
from siteforge_api.schemas import (
    ExportRequest,
    ProjectSaveRequest,
    ProviderInfo,
    SiteForgeProject,
    TerrainJobRequest,
    TerrainJobResponse,
)
from siteforge_api.services.geometry import GeometryError
from siteforge_api.services.projects import export_project_glb, load_project, save_project
from siteforge_api.services.terrain import TerrainGenerationError, generate_terrain_project
from siteforge_api.settings import Settings, get_settings

app = FastAPI(title="SiteForge API", version="0.1.0")


@app.on_event("startup")
async def ensure_artifacts_mount() -> None:
    settings = get_settings()
    settings.projects_dir.mkdir(parents=True, exist_ok=True)


settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/artifacts", StaticFiles(directory=Path(settings.projects_dir)), name="artifacts")

SettingsDep = Annotated[Settings, Depends(get_settings)]


def get_provider(settings: SettingsDep) -> HoydedataDtm1Provider:
    return HoydedataDtm1Provider(settings)


ProviderDep = Annotated[HoydedataDtm1Provider, Depends(get_provider)]


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/providers", response_model=list[ProviderInfo])
async def providers(provider: ProviderDep) -> list[ProviderInfo]:
    return [provider.info()]


@app.post("/terrain/jobs", response_model=TerrainJobResponse)
async def create_terrain_job(
    request: TerrainJobRequest,
    provider: ProviderDep,
    settings: SettingsDep,
) -> TerrainJobResponse:
    try:
        return await generate_terrain_project(
            name=request.name,
            area=request.area,
            provider=provider,
            settings=settings,
        )
    except GeometryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except TerrainGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/projects/{project_id}", response_model=SiteForgeProject)
async def get_project(
    project_id: str,
    settings: SettingsDep,
) -> SiteForgeProject:
    try:
        return load_project(project_id, settings)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Project not found.") from exc


@app.post("/projects/{project_id}", response_model=SiteForgeProject)
async def put_project(
    project_id: str,
    request: ProjectSaveRequest,
    settings: SettingsDep,
) -> SiteForgeProject:
    if project_id != request.project.id:
        raise HTTPException(status_code=400, detail="Project id does not match request body.")
    return save_project(request.project, settings)


@app.post("/exports/glb", response_model=SiteForgeProject)
async def export_glb(
    request: ExportRequest,
    settings: SettingsDep,
) -> SiteForgeProject:
    return export_project_glb(request.project, settings)
