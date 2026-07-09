import { Eye, Layers, Map, Mountain, Satellite, ScanLine } from "lucide-react";

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
    <section className="data-panel compact-data-panel" aria-label="Data and layer controls">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Terrain / data</p>
          <h2>Build the base canvas</h2>
        </div>
        <Layers size={22} />
      </div>

      <section className="data-config-section">
        <div className="data-section-title">
          <Map size={18} />
          <strong>Preview map</strong>
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
      </section>

      <section className="data-config-section">
        <div className="data-section-title">
          <Mountain size={18} />
          <strong>Height data</strong>
        </div>
        <p className="fineprint no-margin">Use Høydedata DTM when available, or continue with editable custom terrain.</p>
        <div className="data-actions">
          <button type="button" onClick={onLoadFortenvegenData}>
            <Map size={18} /> Fortenvegen preset
          </button>
          <button type="button" onClick={onUseFlatFallback} disabled={hasGeneratedTerrain}>
            <Mountain size={18} /> Custom fallback
          </button>
        </div>
      </section>

      <section className="data-config-section">
        <div className="data-section-title">
          <Satellite size={18} />
          <strong>Satellite drape</strong>
        </div>
        <label className="switch-row">
          <span>Use satellite imagery as terrain mask</span>
          <input
            type="checkbox"
            checked={layers.imagery}
            onChange={(event) => onLayerChange({ ...layers, imagery: event.currentTarget.checked })}
          />
        </label>
        <p className="fineprint no-margin">The 3D canvas will drape the imagery layer over custom terrain.</p>
      </section>

      <section className="data-config-section">
        <div className="data-section-title">
          <Eye size={18} />
          <strong>3D layers</strong>
        </div>
        <div className="layer-toggle-grid data-layer-toggles">
          {(["terrain", "surface", "planning", "grid"] as const).map((key) => (
            <label key={key}>
              <span>{key}</span>
              <input
                type="checkbox"
                checked={layers[key]}
                onChange={(event) => onLayerChange({ ...layers, [key]: event.currentTarget.checked })}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="data-config-section muted-section">
        <div className="data-section-title">
          <ScanLine size={18} />
          <strong>LiDAR / surface</strong>
        </div>
        <p className="fineprint no-margin">Surface/LiDAR is still a placeholder layer until the provider pipeline matures.</p>
      </section>
    </section>
  );
}
