import { Environment, Grid, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { ArchitectureObject } from "@siteforge/shared";
import { Box, Layers, Ruler } from "lucide-react";
import { Suspense } from "react";
import type { LayerVisibility } from "./DataLayerPanel";

interface SceneViewerProps {
  terrainUrl?: string;
  object: ArchitectureObject;
  layers: LayerVisibility;
  onObjectChange: (object: ArchitectureObject) => void;
}

export function SceneViewer({ terrainUrl, object, layers, onObjectChange }: SceneViewerProps) {
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
      <div className="scene-canvas">
        <Canvas camera={{ position: [55, 42, 58], fov: 46 }} gl={{ preserveDrawingBuffer: true }} shadows>
          <color attach="background" args={["#dce8df"]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[28, 50, 22]} intensity={1.8} castShadow />
          <Suspense fallback={<PlaceholderTerrain />}>
            {layers.terrain ? terrainUrl ? <TerrainModel url={terrainUrl} /> : <PlaceholderTerrain /> : null}
          </Suspense>
          {layers.imagery ? <FlatImageryFallback /> : null}
          {layers.surface ? <SurfaceLayer /> : null}
          {layers.planning ? <PlanningVolume object={object} /> : null}
          {layers.grid ? (
            <Grid args={[120, 24]} position={[0, 0.03, 0]} cellColor="#769177" sectionColor="#17211f" />
          ) : null}
          <Environment preset="city" />
          <OrbitControls makeDefault />
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

function PlaceholderTerrain() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[96, 96, 48, 48]} />
      <meshStandardMaterial color="#6f8f5f" wireframe={false} roughness={0.9} />
    </mesh>
  );
}
