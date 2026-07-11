from pathlib import Path

from siteforge_api.services.data_status import demo_area_data_status
from siteforge_api.settings import Settings


def test_demo_area_data_status_lists_mvp_sources(tmp_path: Path) -> None:
    status = demo_area_data_status(Settings(data_dir=tmp_path))

    assert status.id == "norway-demo-area"
    assert {source.kind for source in status.sources} == {"map", "dtm", "surface", "imagery"}
    assert next(source for source in status.sources if source.kind == "dtm").status == "live"
    imagery = next(source for source in status.sources if source.kind == "imagery")
    assert imagery.status == "fallback"


def test_demo_area_data_status_reports_cached_dtm(tmp_path: Path) -> None:
    cache = tmp_path / "cache" / "hoydedata-dtm1"
    cache.mkdir(parents=True)
    (cache / "sample.tif").write_bytes(b"not-a-real-tif-for-status-test")

    status = demo_area_data_status(Settings(data_dir=tmp_path))

    dtm = next(source for source in status.sources if source.kind == "dtm")
    assert dtm.status == "cached"
    assert "1 cached" in dtm.note
