# Development Setup

## Prerequisites

- Node.js 22 or newer.
- npm 11 or newer.
- Python 3.12 for the backend.
- GitHub CLI for publishing and repo operations.

GDAL and PDAL are not required for the first checked-in code path, but they are expected later for deeper raster and point-cloud workflows.

## Frontend

```powershell
npm install
npm run dev
```

The frontend expects the API at `http://localhost:8000` by default. Override with `VITE_API_BASE_URL`.

## Backend

```powershell
py -3.12 -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
python -m pip install -e .\\apps\\api[dev]
npm run api:dev
```

The backend writes provider cache files to `data/cache` and project artifacts to `data/projects`.

