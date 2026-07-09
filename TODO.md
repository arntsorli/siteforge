# SiteForge TODO

Keep each milestone buildable before committing and pushing.

## Milestone 0 - Planning And Repo Hygiene

- [x] Turn user notes into this milestone-based TODO.
- [ ] Keep future completed work summarized in commit messages, not as a long stale TODO archive.

## Milestone 1 - Project Setup, Recent Projects, Save/Load

- [x] Add a start/dashboard view with blank-project and Fortenvegen starter actions.
- [x] Persist projects locally in the browser so the app works before the backend project list exists.
- [x] Save, load, rename, and open recent projects.
- [x] Capture a screenshot/preview image for each project card.
- [x] Keep project cards compact: preview, name, updated time, location/data status, open action.

## Milestone 2 - Fortenvegen Data Workflow And Layer Views

- [x] Make Fortenvegen 100, 2750 Gran the primary preset area.
- [x] Add data-source status cards for map, height/DTM, LiDAR/surface, and satellite/imagery.
- [x] Add layer visibility controls and a split/overlay mode where it helps compare source data.
- [x] Keep a flat terrain plus satellite/map-image fallback path when elevation/LiDAR data is missing.
- [x] Preserve attribution and rough-planning warnings for every source/fallback.

## Milestone 3 - Blank And Default Terrain Modes

- [x] Start blank by default, with a clear action to add a basic terrain model.
- [x] Allow swapping between generated terrain, default terrain, and flat fallback terrain.
- [x] Add simple terrain simulator controls for manual terrain shaping when data is unavailable.

## Milestone 4 - SketchUp-Inspired 3D Planning Tools

- [x] Add smoother 3D editing controls for rough building volumes.
- [x] Add tool modes for select/orbit/pan/place-volume/terrain-adjust.
- [x] Improve object editing ergonomics without turning the MVP into a full CAD/GIS app.

## Milestone 5 - Camera And Orbit Feel

- [x] Increase camera damping and smoothness.
- [x] Use left-click drag to orbit, right-click drag to pan, and wheel to zoom.
- [x] Update the orbit point when orbiting, panning, left-clicking, right-clicking, or zooming.
- [x] Show the orbit point as a small 80% opacity sphere with an HTML label that fades away.

## Milestone 6 - Backend Data Sources

- [x] Harden the Høydedata DTM1 provider around Fortenvegen.
- [x] Add provider placeholders/adapters for LiDAR/surface and satellite/orthophoto data.
- [x] Add API responses that distinguish live data, cached data, and fallback data.
- [x] Add tests for provider status and fallback metadata.
