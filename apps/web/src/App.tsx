import type { ArchitectureObject, AreaGeometry, SiteForgeProject } from "@siteforge/shared";
import { Download, FileJson, Hammer, Home, Play, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import identityImage from "./assets/siteforge-terrain-identity.png";
import { MapSelector } from "./components/MapSelector";
import { ProjectDashboard } from "./components/ProjectDashboard";
import { SceneViewer } from "./components/SceneViewer";
import {
  DataLayerPanel,
  type LayerVisibility,
  type MapViewMode,
} from "./components/DataLayerPanel";
import { artifactUrl, createTerrainJob, exportGlb, saveProject } from "./lib/api";
import {
  captureScenePreview,
  createLocalProject,
  DEFAULT_OBJECT,
  deleteRecentProject,
  fallbackPreview,
  FORTENVEGEN_AREA,
  loadRecentProjects,
  locationLabel,
  OSLO_SAMPLE_AREA,
  saveRecentProject,
  type RecentProject,
} from "./lib/projects";

export default function App() {
  const [area, setArea] = useState<AreaGeometry>(FORTENVEGEN_AREA);
  const [project, setProject] = useState<SiteForgeProject | null>(null);
  const [object, setObject] = useState<ArchitectureObject>(DEFAULT_OBJECT);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>("overlay");
  const [layers, setLayers] = useState<LayerVisibility>({
    terrain: true,
    imagery: false,
    surface: false,
    planning: true,
    grid: true,
  });
  const [status, setStatus] = useState("Start blank, open a recent project, or focus Fortenvegen 100.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRecentProjects(loadRecentProjects());
  }, []);

  const terrainUrl = useMemo(
    () => artifactUrl(project?.layers.find((layer) => layer.kind === "dtm")?.artifactUri),
    [project],
  );

  function startBlankProject() {
    const nextProject = createLocalProject("Blank SiteForge project", OSLO_SAMPLE_AREA);
    setProject(nextProject);
    setArea(nextProject.areaGeometry);
    setObject(nextProject.objects[0] ?? DEFAULT_OBJECT);
    setStatus("Blank project opened with a basic terrain canvas.");
  }

  function startFortenvegenProject() {
    const nextProject = createLocalProject("Fortenvegen 100, Gran", FORTENVEGEN_AREA);
    setProject(nextProject);
    setArea(nextProject.areaGeometry);
    setObject(nextProject.objects[0] ?? DEFAULT_OBJECT);
    setMapViewMode("overlay");
    setStatus("Fortenvegen project opened. Load map/elevation data when ready.");
  }

  function loadFortenvegenData() {
    if (!project) {
      startFortenvegenProject();
    } else {
      setProject({
        ...project,
        name: project.name || "Fortenvegen 100, Gran",
        areaGeometry: FORTENVEGEN_AREA,
        updatedAt: new Date().toISOString(),
      });
      setArea(FORTENVEGEN_AREA);
    }
    setMapViewMode("overlay");
    setLayers({ terrain: true, imagery: true, surface: true, planning: true, grid: true });
    setStatus("Fortenvegen map, imagery fallback, DTM request, and future surface layer are staged.");
  }

  function useFlatFallback() {
    const workingProject = project ?? createLocalProject("Flat imagery fallback project", FORTENVEGEN_AREA);
    setProject(workingProject);
    setArea(workingProject.areaGeometry);
    setObject(workingProject.objects[0] ?? DEFAULT_OBJECT);
    setMapViewMode("satellite");
    setLayers({ terrain: false, imagery: true, surface: false, planning: true, grid: true });
    setStatus("Using flat terrain with imagery overlay fallback while elevation/LiDAR data is unavailable.");
  }

  function openProject(nextProject: SiteForgeProject) {
    setProject(nextProject);
    setArea(nextProject.areaGeometry);
    setObject(nextProject.objects[0] ?? DEFAULT_OBJECT);
    setStatus(`Opened ${nextProject.name}.`);
  }

  function renameProject(name: string) {
    if (!project) return;
    setProject({ ...project, name, updatedAt: new Date().toISOString() });
  }

  async function generateTerrain() {
    const workingProject = project ?? createLocalProject("Generated terrain project", area);
    if (!project) setProject(workingProject);
    setBusy(true);
    setStatus("Resolving Hoydedata DTM1 tiles and generating terrain...");
    try {
      const response = await createTerrainJob(area);
      const nextObject = response.project.objects[0] ?? object;
      setProject(response.project);
      setObject(nextObject);
      setStatus("Terrain generated. Review attribution and adjust the planning volume.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Terrain generation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!project) return;
    setBusy(true);
    try {
      const localProject = { ...project, areaGeometry: area, objects: [object], updatedAt: new Date().toISOString() };
      let saved = localProject;
      if (!project.id.startsWith("local-")) {
        saved = await saveProject(localProject);
      }
      const previewUri = captureScenePreview();
      setRecentProjects(
        saveRecentProject({
          project: saved,
          previewUri,
          locationLabel: locationLabel(saved.areaGeometry),
          savedAt: saved.updatedAt,
        }),
      );
      setProject(saved);
      setStatus("Project JSON saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    if (!project) return;
    setBusy(true);
    try {
      const exported = await exportGlb({ ...project, objects: [object] });
      setProject(exported);
      setStatus("GLB export generated with terrain and planning objects.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  function deleteRecent(projectId: string) {
    setRecentProjects(deleteRecentProject(projectId));
    if (project?.id === projectId) {
      setProject(null);
      setStatus("Removed the active project from recents.");
    }
  }

  function closeToDashboard() {
    setProject(null);
    setStatus("Back at the project dashboard.");
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <img src="/siteforge-icon.svg" alt="" />
          <div>
            <h1>SiteForge</h1>
            <p>Public elevation data to rough 3D planning scenes</p>
          </div>
        </div>
        <div className="header-actions">
          <button type="button" onClick={closeToDashboard}>
            <Home size={18} /> Projects
          </button>
          <button type="button" onClick={generateTerrain} disabled={busy}>
            <Play size={18} /> Generate terrain
          </button>
          <button type="button" onClick={handleSave} disabled={!project || busy}>
            <Save size={18} /> Save
          </button>
          <button type="button" onClick={handleExport} disabled={!project || busy}>
            <Download size={18} /> Export GLB
          </button>
        </div>
      </header>

      <section className="status-band">
        <div>
          <strong>Rough planning only</strong>
          <span>Not surveying, engineering documentation, or construction-ready geometry.</span>
        </div>
        <p>{status}</p>
      </section>

      <ProjectDashboard
        recentProjects={recentProjects}
        onBlankProject={startBlankProject}
        onFortenvegenProject={startFortenvegenProject}
        onOpenProject={openProject}
        onDeleteProject={deleteRecent}
      />

      <div className="workspace-grid">
        <div className="left-stack">
          <MapSelector
            selectedArea={area}
            mapViewMode={mapViewMode}
            onAreaChange={setArea}
            onFortenvegen={loadFortenvegenData}
          />
          <DataLayerPanel
            mapViewMode={mapViewMode}
            layers={layers}
            onMapViewModeChange={setMapViewMode}
            onLayerChange={setLayers}
            onLoadFortenvegenData={loadFortenvegenData}
            onUseFlatFallback={useFlatFallback}
            hasGeneratedTerrain={Boolean(terrainUrl)}
          />
          <section className="identity-panel">
            <img src={identityImage} alt="Stylized 3D terrain planning scene" />
            <div>
              <p className="eyebrow">Visual language</p>
              <h2>Terrain, surface, imagery, objects</h2>
              <p>
                The MVP keeps bare-earth DTM, future surface data, map texture, and user planning geometry as separate
                layers.
              </p>
            </div>
          </section>
        </div>

        <div className="right-stack">
          <SceneViewer terrainUrl={terrainUrl} object={object} layers={layers} onObjectChange={setObject} />
          <section className="project-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Project metadata</p>
                <h2>Attribution and export state</h2>
              </div>
              <FileJson size={22} />
            </div>
            <div className="metadata-grid">
              <div className="project-name-field">
                <span>Project</span>
                <input
                  value={project?.name ?? ""}
                  disabled={!project}
                  placeholder="No project opened"
                  onChange={(event) => renameProject(event.currentTarget.value)}
                />
              </div>
              <Info label="CRS" value={project?.crs ?? "EPSG:25833 target"} />
              <Info label="Layers" value={String(project?.layers.length ?? 0)} />
              <Info label="Exports" value={String(project?.exports.length ?? 0)} />
            </div>
            <div className="source-list">
              {(project?.dataSources ?? []).map((source) => (
                <article key={source.id}>
                  <strong>{source.dataset}</strong>
                  <span>{source.attribution}</span>
                  <a href={source.licenseUrl} target="_blank" rel="noreferrer">
                    {source.licenseName}
                  </a>
                </article>
              ))}
              {!project ? <p className="fineprint">Open a project, then save to create a recent card preview.</p> : null}
              {project && project.dataSources.length === 0 ? (
                <article>
                  <strong>Local starter</strong>
                  <span>Blank/default terrain placeholder</span>
                  <a href={fallbackPreview()} target="_blank" rel="noreferrer">
                    Preview
                  </a>
                </article>
              ) : null}
            </div>
            <div className="warning-row">
              <Hammer size={18} />
              <span>{project?.warnings[0] ?? "All generated output must carry the rough-planning warning."}</span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
