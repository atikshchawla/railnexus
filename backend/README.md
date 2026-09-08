# RailNexus Backend

FastAPI service layer for RailNexus operational data and the AI/CP-SAT pipeline.

## Run

From the repository root:

```powershell
python -m uvicorn backend.main:app --reload
```

The default database is SQLite at `railnexus.db`. For PostgreSQL, copy the repository root `.env.example` to `.env` and set your private connection string:

```env
RAILNEXUS_DATABASE_URL=postgresql+psycopg2://USERNAME:PASSWORD@HOST:5432/DATABASE
```

Alternatively, configure it for the current PowerShell process with:

```powershell
$env:RAILNEXUS_DATABASE_URL = "postgresql+psycopg2://USERNAME:PASSWORD@HOST:5432/DATABASE"
```

Use `GET /api/db-info` to verify only the configured dialect. It returns `postgresql+psycopg2` or `sqlite`, never the connection string.

## API surface

- `GET /health`
- `GET|POST /api/assets`
- `GET|POST /api/maintenance`
- `PATCH /api/maintenance/{request_id}/status`
- `POST /api/maintenance/{request_id}/predict`
- `GET /api/predictions`
- `GET|POST /api/trains`
- `POST /api/trains/movements`
- `POST /api/shadow-blocks`
- `POST /api/optimizer/optimize`
- `GET /api/topology`
- `GET /api/db-info`

The root `/optimize` and `/shadow-blocks` endpoints remain as compatibility endpoints for the existing AI tests. New application code should use the `/api` routes.

## Data boundary

Operational records are stored in SQLAlchemy models. Raw model features remain inside `maintenance_requests.request_data`; model outputs are stored in `predictions`. CSVs remain training and historical-source artifacts, not one-table-per-file database design.

## Import network topology

After configuring PostgreSQL in the root `.env`, run from the repository root:

```powershell
python -m backend.scripts.import_network_topology
```

The command replaces `network_topology` from `ai_ml/data/raw/network_topology.csv` and verifies the stored row count. It refuses to import into SQLite unless `--allow-sqlite` is explicitly supplied for local testing.
