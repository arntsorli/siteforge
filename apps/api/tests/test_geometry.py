import pytest

from siteforge_api.schemas import BBoxGeometry
from siteforge_api.services.geometry import GeometryError, area_to_shape, validate_area_size


def test_bbox_area_validation_accepts_small_area() -> None:
    shape = area_to_shape(BBoxGeometry(west=10.75, south=59.91, east=10.751, north=59.911))
    area = validate_area_size(shape, 20_000)
    assert area > 0


def test_bbox_area_validation_rejects_large_area() -> None:
    shape = area_to_shape(BBoxGeometry(west=10.7, south=59.9, east=10.8, north=60.0))
    with pytest.raises(GeometryError):
        validate_area_size(shape, 1_000)

