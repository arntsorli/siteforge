import { Layers, Map, Mountain, Satellite, ScanLine } from "lucide-react";

export type MapViewMode = "map" | "satellite" | "overlay";

export interface LayerVisibility {
  terrain: boolean;
  imagery: boolean;
  surface: boolean;
  planning: boolean;
  grid: boolean;
}

interface DataLayerPanelProps {
  mapViewMode: MapViewMode;
  layers: LayerVisibility;
  onMapViewModeChange: (mode: MapViewMode) => void;
  onLayerChange: (layers: LayerVisibility) => void;
  onLoadFortenvegenData: () => void;
  onUseFlatFallback: () => void;
  hasGeneratedTerrain: boolean;
}

const SOURCE_CARDS = [
  {
    icon: Map,
    name: "Map",
    status: "Loaded",
    detail: "OpenStreetMap base context",
  },
  {
    icon: Mountain,
    name: "Height / DTM",
    status: "Ready",
    detail: "Høydedata DTM1 terrain request",
  },
  {
    icon: ScanLine,
    name: "LiDAR / surface",
    status: "Planned",
    detail: "Future DOM/point-cloud layer",
  },
  {
    icon: Satellite,
    name: "Satellite",
    status: "Fallback",
    detail: "Imagery overlay for flat terrain",
  },
];

export function DataLayerPanel({
  mapViewMode,
  layers,
  onMapViewModeChange,
  onLayerChange,
  onLoadFortenvegenData,
  onUseFlatFallback,
  hasGeneratedTerrain,
}: DataLayerPanelProps) {
  return (
    <section className="data-panel" aria-label="Data and layer controls">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Data views</p>
          <h2>Fortenvegen source layers</h2>
        </div>
        <Layers size={22} />
      </div>

      <div className="source-status-grid">
        {SOURCE_CARDS.map((source) => {
          const Icon = source.icon;
          return (
            <article key={source.name}>
              <Icon size={18} />
              <div>
                <strong>{source.name}</strong>
                <span>{source.detail}</span>
              </div>
              <mark>{source.status}</mark>
            </article>
          );
        })}
      </div>

      <div className="segmented-control" aria-label="Map view mode">
        {(["map", "satellite", "overlay"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={mapViewMode === mode ? "active" : ""}
            onClick={() => onMapViewModeChange(mode)}
          >
            {mode}
          </button>
        ))}
      </div>

      <div className="layer-toggle-grid">
        {Object.entries(layers).map(([key, value]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={value}
              onChange={(event) =>
                onLayerChange({ ...layers, [key]: event.currentTarget.checked })
              }
            />
            <span>{key}</span>
          </label>
        ))}
      </div>

      <div className="data-actions">
        <button type="button" onClick={onLoadFortenvegenData}>
          <Map size={18} /> Load Fortenvegen area
        </button>
        <button type="button" onClick={onUseFlatFallback} disabled={hasGeneratedTerrain}>
          <Satellite size={18} /> Flat imagery fallback
        </button>
      </div>
    </section>
  );
}

