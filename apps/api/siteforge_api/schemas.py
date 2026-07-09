from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import uuid4

from pydantic import BaseModel, Field, HttpUrl

Position = tuple[float, float]


class PolygonGeometry(BaseModel):
    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[Position]]


class BBoxGeometry(BaseModel):
    type: Literal["BBox"] = "BBox"
    west: float
    south: float
    east: float
    north: float


AreaGeometry = Annotated[PolygonGeometry | BBoxGeometry, Field(discriminator="type")]


class DataSource(BaseModel):
    id: str
    provider: str
    dataset: str
    sourceUrl: str
    licenseName: str
    licenseUrl: str
    attribution: str
    resolutionMeters: float | None = None
    capturedAt: str | None = None
    crs: str
    accuracyWarning: str


class TerrainLayer(BaseModel):
    id: str
    kind: Literal["dtm", "dsm", "imagery", "surface"]
    artifactUri: str
    metadataUri: str | None = None
    resolutionMeters: float
    bounds: tuple[float, float, float, float]
    verticalDatum: str | None = None
    sourceIds: list[str]
    visible: bool = True


class ArchitectureObject(BaseModel):
    id: str = Field(default_factory=lambda: f"object-{uuid4().hex[:10]}")
    type: Literal["building", "garage", "outbuilding", "driveway", "path", "cutFill"] = "building"
    name: str = "Planning volume"
    footprint: PolygonGeometry
    heightMeters: float = 4.0
    roofType: Literal["flat", "gable", "hip", "shed"] = "gable"
    roofPitchDegrees: float = 22.0
    materialColor: str = "#d7894a"
    terrainSnapMode: Literal["projected", "manual"] = "projected"


class ExportRecord(BaseModel):
    id: str
    format: Literal["glb", "json"]
    artifactUri: str
    generatedAt: str
    includedLayers: list[str]
    includedObjects: list[str]
    sourceMetadata: list[DataSource]


class LocalOrigin(BaseModel):
    east: float
    north: float
    elevation: float
    crs: str


class SiteForgeProject(BaseModel):
    id: str
    name: str
    createdAt: str
    updatedAt: str
    areaGeometry: AreaGeometry
    crs: str
    localOrigin: LocalOrigin
    layers: list[TerrainLayer]
    dataSources: list[DataSource]
    objects: list[ArchitectureObject] = Field(default_factory=list)
    exports: list[ExportRecord] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class TerrainJobRequest(BaseModel):
    name: str | None = None
    area: AreaGeometry
    providerId: str | None = None


class TerrainJobResponse(BaseModel):
    project: SiteForgeProject
    terrainGlbUrl: str
    metadataUrl: str


class ProviderInfo(BaseModel):
    id: str
    name: str
    dataset: str
    crs: str
    licenseName: str
    licenseUrl: HttpUrl | str
    attribution: str
    live: bool


class ProjectSaveRequest(BaseModel):
    project: SiteForgeProject


class ExportRequest(BaseModel):
    project: SiteForgeProject


def utc_now() -> str:
    return datetime.now(UTC).isoformat()

