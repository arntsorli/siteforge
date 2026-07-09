import type {
  AreaGeometry,
  SiteForgeProject,
  TerrainJobRequest,
  TerrainJobResponse,
} from "@siteforge/shared";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export function artifactUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}${path}`;
}

export async function createTerrainJob(area: AreaGeometry): Promise<TerrainJobResponse> {
  const body: TerrainJobRequest = {
    name: "SiteForge terrain scene",
    area,
    providerId: "hoydedata-dtm1",
  };
  const response = await fetch(`${API_BASE_URL}/terrain/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Terrain job failed with ${response.status}`);
  }
  return response.json();
}

export async function saveProject(project: SiteForgeProject): Promise<SiteForgeProject> {
  const response = await fetch(`${API_BASE_URL}/projects/${project.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function exportGlb(project: SiteForgeProject): Promise<SiteForgeProject> {
  const response = await fetch(`${API_BASE_URL}/exports/glb`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

