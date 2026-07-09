from dataclasses import dataclass
from pathlib import Path

import numpy as np
import trimesh
from affine import Affine


@dataclass(frozen=True)
class MeshResult:
    vertex_count: int
    face_count: int
    origin_east: float
    origin_north: float
    origin_elevation: float
    resolution_meters: float
    elevation_min: float
    elevation_max: float


def terrain_array_to_glb(
    elevation: np.ndarray,
    transform: Affine,
    output_path: Path,
    max_vertices: int,
) -> MeshResult:
    data = np.asarray(elevation, dtype=np.float32)
    data = np.where(np.isfinite(data), data, np.nan)

    valid = np.isfinite(data)
    if not valid.any():
        raise ValueError("Terrain raster has no valid elevation cells after clipping.")

    fill_value = float(np.nanmedian(data))
    data = np.where(valid, data, fill_value)
    data, transform = _decimate(data, transform, max_vertices)

    rows, cols = data.shape
    col_grid, row_grid = np.meshgrid(np.arange(cols), np.arange(rows))
    east, north = transform * (col_grid, row_grid)
    origin_east = float(np.nanmean(east))
    origin_north = float(np.nanmean(north))
    origin_elevation = float(np.nanmin(data))

    x = east.astype(np.float32) - origin_east
    y = data.astype(np.float32) - origin_elevation
    z = -(north.astype(np.float32) - origin_north)
    vertices = np.column_stack((x.ravel(), y.ravel(), z.ravel()))

    faces = []
    for row in range(rows - 1):
        for col in range(cols - 1):
            a = row * cols + col
            b = a + 1
            c = a + cols
            d = c + 1
            faces.append((a, c, b))
            faces.append((b, c, d))

    mesh = trimesh.Trimesh(vertices=vertices, faces=np.asarray(faces), process=False)
    mesh.visual.vertex_colors = _terrain_colors(data).reshape((-1, 4))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    mesh.export(output_path)

    pixel_width = abs(float(transform.a))
    pixel_height = abs(float(transform.e))
    return MeshResult(
        vertex_count=int(vertices.shape[0]),
        face_count=len(faces),
        origin_east=origin_east,
        origin_north=origin_north,
        origin_elevation=origin_elevation,
        resolution_meters=max(pixel_width, pixel_height),
        elevation_min=float(np.nanmin(data)),
        elevation_max=float(np.nanmax(data)),
    )


def synthetic_terrain_to_glb(output_path: Path, max_vertices: int) -> MeshResult:
    size = int(max(24, min(96, np.sqrt(max_vertices))))
    xs = np.linspace(-45, 45, size)
    zs = np.linspace(-45, 45, size)
    xx, zz = np.meshgrid(xs, zs)
    elevation = 10 + 3 * np.sin(xx / 14) + 2 * np.cos(zz / 11) + 0.03 * xx
    transform = Affine.translation(0, size) * Affine.scale(1, -1)
    return terrain_array_to_glb(elevation.astype(np.float32), transform, output_path, max_vertices)


def _decimate(data: np.ndarray, transform: Affine, max_vertices: int) -> tuple[np.ndarray, Affine]:
    rows, cols = data.shape
    vertices = rows * cols
    if vertices <= max_vertices:
        return data, transform

    stride = int(np.ceil(np.sqrt(vertices / max_vertices)))
    sliced = data[::stride, ::stride]
    scaled = transform * Affine.scale(stride, stride)
    return sliced, scaled


def _terrain_colors(data: np.ndarray) -> np.ndarray:
    low = np.nanmin(data)
    high = np.nanmax(data)
    span = max(float(high - low), 1.0)
    normalized = (data - low) / span

    low_color = np.array([74, 111, 78], dtype=np.float32)
    mid_color = np.array([172, 164, 123], dtype=np.float32)
    high_color = np.array([214, 204, 177], dtype=np.float32)
    colors = np.empty((*data.shape, 4), dtype=np.uint8)

    lower = normalized <= 0.55
    lower_t = np.clip(normalized / 0.55, 0, 1)[..., None]
    upper_t = np.clip((normalized - 0.55) / 0.45, 0, 1)[..., None]
    rgb = np.where(
        lower[..., None],
        low_color + (mid_color - low_color) * lower_t,
        mid_color + (high_color - mid_color) * upper_t,
    )
    colors[..., :3] = rgb.astype(np.uint8)
    colors[..., 3] = 255
    return colors

