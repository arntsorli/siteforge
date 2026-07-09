export type Position = [number, number];

export interface PolygonGeometry {
  type: "Polygon";
  coordinates: Position[][];
}

export interface BBoxGeometry {
  type: "BBox";
  west: number;
  south: number;
  east: number;
  north: number;
}

export type AreaGeometry = PolygonGeometry | BBoxGeometry;

export interface DataSource {
  id: string;
  provider: string;
  dataset: string;
  sourceUrl: string;
  licenseName: string;
  licenseUrl: string;
  attribution: string;
  resolutionMeters?: number;
  capturedAt?: string;
  crs: string;
  accuracyWarning: string;
}

export interface TerrainLayer {
  id: string;
  kind: "dtm" | "dsm" | "imagery" | "surface";
  artifactUri: string;
  metadataUri?: string;
  resolutionMeters: number;
  bounds: [number, number, number, number];
  verticalDatum?: string;
  sourceIds: string[];
  visible: boolean;
}

export interface ArchitectureObject {
  id: string;
  type:
    | "building"
    | "garage"
    | "outbuilding"
    | "box"
    | "slab"
    | "cylinder"
    | "driveway"
    | "path"
    | "cutFill";
  name: string;
  footprint: PolygonGeometry;
  heightMeters: number;
  roofType: "flat" | "gable" | "hip" | "shed";
  roofPitchDegrees: number;
  materialColor: string;
  terrainSnapMode: "projected" | "manual";
}

export interface ExportRecord {
  id: string;
  format: "glb" | "json";
  artifactUri: string;
  generatedAt: string;
  includedLayers: string[];
  includedObjects: string[];
  sourceMetadata: DataSource[];
}

export interface SiteForgeProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  areaGeometry: AreaGeometry;
  crs: string;
  localOrigin: {
    east: number;
    north: number;
    elevation: number;
    crs: string;
  };
  layers: TerrainLayer[];
  dataSources: DataSource[];
  objects: ArchitectureObject[];
  exports: ExportRecord[];
  warnings: string[];
}

export interface TerrainJobRequest {
  name?: string;
  area: AreaGeometry;
  providerId?: string;
}

export interface TerrainJobResponse {
  project: SiteForgeProject;
  terrainGlbUrl: string;
  metadataUrl: string;
}
