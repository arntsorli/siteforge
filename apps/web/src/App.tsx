import type { ArchitectureObject, AreaGeometry, SiteForgeProject } from "@siteforge/shared";
import { Box, Download, FileJson, Hammer, Home, Layers, Map, Play, Save, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import identityImage from "./assets/siteforge-terrain-identity.png";
import { MapSelector } from "./components/MapSelector";
import { ProjectDashboard } from "./components/ProjectDashboard";
import { SceneViewer } from "./components/SceneViewer";
import type { TerrainMode, TerrainSettings } from "./components/SceneViewer";
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

type AppView = "home" | "workspace";
type WorkflowStep = "terrain" | "planning" | "review" | "export";

export default function App() {
  const [area, setArea] = useState<AreaGeometry>(FORTENVEGEN_AREA);
  const [project, setProject] = useState<SiteForgeProject | null>(null);
  const [view, setView] = useState<AppView>("home");
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("terrain");
  const [object, setObject] = useState<ArchitectureObject>(DEFAULT_OBJECT);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>("overlay");
  const [terrainMode, setTerrainMode] = useState<TerrainMode>("default");
  const [terrainSettings, setTerrainSettings] = useState<TerrainSettings>({
    relief: 5,
    flatten: 0.15,
    ridge: 2,
  });
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
    setTerrainMode("default");
    setWorkflowStep("terrain");
    setView("workspace");
    setStatus("Blank project opened with a basic terrain canvas.");
  }

  function startFortenvegenProject() {
    const nextProject = createLocalProject("Fortenvegen 100, Gran", FORTENVEGEN_AREA);
    setProject(nextProject);
    setArea(nextProject.areaGeometry);
    setObject(nextProject.objects[0] ?? DEFAULT_OBJECT);
    setMapViewMode("overlay");
    setTerrainMode("default");
    setWorkflowStep("terrain");
    setView("workspace");
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
    setTerrainMode("flat");
    setLayers({ terrain: false, imagery: true, surface: false, planning: true, grid: true });
    setWorkflowStep("planning");
    setView("workspace");
    setStatus("Using flat terrain with imagery overlay fallback while elevation/LiDAR data is unavailable.");
  }

  function openProject(nextProject: SiteForgeProject) {
    setProject(nextProject);
    setArea(nextProject.areaGeometry);
    setObject(nextProject.objects[0] ?? DEFAULT_OBJECT);
    setWorkflowStep("terrain");
    setView("workspace");
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
      setTerrainMode("generated");
      setWorkflowStep("planning");
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
      setWorkflowStep("export");
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
    setView("home");
    setProject(null);
    setStatus("Back at the project dashboard.");
  }

  const projectName = project?.name ?? "No project opened";

  if (view === "home") {
    return (
      <main className="app-shell">
        <header className="app-header home-header">
          <div className="brand-lockup">
            <img src="/siteforge-icon.svg" alt="" />
            <div>
              <h1>SiteForge</h1>
              <p>Public elevation data to rough 3D planning scenes</p>
            </div>
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
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <img src="/siteforge-icon.svg" alt="" />
          <div>
            <h1>SiteForge</h1>
            <p>{projectName}</p>
          </div>
        </div>
        <WorkflowTabs activeStep={workflowStep} onStepChange={setWorkflowStep} />
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

      {workflowStep === "terrain" ? (
        <div className="workflow-shell">
          <aside className="edge-panel left-edge">
            <SiteContextPanel project={project} area={area} onProjectNameChange={renameProject} />
            <IdentityPanel />
          </aside>
          <main className="workflow-main">
            <MapSelector
              selectedArea={area}
              mapViewMode={mapViewMode}
              onAreaChange={setArea}
              onFortenvegen={loadFortenvegenData}
            />
          </main>
          <aside className="edge-panel right-edge">
            <DataLayerPanel
              mapViewMode={mapViewMode}
              layers={layers}
              onMapViewModeChange={setMapViewMode}
              onLayerChange={setLayers}
              onLoadFortenvegenData={loadFortenvegenData}
              onUseFlatFallback={useFlatFallback}
              hasGeneratedTerrain={Boolean(terrainUrl)}
            />
          </aside>
        </div>
      ) : null}

      {workflowStep === "planning" ? (
        <div className="workflow-shell planning-workflow">
          <aside className="edge-panel left-edge">
            <SiteContextPanel project={project} area={area} onProjectNameChange={renameProject} />
            <LayerQuickToggles layers={layers} onLayerChange={setLayers} />
          </aside>
          <main className="workflow-main">
            <SceneViewer
              terrainUrl={terrainUrl}
              object={object}
              layers={layers}
              terrainMode={terrainMode}
              terrainSettings={terrainSettings}
              onObjectChange={setObject}
              onTerrainModeChange={setTerrainMode}
              onTerrainSettingsChange={setTerrainSettings}
            />
          </main>
          <aside className="edge-panel right-edge">
            <section className="project-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Workflow</p>
                  <h2>Planning focus</h2>
                </div>
                <Box size={22} />
              </div>
              <p className="fineprint">
                Keep layer visibility here, but change sources and map overlays in Terrain / Data. Review attribution and
                warnings before export.
              </p>
            </section>
          </aside>
        </div>
      ) : null}

      {workflowStep === "review" ? (
        <div className="workflow-shell review-workflow">
          <aside className="edge-panel left-edge">
            <SiteContextPanel project={project} area={area} onProjectNameChange={renameProject} />
          </aside>
          <main className="workflow-main">
            <ProjectMetadataPanel project={project} large />
          </main>
          <aside className="edge-panel right-edge">
            <LayerQuickToggles layers={layers} onLayerChange={setLayers} />
          </aside>
        </div>
      ) : null}

      {workflowStep === "export" ? (
        <div className="workflow-shell export-workflow">
          <aside className="edge-panel left-edge">
            <LayerQuickToggles layers={layers} onLayerChange={setLayers} />
            <ProjectMetadataPanel project={project} />
          </aside>
          <main className="workflow-main">
            <ExportPanel project={project} busy={busy} onSave={handleSave} onExport={handleExport} />
          </main>
          <aside className="edge-panel right-edge">
            <IdentityPanel />
          </aside>
        </div>
      ) : null}
    </main>
  );
}

function WorkflowTabs({
  activeStep,
  onStepChange,
}: {
  activeStep: WorkflowStep;
  onStepChange: (step: WorkflowStep) => void;
}) {
  const steps: Array<{ id: WorkflowStep; label: string; icon: typeof Map }> = [
    { id: "terrain", label: "Terrain / Data", icon: Map },
    { id: "planning", label: "3D Planning", icon: Box },
    { id: "review", label: "Review", icon: FileJson },
    { id: "export", label: "Export", icon: Upload },
  ];
  return (
    <nav className="workflow-tabs" aria-label="Project workflow">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <button
            key={step.id}
            type="button"
            className={activeStep === step.id ? "active" : ""}
            onClick={() => onStepChange(step.id)}
          >
            <span>{index + 1}</span>
            <Icon size={17} />
            {step.label}
          </button>
        );
      })}
    </nav>
  );
}

function SiteContextPanel({
  project,
  area,
  onProjectNameChange,
}: {
  project: SiteForgeProject | null;
  area: AreaGeometry;
  onProjectNameChange: (name: string) => void;
}) {
  return (
    <section className="project-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Project</p>
          <h2>Site setup</h2>
        </div>
        <FileJson size={22} />
      </div>
      <div className="project-name-field compact">
        <span>Name</span>
        <input
          value={project?.name ?? ""}
          disabled={!project}
          placeholder="No project opened"
          onChange={(event) => onProjectNameChange(event.currentTarget.value)}
        />
      </div>
      <div className="metadata-grid single-column">
        <Info label="Area" value={locationLabel(area)} />
        <Info label="CRS target" value={project?.crs ?? "EPSG:25833"} />
        <Info label="Objects" value={String(project?.objects.length ?? 0)} />
      </div>
    </section>
  );
}

function IdentityPanel() {
  return (
    <section className="identity-panel">
      <img src={identityImage} alt="Stylized 3D terrain planning scene" />
      <div>
        <p className="eyebrow">Visual language</p>
        <h2>Terrain, surface, imagery, objects</h2>
        <p>
          Bare-earth DTM, future surface data, map texture, and user planning geometry stay separate from day one.
        </p>
      </div>
    </section>
  );
}

function LayerQuickToggles({
  layers,
  onLayerChange,
}: {
  layers: LayerVisibility;
  onLayerChange: (layers: LayerVisibility) => void;
}) {
  return (
    <section className="project-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Visible layers</p>
          <h2>3D quick toggles</h2>
        </div>
        <Layers size={22} />
      </div>
      <div className="layer-toggle-grid compact-layers">
        {Object.entries(layers).map(([key, value]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={value}
              onChange={(event) => onLayerChange({ ...layers, [key]: event.currentTarget.checked })}
            />
            <span>{key}</span>
          </label>
        ))}
      </div>
      <p className="fineprint">Add or change source data in the Terrain / Data workflow step.</p>
    </section>
  );
}

function ProjectMetadataPanel({ project, large = false }: { project: SiteForgeProject | null; large?: boolean }) {
  return (
    <section className={large ? "project-panel review-panel" : "project-panel"}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Metadata</p>
          <h2>Attribution and export state</h2>
        </div>
        <FileJson size={22} />
      </div>
      <div className="metadata-grid single-column">
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
  );
}

function ExportPanel({
  project,
  busy,
  onSave,
  onExport,
}: {
  project: SiteForgeProject | null;
  busy: boolean;
  onSave: () => void;
  onExport: () => void;
}) {
  return (
    <section className="export-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Final step</p>
          <h2>Save project and export GLB</h2>
        </div>
        <Download size={24} />
      </div>
      <div className="export-actions">
        <button type="button" onClick={onSave} disabled={!project || busy}>
          <Save size={18} /> Save project JSON
        </button>
        <button type="button" onClick={onExport} disabled={!project || busy}>
          <Download size={18} /> Export GLB
        </button>
      </div>
      <div className="export-summary">
        <Info label="Project" value={project?.name ?? "No project opened"} />
        <Info label="Included objects" value={String(project?.objects.length ?? 0)} />
        <Info label="Generated exports" value={String(project?.exports.length ?? 0)} />
      </div>
      <p className="fineprint">
        GLB exports include rough planning geometry and source metadata sidecars. Future export paths can add OBJ, DXF,
        IFC, Blender, and SketchUp workflows.
      </p>
    </section>
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
