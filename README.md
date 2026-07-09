# SiteForge

SiteForge turns public terrain and elevation data into a rough 3D planning canvas for early architecture ideas.

The first MVP targets Norway-compatible public data. It starts with Kartverket/Geonorge/Hoydedata DTM1 GeoTIFF tiles, generates a simplified bare-earth terrain mesh, displays it in a browser, and lets the user place simple planning volumes.

> SiteForge is for rough planning only. It is not surveying, engineering documentation, or construction-ready geometry.

## MVP Capabilities

- Draw or choose an area on a web map.
- Resolve live Norwegian DTM1 elevation tiles when available.
- Cache source GeoTIFFs and generated project artifacts locally.
- Generate a GLB terrain mesh with attribution metadata.
- View terrain in a Three.js scene with orbit controls and a scale grid.
- Place and edit one rough building volume.
- Save project JSON and export GLB.

## Repo Layout

- `apps/web` - React, MapLibre, and React Three Fiber frontend.
- `apps/api` - FastAPI backend and deterministic terrain pipeline.
- `packages/shared` - shared TypeScript project/data model types.
- `docs` - setup, workflow, licensing, and provider notes.
- `data/cache` - local provider cache, ignored by Git.
- `data/projects` - generated project artifacts, ignored by Git.

## Quick Start

```powershell
npm install
npm run build
```

Backend development should use Python 3.12:

```powershell
py -3.12 -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
python -m pip install -e .\\apps\\api[dev]
npm run api:dev
```

If Python 3.12 is not installed, install it before adding the geospatial dependencies. Raster and projection packages may not provide wheels for newer Python versions immediately.

## Public Data

The initial provider targets the Geonorge Atom feed for Hoydedata DTM1 tiles:

`https://nedlasting.geonorge.no/geonorge/ATOM/hoydedata/datasett/DTM1.atom`

Each generated terrain stores source metadata, license URL, attribution, source CRS, source tile URLs, and a rough-planning accuracy warning.

