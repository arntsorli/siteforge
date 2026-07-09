import xml.etree.ElementTree as ET

from siteforge_api.providers.hoydedata import _georss_polygon_to_shape


def test_georss_polygon_uses_lon_lat_order() -> None:
    polygon = _georss_polygon_to_shape("60 5 60 6 61 6 61 5 60 5")
    assert polygon.bounds == (5.0, 60.0, 6.0, 61.0)


def test_atom_namespace_is_parseable() -> None:
    root = ET.fromstring(
        """<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>x</title></entry></feed>"""
    )
    assert root.tag.endswith("feed")

