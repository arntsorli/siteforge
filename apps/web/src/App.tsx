import type { ArchitectureObject, AreaGeometry, ExportRecord, SiteForgeProject } from "@siteforge/shared";
import { Box, Download, FileJson, Home, Map, Play, Save, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  loadRecentProjects,
  locationLabel,
  NORWAY_DEMO_AREA,
  saveRecentProject,
  type RecentProject,
} from "./lib/projects";

type AppView = "home" | "workspace";
type WorkflowStep = "terrain" | "planning" | "review" | "export";

export default function App() {
  const [area, setArea] = useState<AreaGeometry>(NORWAY_DEMO_AREA);
  const [project, setProject] = useState<SiteForgeProject | null>(null);
  const [view, setView] = useState<AppView>("home");
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("terrain");
  const [objects, setObjects] = useState<ArchitectureObject[]>([DEFAULT_OBJECT]);
  const [selectedObjectId, setSelectedObjectId] = useState(DEFAULT_OBJECT.id);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>("overlay");
  const [terrainMode, setTerrainMode] = useState<TerrainMode>("custom");
  const [terrainSettings, setTerrainSettings] = useState<TerrainSettings>({
    relief: 5,
    flatten: 0.15,
    ridge: 2,
  });
  const [lidarFileName, setLidarFileName] = useState("");
  const [layers, setLayers] = useState<LayerVisibility>({
    terrain: true,
    imagery: false,
    surface: false,
    planning: true,
    grid: true,
  });
  const [status, setStatus] = useState("Choose a project to begin.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRecentProjects(loadRecentProjects());
  }, []);

  const terrainUrl = useMemo(
    () => artifactUrl(project?.layers.find((layer) => layer.kind === "dtm")?.artifactUri),
    [project],
  );

  function startBlankProject() {
    const nextProject = createLocalProject("Blank SiteForge project", NORWAY_DEMO_AREA);
    setProject(nextProject);
    setArea(nextProject.areaGeometry);
    setObjects(nextProject.objects.length ? nextProject.objects : [DEFAULT_OBJECT]);
    setSelectedObjectId((nextProject.objects[0] ?? DEFAULT_OBJECT).id);
    setTerrainMode("custom");
    setWorkflowStep("terrain");
    setView("workspace");
    setStatus("Blank project opened with a basic terrain canvas.");
  }

  function startDemoProject() {
    const nextProject = createLocalProject("Norway demo site", NORWAY_DEMO_AREA);
    setProject(nextProject);
    setArea(nextProject.areaGeometry);
    setObjects(nextProject.objects.length ? nextProject.objects : [DEFAULT_OBJECT]);
    setSelectedObjectId((nextProject.objects[0] ?? DEFAULT_OBJECT).id);
    setMapViewMode("overlay");
    setTerrainMode("custom");
    setWorkflowStep("terrain");
    setView("workspace");
    setStatus("Demo project opened. Load map/elevation data when ready.");
  }

  function loadDemoData() {
    if (!project) {
      startDemoProject();
    } else {
      setProject({
        ...project,
        name: project.name || "Norway demo site",
        areaGeometry: NORWAY_DEMO_AREA,
        updatedAt: new Date().toISOString(),
      });
      setArea(NORWAY_DEMO_AREA);
    }
    setMapViewMode("overlay");
    setLayers({ terrain: true, imagery: true, surface: true, planning: true, grid: true });
    setStatus("Demo map, imagery fallback, DTM request, and future surface layer are staged.");
  }

  function useFlatFallback() {
    const workingProject = project ?? createLocalProject("Flat imagery fallback project", NORWAY_DEMO_AREA);
    setProject(workingProject);
    setArea(workingProject.areaGeometry);
    setObjects(workingProject.objects.length ? workingProject.objects : [DEFAULT_OBJECT]);
    setSelectedObjectId((workingProject.objects[0] ?? DEFAULT_OBJECT).id);
    setMapViewMode("satellite");
    setTerrainMode("custom");
    setLayers({ terrain: true, imagery: true, surface: false, planning: true, grid: true });
    setWorkflowStep("planning");
    setView("workspace");
    setStatus("Using flat terrain with imagery overlay fallback while elevation/LiDAR data is unavailable.");
  }

  function stageLidarFile(file: File | null) {
    if (!file) {
      setLidarFileName("");
      setStatus("Cleared the staged LiDAR/surface input.");
      return;
    }
    setLidarFileName(file.name);
    setLayers({ ...layers, surface: true });
    setStatus(`${file.name} staged as LiDAR/surface input. Surface preview is enabled while meshing is being wired.`);
  }

  function openProject(nextProject: SiteForgeProject) {
    setProject(nextProject);
    setArea(nextProject.areaGeometry);
    setObjects(nextProject.objects.length ? nextProject.objects : [DEFAULT_OBJECT]);
    setSelectedObjectId((nextProject.objects[0] ?? DEFAULT_OBJECT).id);
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
      const nextObjects = response.project.objects.length ? response.project.objects : objects;
      setProject(response.project);
      setObjects(nextObjects);
      setSelectedObjectId((nextObjects[0] ?? DEFAULT_OBJECT).id);
      setTerrainMode("generated");
      setWorkflowStep("planning");
      setStatus("Terrain generated. Review attribution and adjust the planning volume.");
    } catch (error) {
      setTerrainMode("custom");
      setLayers({ terrain: true, imagery: true, surface: false, planning: true, grid: true });
      setWorkflowStep("planning");
      const technicalMessage = error instanceof Error ? error.message : "";
      const friendlyMessage = /failed to fetch|abort/i.test(technicalMessage)
        ? "Live terrain service unavailable."
        : technicalMessage || "Terrain generation failed.";
      setStatus(
        `${friendlyMessage} Continuing with editable custom terrain.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!project) return;
    setBusy(true);
    try {
      const localProject = { ...project, areaGeometry: area, objects, updatedAt: new Date().toISOString() };
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
      const exported = await exportGlb({ ...project, objects });
      setProject(exported);
      setWorkflowStep("export");
      setStatus("GLB export generated with terrain and planning objects.");
    } catch (error) {
      const now = new Date().toISOString();
      const localJsonExport: ExportRecord = {
        id: `export-local-${crypto.randomUUID()}`,
        format: "json",
        artifactUri: "browser-local://project.json",
        generatedAt: now,
        includedLayers: project.layers.map((layer) => layer.id),
        includedObjects: objects.map((item) => item.id),
        sourceMetadata: project.dataSources,
      };
      const localProject = {
        ...project,
        objects,
        exports: [...project.exports, localJsonExport],
        updatedAt: now,
      };
      setProject(localProject);
      setRecentProjects(
        saveRecentProject({
          project: localProject,
          previewUri: captureScenePreview(),
          locationLabel: locationLabel(localProject.areaGeometry),
          savedAt: now,
        }),
      );
      const technicalMessage = error instanceof Error ? error.message : "";
      const friendlyMessage = /failed to fetch|abort/i.test(technicalMessage)
        ? "Backend GLB export unavailable."
        : technicalMessage || "GLB export failed.";
      setStatus(
        `${friendlyMessage} Saved a local project JSON export record instead.`,
      );
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
      <main className="home-shell">
        <header className="home-page-header">
          <div className="home-brand">
            <img src="/siteforge-icon.svg" alt="" />
            <div>
              <h1>SiteForge</h1>
              <p>Terrain data to rough 3D planning scenes</p>
            </div>
          </div>
          <span>Local MVP</span>
        </header>

        <div className="home-projects-wrap">
          <ProjectDashboard
            recentProjects={recentProjects}
            onBlankProject={startBlankProject}
            onDemoProject={startDemoProject}
            onOpenProject={openProject}
            onDeleteProject={deleteRecent}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="workspace-app">
      <header className="workspace-topbar">
        <button type="button" className="home-nav-button" onClick={closeToDashboard} title="Back to projects">
          <img src="/siteforge-icon.svg" alt="" />
          <Home size={16} />
        </button>
        <div className="workspace-title">
          <strong>{projectName}</strong>
          <span>{status}</span>
        </div>
        <WorkflowTabs activeStep={workflowStep} onStepChange={setWorkflowStep} />
        <div className="workspace-actions">
          <button type="button" onClick={generateTerrain} disabled={busy} title="Generate terrain from data">
            <Play size={18} /> Generate terrain
          </button>
          <button type="button" onClick={handleSave} disabled={!project || busy} title="Save project">
            <Save size={18} /> Save
          </button>
          <button type="button" onClick={() => setWorkflowStep("export")} disabled={!project || busy} title="Go to export">
            <Download size={18} /> Export
          </button>
        </div>
      </header>

      {workflowStep === "terrain" ? (
        <section className="terrain-data-workspace">
          <main className="large-preview-surface">
            <MapSelector
              selectedArea={area}
              mapViewMode={mapViewMode}
              onAreaChange={setArea}
              onDemoArea={loadDemoData}
            />
          </main>
          <aside className="layer-config-rail">
            <SiteContextPanel
              project={project}
              area={area}
              objectCount={objects.length}
              onProjectNameChange={renameProject}
            />
            <DataLayerPanel
              mapViewMode={mapViewMode}
              layers={layers}
              lidarFileName={lidarFileName}
              onMapViewModeChange={setMapViewMode}
              onLayerChange={setLayers}
              onLidarFileChange={stageLidarFile}
              onLoadDemoData={loadDemoData}
              onUseFlatFallback={useFlatFallback}
              hasGeneratedTerrain={Boolean(terrainUrl)}
            />
            <button type="button" className="primary-next-button" onClick={() => setWorkflowStep("planning")}>
              Continue to 3D <Box size={17} />
            </button>
          </aside>
        </section>
      ) : null}

      {workflowStep === "planning" ? (
        <section className="canvas-workspace">
          <main className="full-scene-surface">
            <SceneViewer
              area={area}
              terrainUrl={terrainUrl}
              objects={objects}
              selectedObjectId={selectedObjectId}
              layers={layers}
              terrainMode={terrainMode}
              terrainSettings={terrainSettings}
              onObjectsChange={setObjects}
              onSelectedObjectChange={setSelectedObjectId}
              onTerrainModeChange={setTerrainMode}
              onTerrainSettingsChange={setTerrainSettings}
              onLayerChange={setLayers}
            />
          </main>
        </section>
      ) : null}

      {workflowStep === "review" ? (
        <section className="review-workspace">
          <aside className="review-side">
            <SiteContextPanel
              project={project}
              area={area}
              objectCount={objects.length}
              onProjectNameChange={renameProject}
            />
          </aside>
          <main className="review-main">
            <ProjectMetadataPanel project={project} objectCount={objects.length} large />
          </main>
        </section>
      ) : null}

      {workflowStep === "export" ? (
        <section className="export-workspace">
          <main className="export-main">
            <ExportPanel project={project} objectCount={objects.length} busy={busy} onSave={handleSave} onExport={handleExport} />
          </main>
        </section>
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
  objectCount,
  onProjectNameChange,
}: {
  project: SiteForgeProject | null;
  area: AreaGeometry;
  objectCount: number;
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
        <Info label="Objects" value={String(objectCount)} />
      </div>
    </section>
  );
}

function ProjectMetadataPanel({
  project,
  objectCount,
  large = false,
}: {
  project: SiteForgeProject | null;
  objectCount: number;
  large?: boolean;
}) {
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
        <Info label="Objects" value={String(objectCount)} />
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
            <span>Browser-local custom terrain placeholder</span>
            <a href={fallbackPreview()} target="_blank" rel="noreferrer">
              Preview
            </a>
          </article>
        ) : null}
      </div>
    </section>
  );
}

function ExportPanel({
  project,
  objectCount,
  busy,
  onSave,
  onExport,
}: {
  project: SiteForgeProject | null;
  objectCount: number;
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
        <Info label="Included objects" value={String(objectCount)} />
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
