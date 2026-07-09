import type { ArchitectureObject, AreaGeometry, SiteForgeProject } from "@siteforge/shared";

const STORAGE_KEY = "siteforge.recentProjects.v1";

export interface RecentProject {
  project: SiteForgeProject;
  previewUri: string;
  locationLabel: string;
  savedAt: string;
}

export const FORTENVEGEN_AREA: AreaGeometry = {
  type: "BBox",
  west: 10.5468,
  south: 60.3562,
  east: 10.5504,
  north: 60.3588,
};

export const OSLO_SAMPLE_AREA: AreaGeometry = {
  type: "BBox",
  west: 10.7522,
  south: 59.9135,
  east: 10.754,
  north: 59.9148,
};

export const DEFAULT_OBJECT: ArchitectureObject = {
  id: "object-initial-building",
  type: "building",
  name: "Rough building volume",
  footprint: {
    type: "Polygon",
    coordinates: [
      [
        [10.5478, 60.3569],
        [10.5484, 60.3569],
        [10.5484, 60.3574],
        [10.5478, 60.3574],
        [10.5478, 60.3569],
      ],
    ],
  },
  heightMeters: 4.5,
  roofType: "gable",
  roofPitchDegrees: 22,
  materialColor: "#d7894a",
  terrainSnapMode: "projected",
};

export function createLocalProject(
  name: string,
  area: AreaGeometry,
  objects: ArchitectureObject[] = [DEFAULT_OBJECT],
): SiteForgeProject {
  const now = new Date().toISOString();
  return {
    id: `local-${crypto.randomUUID()}`,
    name,
    createdAt: now,
    updatedAt: now,
    areaGeometry: area,
    crs: "EPSG:25833",
    localOrigin: {
      east: 0,
      north: 0,
      elevation: 0,
      crs: "EPSG:25833",
    },
    layers: [],
    dataSources: [],
    objects,
    exports: [],
    warnings: [
      "Rough planning only. SiteForge output is not surveying, engineering documentation, or construction-ready geometry.",
    ],
  };
}

export function loadRecentProjects(): RecentProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentProject[];
    return parsed.filter((entry) => entry.project?.id).slice(0, 12);
  } catch {
    return [];
  }
}

export function saveRecentProject(entry: RecentProject): RecentProject[] {
  const current = loadRecentProjects().filter((item) => item.project.id !== entry.project.id);
  const next = [entry, ...current].slice(0, 12);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteRecentProject(projectId: string): RecentProject[] {
  const next = loadRecentProjects().filter((item) => item.project.id !== projectId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function captureScenePreview(): string {
  const canvas = document.querySelector(".scene-canvas canvas") as HTMLCanvasElement | null;
  if (canvas) {
    try {
      return canvas.toDataURL("image/png", 0.85);
    } catch {
      return fallbackPreview();
    }
  }
  return fallbackPreview();
}

export function fallbackPreview(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <rect width="640" height="360" fill="#edf1e9"/>
    <path d="M40 250 170 138l108 62 82-96 240 146H40Z" fill="#6f8f5f"/>
    <path d="m40 278 138-64 118 42 304-84v58L300 315l-126-44-134 55Z" fill="#d7894a"/>
    <rect x="292" y="132" width="80" height="76" fill="#fbfaf4" opacity=".92"/>
    <path d="m292 132 40-34 40 34Z" fill="#9f5138"/>
    <path d="M64 302h512" stroke="#17211f" stroke-width="5" opacity=".45"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function locationLabel(area: AreaGeometry): string {
  if (area.type === "BBox") {
    const lon = (area.west + area.east) / 2;
    const lat = (area.south + area.north) / 2;
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }
  const first = area.coordinates[0]?.[0];
  return first ? `${first[1].toFixed(5)}, ${first[0].toFixed(5)}` : "Custom polygon";
}

