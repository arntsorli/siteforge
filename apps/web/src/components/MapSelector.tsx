import type { AreaGeometry, Position } from "@siteforge/shared";
import type { FeatureCollection, Polygon } from "geojson";
import { BoxSelect, Home, LocateFixed, RotateCcw } from "lucide-react";
import maplibregl, { type GeoJSONSource, type Map } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MapViewMode } from "./DataLayerPanel";

interface MapSelectorProps {
  selectedArea: AreaGeometry;
  mapViewMode: MapViewMode;
  onAreaChange: (area: AreaGeometry) => void;
  onFortenvegen: () => void;
}

const OSLO_TEST_AREA: AreaGeometry = {
  type: "BBox",
  west: 10.7522,
  south: 59.9135,
  east: 10.754,
  north: 59.9148,
};

export function MapSelector({ selectedArea, mapViewMode, onAreaChange, onFortenvegen }: MapSelectorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const [points, setPoints] = useState<Position[]>([]);

  const polygonFeature = useMemo(() => {
    const area = points.length >= 3 ? pointsToPolygon(points) : selectedAreaToPolygon(selectedArea);
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: area,
        },
      ],
    } as FeatureCollection;
  }, [points, selectedArea]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [10.753, 59.914],
      zoom: 17,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "OpenStreetMap contributors",
          },
          satellite: {
            type: "raster",
            tiles: [
              "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            attribution: "Esri World Imagery",
          },
        },
        layers: [
          { id: "satellite", type: "raster", source: "satellite", paint: { "raster-opacity": 0 } },
          { id: "osm", type: "raster", source: "osm", paint: { "raster-opacity": 1 } },
        ],
      },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.on("click", (event) => {
      const next: Position = [event.lngLat.lng, event.lngLat.lat];
      setPoints((current) => [...current, next]);
    });
    map.on("dblclick", (event) => {
      event.preventDefault();
      setPoints((current) => {
        if (current.length < 3) return current;
        onAreaChange({ type: "Polygon", coordinates: [[...current, current[0]]] });
        return [];
      });
    });
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("selection", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] } as FeatureCollection,
      });
      map.addLayer({
        id: "selection-fill",
        type: "fill",
        source: "selection",
        paint: { "fill-color": "#d7894a", "fill-opacity": 0.28 },
      });
      map.addLayer({
        id: "selection-line",
        type: "line",
        source: "selection",
        paint: { "line-color": "#17211f", "line-width": 3 },
      });
    });

    return () => map.remove();
  }, [onAreaChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const source = map.getSource("selection") as GeoJSONSource | undefined;
    source?.setData(polygonFeature);
  }, [polygonFeature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = areaBounds(selectedArea);
    map.fitBounds(
      [
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      ],
      { padding: 80, maxZoom: 18, duration: 700 },
    );
  }, [selectedArea]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const osmOpacity = mapViewMode === "satellite" ? 0 : mapViewMode === "overlay" ? 0.5 : 1;
    const satelliteOpacity = mapViewMode === "map" ? 0 : mapViewMode === "overlay" ? 0.7 : 1;
    map.setPaintProperty("osm", "raster-opacity", osmOpacity);
    map.setPaintProperty("satellite", "raster-opacity", satelliteOpacity);
  }, [mapViewMode]);

  function useVisibleBounds() {
    const bounds = mapRef.current?.getBounds();
    if (!bounds) return;
    onAreaChange({
      type: "BBox",
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    });
    setPoints([]);
  }

  return (
    <section className="map-panel" aria-label="Map area selection">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Area input</p>
          <h2>Draw or frame a site</h2>
        </div>
        <div className="toolbar">
          <button type="button" onClick={() => onAreaChange(OSLO_TEST_AREA)} title="Use small Oslo test area">
            <LocateFixed size={18} />
          </button>
          <button type="button" onClick={onFortenvegen} title="Use Fortenvegen 100 preset">
            <Home size={18} />
          </button>
          <button type="button" onClick={useVisibleBounds} title="Use visible map bounds">
            <BoxSelect size={18} />
          </button>
          <button type="button" onClick={() => setPoints([])} title="Clear in-progress polygon">
            <RotateCcw size={18} />
          </button>
        </div>
      </div>
      <div ref={containerRef} className="map-canvas" />
      <p className="fineprint">
        Click to place polygon points; double-click to use the polygon. Use a small area for the MVP terrain job.
      </p>
    </section>
  );
}

function pointsToPolygon(points: Position[]): Polygon {
  return { type: "Polygon", coordinates: [[...points, points[0]]] };
}

function selectedAreaToPolygon(area: AreaGeometry): Polygon {
  if (area.type === "Polygon") return area as Polygon;
  return {
    type: "Polygon",
    coordinates: [
      [
        [area.west, area.south],
        [area.east, area.south],
        [area.east, area.north],
        [area.west, area.north],
        [area.west, area.south],
      ],
    ],
  };
}

function areaBounds(area: AreaGeometry) {
  if (area.type === "BBox") return area;
  const outer = area.coordinates[0] ?? [];
  const lons = outer.map((position) => position[0]);
  const lats = outer.map((position) => position[1]);
  return {
    west: Math.min(...lons),
    south: Math.min(...lats),
    east: Math.max(...lons),
    north: Math.max(...lats),
  };
}
