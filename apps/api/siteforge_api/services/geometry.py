from collections.abc import Iterable

from pyproj import Geod, Transformer
from shapely.geometry import Polygon, box, mapping
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform

from siteforge_api.schemas import AreaGeometry, BBoxGeometry, PolygonGeometry

WGS84 = "EPSG:4326"
NORWAY_PROJECTED = "EPSG:25833"


class GeometryError(ValueError):
    pass


def area_to_shape(area: AreaGeometry) -> BaseGeometry:
    if isinstance(area, BBoxGeometry):
        if area.east <= area.west or area.north <= area.south:
            raise GeometryError("Bounding box east/north must be greater than west/south.")
        shape = box(area.west, area.south, area.east, area.north)
    elif isinstance(area, PolygonGeometry):
        if not area.coordinates or len(area.coordinates[0]) < 4:
            raise GeometryError(
                "Polygon requires a closed outer ring with at least four positions."
            )
        shape = Polygon(area.coordinates[0], area.coordinates[1:])
    else:
        raise GeometryError("Unsupported area geometry.")

    if shape.is_empty or not shape.is_valid:
        raise GeometryError("Selected area is invalid.")
    return shape


def geodesic_area_sq_m(shape_wgs84: BaseGeometry) -> float:
    geod = Geod(ellps="WGS84")
    area, _ = geod.geometry_area_perimeter(shape_wgs84)
    return abs(area)


def validate_area_size(shape_wgs84: BaseGeometry, max_area_sq_m: float) -> float:
    area = geodesic_area_sq_m(shape_wgs84)
    if area > max_area_sq_m:
        raise GeometryError(
            f"Selected area is {area:,.0f} m2, above the MVP limit of {max_area_sq_m:,.0f} m2."
        )
    return area


def reproject_shape(shape: BaseGeometry, source_crs: str, target_crs: str) -> BaseGeometry:
    transformer = Transformer.from_crs(source_crs, target_crs, always_xy=True)
    return transform(transformer.transform, shape)


def shape_to_geojson_polygon(shape: BaseGeometry) -> dict:
    return mapping(shape)


def bbox_tuple(shape: BaseGeometry) -> tuple[float, float, float, float]:
    minx, miny, maxx, maxy = shape.bounds
    return (float(minx), float(miny), float(maxx), float(maxy))


def coordinates_from_bounds(bounds: Iterable[float]) -> list[list[tuple[float, float]]]:
    west, south, east, north = bounds
    return [[(west, south), (east, south), (east, north), (west, north), (west, south)]]
