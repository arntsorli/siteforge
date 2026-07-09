import { Layers, Map, Mountain, Satellite, ScanLine } from "lucide-react";
import { useState } from "react";

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

type SourceName = (typeof SOURCE_CARDS)[number]["name"];

export function DataLayerPanel({
  mapViewMode,
  layers,
  onMapViewModeChange,
  onLayerChange,
  onLoadFortenvegenData,
  onUseFlatFallback,
  hasGeneratedTerrain,
}: DataLayerPanelProps) {
  const [selectedSource, setSelectedSource] = useState<SourceName>("Height / DTM");
  const currentSource = SOURCE_CARDS.find((source) => source.name === selectedSource) ?? SOURCE_CARDS[1];
  const CurrentIcon = currentSource.icon;

  return (
    <section className="data-panel compact-data-panel" aria-label="Data and layer controls">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Configure layer</p>
          <h2>{currentSource.name}</h2>
        </div>
        <Layers size={22} />
      </div>

      <div className="source-tabs" aria-label="Choose data layer">
        {SOURCE_CARDS.map((source) => {
          const Icon = source.icon;
          return (
            <button
              key={source.name}
              type="button"
              className={selectedSource === source.name ? "active" : ""}
              onClick={() => setSelectedSource(source.name)}
              title={source.name}
            >
              <Icon size={18} />
            </button>
          );
        })}
      </div>

      <div className="selected-source-card">
        <CurrentIcon size={22} />
        <div>
          <strong>{currentSource.detail}</strong>
          <span>{currentSource.status}</span>
        </div>
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

      <div className="layer-toggle-grid data-layer-toggles">
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
          <Map size={18} /> Load preset
        </button>
        <button type="button" onClick={onUseFlatFallback} disabled={hasGeneratedTerrain}>
          <Satellite size={18} /> Use fallback
        </button>
      </div>
    </section>
  );
}
