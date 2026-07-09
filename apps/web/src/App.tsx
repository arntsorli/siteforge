import type { ArchitectureObject, AreaGeometry, SiteForgeProject } from "@siteforge/shared";
import { Download, FileJson, Hammer, Play, Save } from "lucide-react";
import { useMemo, useState } from "react";
import identityImage from "./assets/siteforge-terrain-identity.png";
import { MapSelector } from "./components/MapSelector";
import { SceneViewer } from "./components/SceneViewer";
import { artifactUrl, createTerrainJob, exportGlb, saveProject } from "./lib/api";

const INITIAL_AREA: AreaGeometry = {
  type: "BBox",
  west: 10.7522,
  south: 59.9135,
  east: 10.754,
  north: 59.9148,
};

const INITIAL_OBJECT: ArchitectureObject = {
  id: "object-initial-building",
  type: "building",
  name: "Rough building volume",
  footprint: {
    type: "Polygon",
    coordinates: [
      [
        [10.7528, 59.9139],
        [10.7532, 59.9139],
        [10.7532, 59.9142],
        [10.7528, 59.9142],
        [10.7528, 59.9139],
      ],
    ],
  },
  heightMeters: 4.5,
  roofType: "gable",
  roofPitchDegrees: 22,
  materialColor: "#d7894a",
  terrainSnapMode: "projected",
};

export default function App() {
  const [area, setArea] = useState<AreaGeometry>(INITIAL_AREA);
  const [project, setProject] = useState<SiteForgeProject | null>(null);
  const [object, setObject] = useState<ArchitectureObject>(INITIAL_OBJECT);
  const [status, setStatus] = useState("Ready for a small Norway terrain selection.");
  const [busy, setBusy] = useState(false);

  const terrainUrl = useMemo(
    () => artifactUrl(project?.layers.find((layer) => layer.kind === "dtm")?.artifactUri),
    [project],
  );

  async function generateTerrain() {
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
      const saved = await saveProject({ ...project, objects: [object] });
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

      <div className="workspace-grid">
        <div className="left-stack">
          <MapSelector selectedArea={area} onAreaChange={setArea} />
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
          <SceneViewer terrainUrl={terrainUrl} object={object} onObjectChange={setObject} />
          <section className="project-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Project metadata</p>
                <h2>Attribution and export state</h2>
              </div>
              <FileJson size={22} />
            </div>
            <div className="metadata-grid">
              <Info label="Project" value={project?.name ?? "No generated project yet"} />
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
              {!project ? <p className="fineprint">Generate terrain to populate source metadata.</p> : null}
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

