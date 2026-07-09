import { Environment, Grid, Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame } from "@react-three/fiber";
import type { ArchitectureObject, AreaGeometry, Position } from "@siteforge/shared";
import {
  ChevronDown,
  Copy,
  Cuboid,
  Layers,
  MousePointer2,
  Move,
  Orbit,
  Pickaxe,
  Plus,
  Trash2,
} from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { LayerVisibility } from "./DataLayerPanel";

export type TerrainMode = "custom" | "flat" | "generated";

export interface TerrainSettings {
  relief: number;
  flatten: number;
  ridge: number;
}

type PushPullFace = "top" | "east" | "west" | "north" | "south";
type SolidObjectType = Extract<
  ArchitectureObject["type"],
  "building" | "garage" | "outbuilding" | "box" | "slab" | "cylinder"
>;

const SOLID_OBJECT_TYPES: Array<{ value: SolidObjectType; label: string }> = [
  { value: "box", label: "Box" },
  { value: "slab", label: "Slab" },
  { value: "cylinder", label: "Cylinder" },
  { value: "building", label: "Building" },
  { value: "garage", label: "Garage" },
  { value: "outbuilding", label: "Outbuilding" },
];

const ROOFED_OBJECT_TYPES = new Set<ArchitectureObject["type"]>(["building", "garage", "outbuilding"]);

interface SceneViewerProps {
  area: AreaGeometry;
  terrainUrl?: string;
  objects: ArchitectureObject[];
  selectedObjectId: string;
  layers: LayerVisibility;
  terrainMode: TerrainMode;
  terrainSettings: TerrainSettings;
  onObjectsChange: (objects: ArchitectureObject[]) => void;
  onSelectedObjectChange: (id: string) => void;
  onTerrainModeChange: (mode: TerrainMode) => void;
  onTerrainSettingsChange: (settings: TerrainSettings) => void;
  onLayerChange: (layers: LayerVisibility) => void;
}

export function SceneViewer({
  area,
  terrainUrl,
  objects,
  selectedObjectId,
  layers,
  terrainMode,
  terrainSettings,
  onObjectsChange,
  onSelectedObjectChange,
  onTerrainModeChange,
  onTerrainSettingsChange,
  onLayerChange,
}: SceneViewerProps) {
  const controlsRef = useRef<any>(null);
  const areaKey = areaToKey(area);
  const areaDimensions = useMemo(() => areaDimensionsMeters(area), [areaKey]);
  const satelliteTexture = useSatelliteTexture(area, layers.imagery);
  const [orbitMarker, setOrbitMarker] = useState<OrbitMarkerState | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [toolMode, setToolMode] = useState<"select" | "orbit" | "pan" | "volume" | "terrain">("select");
  const [pushPullFace, setPushPullFace] = useState<PushPullFace>("top");

  const selectedObject = objects.find((item) => item.id === selectedObjectId) ?? objects[0];
  const selectedDimensions = selectedObject ? objectDimensionsMeters(selectedObject, area) : { width: 8, depth: 6 };

  function replaceObject(nextObject: ArchitectureObject) {
    onObjectsChange(objects.map((item) => (item.id === nextObject.id ? nextObject : item)));
  }

  function addObjectAtPoint(point: THREE.Vector3) {
    const nextObject = createObjectFromLocalPoint(point, area, objects.length + 1);
    onObjectsChange([...objects, nextObject]);
    onSelectedObjectChange(nextObject.id);
    setToolMode("volume");
  }

  function addCenteredObject() {
    addObjectAtPoint(new THREE.Vector3(0, 0, 0));
  }

  function duplicateSelectedObject() {
    if (!selectedObject) return;
    const local = objectLocalPosition(selectedObject, area);
    const nextObject = createObjectFromLocalPoint(
      new THREE.Vector3(local.x + 5, 0, local.z - 5),
      area,
      objects.length + 1,
      {
        heightMeters: selectedObject.heightMeters,
        roofType: selectedObject.roofType,
        roofPitchDegrees: selectedObject.roofPitchDegrees,
        materialColor: selectedObject.materialColor,
        type: selectedObject.type,
      },
      selectedDimensions.width,
      selectedDimensions.depth,
    );
    onObjectsChange([...objects, nextObject]);
    onSelectedObjectChange(nextObject.id);
  }

  function deleteSelectedObject() {
    if (!selectedObject) return;
    const nextObjects = objects.filter((item) => item.id !== selectedObject.id);
    if (nextObjects.length) {
      onObjectsChange(nextObjects);
      onSelectedObjectChange(nextObjects[0].id);
      return;
    }
    const fallbackObject = createObjectFromLocalPoint(new THREE.Vector3(), area, 1);
    onObjectsChange([fallbackObject]);
    onSelectedObjectChange(fallbackObject.id);
  }

  function updateSelectedObjectType(type: SolidObjectType) {
    if (!selectedObject) return;
    replaceObject({
      ...selectedObject,
      type,
      roofType: ROOFED_OBJECT_TYPES.has(type) ? selectedObject.roofType : "flat",
      name: `${SOLID_OBJECT_TYPES.find((item) => item.value === type)?.label ?? "Solid"} ${objects.indexOf(selectedObject) + 1}`,
    });
  }

  function applyPushPull(amount: number) {
    if (!selectedObject) return;
    replaceObject(pushPullObjectFace(selectedObject, area, pushPullFace, amount));
  }

  function handleTerrainPointerDown(event: ThreeEvent<PointerEvent>) {
    if (toolMode !== "volume" || event.button !== 0) return;
    event.stopPropagation();
    addObjectAtPoint(event.point);
  }

  function handleOrbitPoint(event: ThreeEvent<MouseEvent>) {
    if (toolMode !== "orbit") return;
    event.stopPropagation();
    const point = event.point.clone();
    controlsRef.current?.target.copy(point);
    controlsRef.current?.update();
    setOrbitMarker({ point: point.toArray(), shownAt: performance.now() });
  }

  return (
    <section className="scene-panel scene-panel-full" aria-label="3D terrain scene">
      <div className="scene-canvas" onContextMenu={(event) => event.preventDefault()}>
        <div className="scene-title-chip">
          <strong>3D Planning</strong>
          <span>{layers.imagery ? "Satellite drape on terrain" : "Editable custom terrain"}</span>
        </div>

        <div className="tool-strip floating-tool-strip" aria-label="3D tools">
          {[
            ["select", MousePointer2],
            ["orbit", Orbit],
            ["pan", Move],
            ["volume", Cuboid],
            ["terrain", Pickaxe],
          ].map(([mode, Icon]) => {
            const ToolIcon = Icon as typeof MousePointer2;
            return (
              <button
                key={mode as string}
                type="button"
                className={toolMode === mode ? "active" : ""}
                onClick={() => setToolMode(mode as typeof toolMode)}
                title={`${mode} tool`}
              >
                <ToolIcon size={17} />
              </button>
            );
          })}
        </div>

        <div className="canvas-layer-dropdown">
          <button type="button" onClick={() => setLayersOpen((open) => !open)}>
            <Layers size={17} /> Layers <ChevronDown size={15} />
          </button>
          {layersOpen ? (
            <div className="canvas-layer-menu">
              {Object.entries(layers).map(([key, value]) => (
                <label key={key}>
                  <span>{key}</span>
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(event) => onLayerChange({ ...layers, [key]: event.currentTarget.checked })}
                  />
                </label>
              ))}
            </div>
          ) : null}
        </div>

        {toolMode === "orbit" ? (
          <div className="canvas-hint">
            Double-click terrain to set the orbit point. Orbit, pan, and zoom will not move it.
          </div>
        ) : null}

        {toolMode === "volume" ? (
          <div className="floating-editor object-editor">
            <div className="editor-title-row">
              <strong>{selectedObject?.name ?? "No volume selected"}</strong>
              <div>
                <button type="button" onClick={addCenteredObject} title="Add volume at center">
                  <Plus size={16} />
                </button>
                <button type="button" onClick={duplicateSelectedObject} disabled={!selectedObject} title="Duplicate volume">
                  <Copy size={16} />
                </button>
                <button type="button" onClick={deleteSelectedObject} disabled={!selectedObject} title="Delete volume">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <p className="fineprint no-margin">Click terrain with this tool active to place a new volume.</p>
            {selectedObject ? (
              <>
                <label>
                  Primitive
                  <select
                    value={solidTypeForObject(selectedObject.type)}
                    onChange={(event) => updateSelectedObjectType(event.currentTarget.value as SolidObjectType)}
                  >
                    {SOLID_OBJECT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Width
                  <input
                    type="range"
                    min="3"
                    max="24"
                    step="0.5"
                    value={selectedDimensions.width}
                    onChange={(event) =>
                      replaceObject(
                        resizeObjectFootprint(selectedObject, area, Number(event.currentTarget.value), selectedDimensions.depth),
                      )
                    }
                  />
                  <strong>{selectedDimensions.width.toFixed(1)} m</strong>
                </label>
                <label>
                  Depth
                  <input
                    type="range"
                    min="3"
                    max="24"
                    step="0.5"
                    value={selectedDimensions.depth}
                    onChange={(event) =>
                      replaceObject(
                        resizeObjectFootprint(selectedObject, area, selectedDimensions.width, Number(event.currentTarget.value)),
                      )
                    }
                  />
                  <strong>{selectedDimensions.depth.toFixed(1)} m</strong>
                </label>
                <label>
                  Height
                  <input
                    type="range"
                    min="2"
                    max="12"
                    step="0.5"
                    value={selectedObject.heightMeters}
                    onChange={(event) =>
                      replaceObject({ ...selectedObject, heightMeters: Number(event.currentTarget.value) })
                    }
                  />
                  <strong>{selectedObject.heightMeters.toFixed(1)} m</strong>
                </label>
                <label>
                  Roof
                  <select
                    disabled={!ROOFED_OBJECT_TYPES.has(selectedObject.type)}
                    value={selectedObject.roofType}
                    onChange={(event) =>
                      replaceObject({
                        ...selectedObject,
                        roofType: event.currentTarget.value as ArchitectureObject["roofType"],
                      })
                    }
                  >
                    <option value="gable">Gable</option>
                    <option value="flat">Flat</option>
                    <option value="hip">Hip</option>
                    <option value="shed">Shed</option>
                  </select>
                </label>
                <div className="push-pull-panel">
                  <div className="push-pull-heading">
                    <strong>Push / pull face</strong>
                    <span>
                      {selectedDimensions.width.toFixed(1)} x {selectedDimensions.depth.toFixed(1)} x{" "}
                      {selectedObject.heightMeters.toFixed(1)} m
                    </span>
                  </div>
                  <div className="face-button-grid" aria-label="Face selection">
                    {(["top", "north", "south", "west", "east"] as const).map((face) => (
                      <button
                        key={face}
                        type="button"
                        className={pushPullFace === face ? "active" : ""}
                        onClick={() => setPushPullFace(face)}
                      >
                        {face}
                      </button>
                    ))}
                  </div>
                  <div className="push-pull-actions">
                    <button type="button" onClick={() => applyPushPull(-1)}>
                      Push 1 m
                    </button>
                    <button type="button" onClick={() => applyPushPull(-0.25)}>
                      Push 0.25 m
                    </button>
                    <button type="button" onClick={() => applyPushPull(0.25)}>
                      Pull 0.25 m
                    </button>
                    <button type="button" onClick={() => applyPushPull(1)}>
                      Pull 1 m
                    </button>
                  </div>
                </div>
                <label>
                  Color
                  <input
                    type="color"
                    value={selectedObject.materialColor}
                    onChange={(event) => replaceObject({ ...selectedObject, materialColor: event.currentTarget.value })}
                  />
                </label>
              </>
            ) : null}
          </div>
        ) : null}

        {toolMode === "terrain" ? (
          <div className="floating-editor terrain-editor">
            <label>
              Terrain
              <select
                value={terrainMode}
                onChange={(event) => onTerrainModeChange(event.currentTarget.value as TerrainMode)}
              >
                <option value="custom">Custom editable</option>
                <option value="flat">Flat fallback</option>
                <option value="generated" disabled={!terrainUrl}>
                  Generated DTM
                </option>
              </select>
            </label>
            <label>
              Relief
              <input
                type="range"
                min="0"
                max="16"
                step="0.5"
                value={terrainSettings.relief}
                onChange={(event) =>
                  onTerrainSettingsChange({ ...terrainSettings, relief: Number(event.currentTarget.value) })
                }
              />
              <strong>{terrainSettings.relief.toFixed(1)} m</strong>
            </label>
            <label>
              Flatten
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={terrainSettings.flatten}
                onChange={(event) =>
                  onTerrainSettingsChange({ ...terrainSettings, flatten: Number(event.currentTarget.value) })
                }
              />
              <strong>{Math.round(terrainSettings.flatten * 100)}%</strong>
            </label>
            <label>
              Ridge
              <input
                type="range"
                min="-8"
                max="8"
                step="0.5"
                value={terrainSettings.ridge}
                onChange={(event) =>
                  onTerrainSettingsChange({ ...terrainSettings, ridge: Number(event.currentTarget.value) })
                }
              />
              <strong>{terrainSettings.ridge.toFixed(1)} m</strong>
            </label>
          </div>
        ) : null}

        <Canvas camera={{ position: [55, 42, 58], fov: 46 }} gl={{ preserveDrawingBuffer: true }} shadows>
          <color attach="background" args={["#dce8df"]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[28, 50, 22]} intensity={1.8} castShadow />
          <group onDoubleClick={handleOrbitPoint} onPointerDown={handleTerrainPointerDown}>
            <Suspense
              fallback={
                <SimulatorTerrain terrainSettings={terrainSettings} mode="custom" dimensions={areaDimensions} />
              }
            >
              {layers.terrain ? (
                terrainMode === "generated" && terrainUrl ? (
                  <TerrainModel url={terrainUrl} />
                ) : (
                  <SimulatorTerrain
                    terrainSettings={terrainSettings}
                    mode={terrainMode}
                    dimensions={areaDimensions}
                    terrainTexture={layers.imagery ? satelliteTexture : null}
                  />
                )
              ) : null}
            </Suspense>
            {!layers.terrain && layers.imagery ? (
              <FlatImageryFallback texture={satelliteTexture} dimensions={areaDimensions} />
            ) : null}
            {layers.surface ? <SurfaceLayer dimensions={areaDimensions} /> : null}
          </group>
          {layers.planning
            ? objects.map((item) => (
                <PlanningVolume
                  key={item.id}
                  area={area}
                  object={item}
                  selected={item.id === selectedObjectId}
                  onSelect={onSelectedObjectChange}
                />
              ))
            : null}
          {layers.grid ? (
            <Grid
              args={[Math.max(areaDimensions.width, areaDimensions.depth), 24]}
              position={[0, 0.03, 0]}
              cellColor="#769177"
              sectionColor="#17211f"
            />
          ) : null}
          <OrbitPointMarker marker={orbitMarker} />
          <Environment preset="city" />
          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.18}
            screenSpacePanning
            mouseButtons={{
              LEFT: THREE.MOUSE.ROTATE,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.PAN,
            }}
          />
        </Canvas>
      </div>
    </section>
  );
}

function FlatImageryFallback({
  texture,
  dimensions,
}: {
  texture: THREE.Texture | null;
  dimensions: AreaDimensions;
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
      <planeGeometry args={[dimensions.width, dimensions.depth, 1, 1]} />
      <meshStandardMaterial map={texture ?? undefined} color="#637a50" roughness={0.95} transparent opacity={0.82} />
    </mesh>
  );
}

function SurfaceLayer({ dimensions }: { dimensions: AreaDimensions }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 3.1, 0]}>
      <planeGeometry args={[dimensions.width * 0.88, dimensions.depth * 0.88, 10, 10]} />
      <meshStandardMaterial color="#7ca8b6" wireframe transparent opacity={0.35} />
    </mesh>
  );
}

function TerrainModel({ url }: { url: string }) {
  const gltf = useGLTF(url);
  return <primitive object={gltf.scene} dispose={null} />;
}

function PlanningVolume({
  area,
  object,
  selected,
  onSelect,
}: {
  area: AreaGeometry;
  object: ArchitectureObject;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const color = object.materialColor || "#d7894a";
  const height = object.heightMeters || 4;
  const dimensions = objectDimensionsMeters(object, area);
  const position = objectLocalPosition(object, area);
  const isCylinder = object.type === "cylinder";
  const cylinderRadius = Math.max(0.5, Math.min(dimensions.width, dimensions.depth) / 2);
  const edgeSource = isCylinder
    ? new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, height, 32)
    : new THREE.BoxGeometry(dimensions.width, height, dimensions.depth);
  return (
    <group
      position={[position.x, 0.15, position.z]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id);
      }}
    >
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        {isCylinder ? (
          <cylinderGeometry args={[cylinderRadius, cylinderRadius, height, 32]} />
        ) : (
          <boxGeometry args={[dimensions.width, height, dimensions.depth]} />
        )}
        <meshStandardMaterial color={color} transparent opacity={selected ? 0.86 : 0.68} />
      </mesh>
      {selected ? (
        <lineSegments position={[0, height / 2, 0]}>
          <edgesGeometry args={[edgeSource]} />
          <lineBasicMaterial color="#17211f" />
        </lineSegments>
      ) : null}
      {ROOFED_OBJECT_TYPES.has(object.type) && object.roofType !== "flat" ? (
        <mesh position={[0, height + 1.3, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[Math.max(dimensions.width, dimensions.depth) * 0.58, 2.6, 4]} />
          <meshStandardMaterial color="#9f5138" transparent opacity={0.78} />
        </mesh>
      ) : null}
    </group>
  );
}

function SimulatorTerrain({
  terrainSettings,
  mode,
  dimensions,
  terrainTexture,
}: {
  terrainSettings: TerrainSettings;
  mode: TerrainMode;
  dimensions: AreaDimensions;
  terrainTexture?: THREE.Texture | null;
}) {
  const geometry = useMemo(() => {
    const segments = 64;
    const nextGeometry = new THREE.PlaneGeometry(dimensions.width, dimensions.depth, segments, segments);
    const positions = nextGeometry.attributes.position;
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const relief =
        mode === "flat"
          ? 0
          : terrainSettings.relief *
            (Math.sin(x / 13) * 0.45 +
              Math.cos(y / 16) * 0.35 +
              terrainSettings.ridge * (x / Math.max(1, dimensions.width)) * 0.06);
      positions.setZ(index, relief * (1 - terrainSettings.flatten));
    }
    nextGeometry.computeVertexNormals();
    return nextGeometry;
  }, [dimensions.depth, dimensions.width, mode, terrainSettings.flatten, terrainSettings.relief, terrainSettings.ridge]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial
        color={terrainTexture ? "#ffffff" : mode === "flat" ? "#7f936f" : "#6f8f5f"}
        map={terrainTexture ?? undefined}
        roughness={0.9}
      />
    </mesh>
  );
}

function useSatelliteTexture(area: AreaGeometry, enabled: boolean) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const areaKey = areaToKey(area);
  const bounds = useMemo(() => areaBounds(area), [areaKey]);

  useEffect(() => {
    if (!enabled) {
      setTexture(null);
      return undefined;
    }

    const { canvas, texture: nextTexture } = createFallbackSatelliteTexture(area, bounds);
    setTexture(nextTexture);

    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      try {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        drawAreaSelectionOverlay(context, area, bounds, canvas.width, canvas.height);
        drawTerrainMaskOverlay(context, canvas.width, canvas.height);
        nextTexture.needsUpdate = true;
        setTexture(nextTexture);
      } catch {
        nextTexture.needsUpdate = true;
      }
    };
    image.onerror = () => {
      nextTexture.needsUpdate = true;
    };
    image.src = esriSatelliteExportUrl(bounds, canvas.width);

    return () => {
      cancelled = true;
    };
  }, [area, areaKey, bounds, enabled]);

  return texture;
}

function createFallbackSatelliteTexture(area: AreaGeometry, bounds: AreaBounds) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#46583c");
    gradient.addColorStop(0.45, "#7a8657");
    gradient.addColorStop(1, "#394d3d");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(211, 197, 137, 0.42)";
    context.fillRect(52, 70, 160, 112);
    context.fillRect(250, 260, 180, 118);
    context.strokeStyle = "rgba(230, 226, 205, 0.62)";
    context.lineWidth = 12;
    context.beginPath();
    context.moveTo(0, 390);
    context.bezierCurveTo(260, 600, 460, 720, canvas.width, 420);
    context.stroke();
    drawAreaSelectionOverlay(context, area, bounds, canvas.width, canvas.height);
    drawTerrainMaskOverlay(context, canvas.width, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, texture };
}

function drawAreaSelectionOverlay(
  context: CanvasRenderingContext2D,
  area: AreaGeometry,
  bounds: AreaBounds,
  width: number,
  height: number,
) {
  context.save();
  context.lineWidth = 4;
  context.strokeStyle = "rgba(251, 250, 244, 0.78)";
  if (area.type === "BBox") {
    context.strokeRect(2, 2, width - 4, height - 4);
    context.restore();
    return;
  }
  const ring = area.coordinates[0] ?? [];
  if (ring.length < 3) {
    context.restore();
    return;
  }
  context.beginPath();
  context.rect(0, 0, width, height);
  ring.forEach((position, index) => {
    const point = positionToTexturePoint(position, bounds, width, height);
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.closePath();
  context.fillStyle = "rgba(23, 33, 31, 0.28)";
  context.fill("evenodd");
  context.beginPath();
  ring.forEach((position, index) => {
    const point = positionToTexturePoint(position, bounds, width, height);
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.closePath();
  context.stroke();
  context.restore();
}

function drawTerrainMaskOverlay(context: CanvasRenderingContext2D, width: number, height: number) {
  context.fillStyle = "rgba(23, 33, 31, 0.16)";
  for (let index = 0; index < 32; index += 1) {
    const x = (index * 79) % width;
    const y = (index * 137) % height;
    context.fillRect(x, y, 3 + (index % 5), 3 + (index % 7));
  }
}

function esriSatelliteExportUrl(bounds: AreaBounds, size: number) {
  const bbox = [bounds.west, bounds.south, bounds.east, bounds.north].map((value) => value.toFixed(7)).join(",");
  return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=${size},${size}&format=jpg&f=image`;
}

function createObjectFromLocalPoint(
  point: THREE.Vector3,
  area: AreaGeometry,
  index: number,
  overrides: Partial<ArchitectureObject> = {},
  width = 8,
  depth = 6,
): ArchitectureObject {
  const footprint = localRectToFootprint(point.x, point.z, width, depth, area);
  const type = overrides.type ?? "box";
  return {
    id: `object-${crypto.randomUUID()}`,
    type,
    name: `${SOLID_OBJECT_TYPES.find((item) => item.value === type)?.label ?? "Solid"} ${index}`,
    footprint,
    heightMeters: overrides.heightMeters ?? 4,
    roofType: overrides.roofType ?? (ROOFED_OBJECT_TYPES.has(type) ? "gable" : "flat"),
    roofPitchDegrees: overrides.roofPitchDegrees ?? 22,
    materialColor: overrides.materialColor ?? "#d7894a",
    terrainSnapMode: overrides.terrainSnapMode ?? "projected",
  };
}

function resizeObjectFootprint(object: ArchitectureObject, area: AreaGeometry, width: number, depth: number) {
  const local = objectLocalPosition(object, area);
  return { ...object, footprint: localRectToFootprint(local.x, local.z, width, depth, area) };
}

function pushPullObjectFace(
  object: ArchitectureObject,
  area: AreaGeometry,
  face: PushPullFace,
  amount: number,
): ArchitectureObject {
  if (face === "top") {
    return { ...object, heightMeters: clamp(object.heightMeters + amount, 0.2, 60) };
  }
  const dimensions = objectDimensionsMeters(object, area);
  const local = objectLocalPosition(object, area);
  let width = dimensions.width;
  let depth = dimensions.depth;
  let x = local.x;
  let z = local.z;
  if (face === "east" || face === "west") {
    const nextWidth = clamp(width + amount, 0.5, 80);
    const delta = nextWidth - width;
    width = nextWidth;
    x += face === "east" ? delta / 2 : -delta / 2;
  }
  if (face === "south" || face === "north") {
    const nextDepth = clamp(depth + amount, 0.5, 80);
    const delta = nextDepth - depth;
    depth = nextDepth;
    z += face === "south" ? delta / 2 : -delta / 2;
  }
  return { ...object, footprint: localRectToFootprint(x, z, width, depth, area) };
}

function localRectToFootprint(x: number, z: number, width: number, depth: number, area: AreaGeometry) {
  const corners = [
    localToPosition(x - width / 2, z - depth / 2, area),
    localToPosition(x + width / 2, z - depth / 2, area),
    localToPosition(x + width / 2, z + depth / 2, area),
    localToPosition(x - width / 2, z + depth / 2, area),
  ];
  return { type: "Polygon" as const, coordinates: [[...corners, corners[0]]] };
}

function objectLocalPosition(object: ArchitectureObject, area: AreaGeometry) {
  const localPoints = object.footprint.coordinates[0]?.slice(0, -1).map((position) => positionToLocal(position, area)) ?? [];
  if (!localPoints.length) return { x: 0, z: 0 };
  return {
    x: localPoints.reduce((sum, point) => sum + point.x, 0) / localPoints.length,
    z: localPoints.reduce((sum, point) => sum + point.z, 0) / localPoints.length,
  };
}

function objectDimensionsMeters(object: ArchitectureObject, area: AreaGeometry) {
  const localPoints = object.footprint.coordinates[0]?.slice(0, -1).map((position) => positionToLocal(position, area)) ?? [];
  if (!localPoints.length) return { width: 8, depth: 6 };
  const xs = localPoints.map((point) => point.x);
  const zs = localPoints.map((point) => point.z);
  return {
    width: Math.max(2, Math.max(...xs) - Math.min(...xs)),
    depth: Math.max(2, Math.max(...zs) - Math.min(...zs)),
  };
}

function solidTypeForObject(type: ArchitectureObject["type"]): SolidObjectType {
  return SOLID_OBJECT_TYPES.some((item) => item.value === type) ? (type as SolidObjectType) : "box";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function localToPosition(x: number, z: number, area: AreaGeometry): Position {
  const center = areaCenter(area);
  const metersPerLon = metersPerDegreeLon(center.lat);
  return [center.lon + x / metersPerLon, center.lat - z / 111_320];
}

function positionToLocal(position: Position, area: AreaGeometry) {
  const center = areaCenter(area);
  return {
    x: (position[0] - center.lon) * metersPerDegreeLon(center.lat),
    z: (center.lat - position[1]) * 111_320,
  };
}

function metersPerDegreeLon(lat: number) {
  return Math.max(1, 111_320 * Math.cos((lat * Math.PI) / 180));
}

function areaCenter(area: AreaGeometry) {
  const bounds = areaBounds(area);
  return {
    lon: (bounds.west + bounds.east) / 2,
    lat: (bounds.south + bounds.north) / 2,
  };
}

interface AreaBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface AreaDimensions {
  width: number;
  depth: number;
}

function areaBounds(area: AreaGeometry): AreaBounds {
  if (area.type === "BBox") {
    return area;
  }
  const ring = area.coordinates[0] ?? [];
  const positions = ring.length > 1 && ring[0] === ring[ring.length - 1] ? ring.slice(0, -1) : ring;
  if (!positions.length) {
    return { west: 0, south: 0, east: 0.001, north: 0.001 };
  }
  const lons = positions.map((point) => point[0]);
  const lats = positions.map((point) => point[1]);
  return {
    west: Math.min(...lons),
    south: Math.min(...lats),
    east: Math.max(...lons),
    north: Math.max(...lats),
  };
}

function areaDimensionsMeters(area: AreaGeometry): AreaDimensions {
  const bounds = areaBounds(area);
  const centerLat = (bounds.south + bounds.north) / 2;
  return {
    width: Math.max(24, Math.abs(bounds.east - bounds.west) * metersPerDegreeLon(centerLat)),
    depth: Math.max(24, Math.abs(bounds.north - bounds.south) * 111_320),
  };
}

function positionToTexturePoint(position: Position, bounds: AreaBounds, width: number, height: number) {
  const lonSpan = Math.max(0.000001, bounds.east - bounds.west);
  const latSpan = Math.max(0.000001, bounds.north - bounds.south);
  return {
    x: ((position[0] - bounds.west) / lonSpan) * width,
    y: ((bounds.north - position[1]) / latSpan) * height,
  };
}

function areaToKey(area: AreaGeometry) {
  return area.type === "BBox"
    ? `${area.west},${area.south},${area.east},${area.north}`
    : area.coordinates[0]?.map((point) => point.join(",")).join(";") ?? "polygon";
}

interface OrbitMarkerState {
  point: [number, number, number];
  shownAt: number;
}

function OrbitPointMarker({ marker }: { marker: OrbitMarkerState | null }) {
  const sphereRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  useFrame(() => {
    if (!marker) return;
    const age = performance.now() - marker.shownAt;
    const opacity = Math.max(0, 0.8 * (1 - age / 3500));
    const material = sphereRef.current?.material as THREE.MeshStandardMaterial | undefined;
    if (material) material.opacity = opacity;
    if (labelRef.current) labelRef.current.style.opacity = String(opacity);
  });

  if (!marker) return null;

  return (
    <group position={marker.point}>
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.9, 20, 20]} />
        <meshStandardMaterial color="#17211f" transparent opacity={0.8} />
      </mesh>
      <Html center distanceFactor={18}>
        <div ref={labelRef} className="orbit-label">
          orbit point
        </div>
      </Html>
    </group>
  );
}
