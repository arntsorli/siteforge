import { Environment, Grid, Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame } from "@react-three/fiber";
import type { ArchitectureObject } from "@siteforge/shared";
import { Box, Cuboid, Layers, MousePointer2, Move, Orbit, Pickaxe, Ruler } from "lucide-react";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { LayerVisibility } from "./DataLayerPanel";

export type TerrainMode = "default" | "flat" | "generated";

export interface TerrainSettings {
  relief: number;
  flatten: number;
  ridge: number;
}

interface SceneViewerProps {
  terrainUrl?: string;
  object: ArchitectureObject;
  layers: LayerVisibility;
  terrainMode: TerrainMode;
  terrainSettings: TerrainSettings;
  onObjectChange: (object: ArchitectureObject) => void;
  onTerrainModeChange: (mode: TerrainMode) => void;
  onTerrainSettingsChange: (settings: TerrainSettings) => void;
}

export function SceneViewer({
  terrainUrl,
  object,
  layers,
  terrainMode,
  terrainSettings,
  onObjectChange,
  onTerrainModeChange,
  onTerrainSettingsChange,
}: SceneViewerProps) {
  const controlsRef = useRef<any>(null);
  const pendingOrbitPointRef = useRef<THREE.Vector3 | null>(null);
  const [orbitMarker, setOrbitMarker] = useState<OrbitMarkerState | null>(null);
  const [toolMode, setToolMode] = useState<"select" | "orbit" | "pan" | "volume" | "terrain">("select");

  function markOrbitPoint(point: THREE.Vector3) {
    const nextPoint = point.clone();
    pendingOrbitPointRef.current = nextPoint;
    setOrbitMarker({ point: nextPoint.toArray(), shownAt: performance.now() });
  }

  function applyPendingOrbitPoint() {
    const pendingPoint = pendingOrbitPointRef.current;
    if (!pendingPoint) return;
    controlsRef.current?.target.copy(pendingPoint);
    controlsRef.current?.update();
    setOrbitMarker({ point: pendingPoint.toArray(), shownAt: performance.now() });
  }

  function showCurrentOrbitPoint() {
    const target = controlsRef.current?.target as THREE.Vector3 | undefined;
    if (target) setOrbitMarker({ point: target.toArray(), shownAt: performance.now() });
  }

  function handleScenePoint(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    markOrbitPoint(event.point);
  }

  return (
    <section className="scene-panel" aria-label="3D terrain scene">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">3D canvas</p>
          <h2>Terrain and planning layers</h2>
        </div>
        <div className="layer-legend" aria-label="Scene layers">
          <span>
            <Layers size={15} /> DTM
          </span>
          <span>
            <Box size={15} /> volume
          </span>
          <span>
            <Ruler size={15} /> grid
          </span>
        </div>
      </div>
      <div className="scene-canvas" onContextMenu={(event) => event.preventDefault()}>
        <div className="tool-strip" aria-label="3D tools">
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
        <Canvas
          camera={{ position: [55, 42, 58], fov: 46 }}
          gl={{ preserveDrawingBuffer: true }}
          onWheel={showCurrentOrbitPoint}
          shadows
        >
          <color attach="background" args={["#dce8df"]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[28, 50, 22]} intensity={1.8} castShadow />
          <group onPointerDown={handleScenePoint}>
            <Suspense fallback={<SimulatorTerrain terrainSettings={terrainSettings} mode="default" />}>
              {layers.terrain ? (
                terrainMode === "generated" && terrainUrl ? (
                  <TerrainModel url={terrainUrl} />
                ) : (
                  <SimulatorTerrain terrainSettings={terrainSettings} mode={terrainMode} />
                )
              ) : null}
            </Suspense>
            {layers.imagery ? <FlatImageryFallback /> : null}
            {layers.surface ? <SurfaceLayer /> : null}
          </group>
          {layers.planning ? <PlanningVolume object={object} /> : null}
          {layers.grid ? (
            <Grid args={[120, 24]} position={[0, 0.03, 0]} cellColor="#769177" sectionColor="#17211f" />
          ) : null}
          <OrbitPointMarker marker={orbitMarker} />
          <Environment preset="city" />
          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.16}
            screenSpacePanning
            onStart={applyPendingOrbitPoint}
            onEnd={showCurrentOrbitPoint}
            mouseButtons={{
              LEFT: THREE.MOUSE.ROTATE,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.PAN,
            }}
          />
        </Canvas>
      </div>
      <div className="object-editor">
        <label>
          Height
          <input
            type="range"
            min="2"
            max="12"
            step="0.5"
            value={object.heightMeters}
            onChange={(event) =>
              onObjectChange({ ...object, heightMeters: Number(event.currentTarget.value) })
            }
          />
          <strong>{object.heightMeters.toFixed(1)} m</strong>
        </label>
        <label>
          Roof pitch
          <input
            type="range"
            min="0"
            max="45"
            step="1"
            value={object.roofPitchDegrees}
            onChange={(event) =>
              onObjectChange({ ...object, roofPitchDegrees: Number(event.currentTarget.value) })
            }
          />
          <strong>{object.roofPitchDegrees}°</strong>
        </label>
        <label>
          Roof
          <select
            value={object.roofType}
            onChange={(event) =>
              onObjectChange({ ...object, roofType: event.currentTarget.value as ArchitectureObject["roofType"] })
            }
          >
            <option value="gable">Gable</option>
            <option value="flat">Flat</option>
            <option value="hip">Hip</option>
            <option value="shed">Shed</option>
          </select>
        </label>
      </div>
      <div className="terrain-editor">
        <label>
          Terrain
          <select
            value={terrainMode}
            onChange={(event) => onTerrainModeChange(event.currentTarget.value as TerrainMode)}
          >
            <option value="default">Default model</option>
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
    </section>
  );
}

function FlatImageryFallback() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
      <planeGeometry args={[100, 100, 1, 1]} />
      <meshStandardMaterial color="#637a50" roughness={0.95} transparent opacity={0.38} />
    </mesh>
  );
}

function SurfaceLayer() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 3.1, 0]}>
      <planeGeometry args={[84, 84, 10, 10]} />
      <meshStandardMaterial color="#7ca8b6" wireframe transparent opacity={0.35} />
    </mesh>
  );
}

function TerrainModel({ url }: { url: string }) {
  const gltf = useGLTF(url);
  return <primitive object={gltf.scene} dispose={null} />;
}

function PlanningVolume({ object }: { object: ArchitectureObject }) {
  const color = object.materialColor || "#d7894a";
  const height = object.heightMeters || 4;
  return (
    <group position={[0, 0.15, 0]}>
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[12, height, 8]} />
        <meshStandardMaterial color={color} transparent opacity={0.72} />
      </mesh>
      {object.roofType !== "flat" ? (
        <mesh position={[0, height + 1.3, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[7.4, 2.6, 4]} />
          <meshStandardMaterial color="#9f5138" transparent opacity={0.76} />
        </mesh>
      ) : null}
    </group>
  );
}

function SimulatorTerrain({
  terrainSettings,
  mode,
}: {
  terrainSettings: TerrainSettings;
  mode: TerrainMode;
}) {
  const geometry = useMemo(() => {
    const size = 96;
    const segments = 64;
    const nextGeometry = new THREE.PlaneGeometry(size, size, segments, segments);
    const positions = nextGeometry.attributes.position;
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const relief =
        mode === "flat"
          ? 0
          : terrainSettings.relief *
            (Math.sin(x / 13) * 0.45 + Math.cos(y / 16) * 0.35 + terrainSettings.ridge * (x / size) * 0.06);
      positions.setZ(index, relief * (1 - terrainSettings.flatten));
    }
    nextGeometry.computeVertexNormals();
    return nextGeometry;
  }, [mode, terrainSettings.flatten, terrainSettings.relief, terrainSettings.ridge]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial color={mode === "flat" ? "#7f936f" : "#6f8f5f"} roughness={0.9} />
    </mesh>
  );
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
