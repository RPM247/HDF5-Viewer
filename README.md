# HDF5 Viewer

A lightweight HDF5 / NumPy array viewer consisting of a FastAPI backend and a React + Vite frontend. This repository provides server-side endpoints to list, upload, preview, and delete `.h5` and `.npy` files, and a client-side UI to explore datasets in matrix and image views.

---

## Project Overview

- **Summary:** This application lets users upload, browse, preview, and delete HDF5 and NumPy array files. The backend serves hierarchical HDF5 metadata and small preview slices; the frontend renders datasets as a virtualized matrix or an image canvas with composite/mask support.
- **Core features:**
  - File listing, upload, and deletion (server-side file management in `./data`).
  - HDF5 group/dataset structure inspection and JSON serialization.
  - On-demand preview slicing with memory-conscious heuristics (mmap for `.npy`, streaming HDF5 datasets).
  - Frontend UI: file tree, upload button, Matrix viewer (virtualized), Image viewer (canvas-based with composite/mask palettes).

---

## Technical Stack

- **Backend (Python):**
  - `FastAPI` — web framework ([`main.py`](main.py))
  - `uvicorn` — ASGI server (used in `Procfile`)
  - `h5py` — HDF5 reading
  - `numpy` — numerical arrays and conversions
  - `python-multipart` — multipart upload support
- **Frontend (JavaScript / React):**
  - `react`, `react-dom` (React 19)
  - `vite` and `@vitejs/plugin-react` — build/dev tooling
  - `axios` — HTTP client
  - `lucide-react` — icons
  - `react-plotly.js`, `plotly.js`, `ag-grid-*`, `react-window` — included dependencies (some may be unused in the inspected codepaths)
- **Dev / Lint:**
  - `eslint` and related plugins in `hdf5-viewer_fe/package.json`

Files listing of declared dependencies:

- Backend: `requirements.txt` (`fastapi`, `uvicorn`, `h5py`, `numpy`, `python-multipart`)
- Frontend: `hdf5-viewer_fe/package.json` (React, Vite, axios, plotly.js, lucide-react, ag-grid, react-window, etc.)

---

## Architecture & Data Flow

- **High-level architecture:**
  - Single FastAPI backend process that exposes REST endpoints and serves the frontend production build from `dist/` (via `StaticFiles`).
  - React + Vite frontend that calls backend endpoints to list files, fetch HDF5 structure, request preview slices, upload, and delete files.

- **Typical request flows:**
  - `GET /files` — returns filenames under `./data` filtered by `.h5`/`.npy`.
  - `GET /structure/{filename}` — returns nested JSON reflecting HDF5 groups/datasets or synthesized structure for `.npy`.
  - `POST /data/{filename}?path={datasetPath}` — returns a small preview slice appropriate for the dataset dimensionality with `data`, `min`, `max`, `original_shape`, and a `note` describing the preview.
  - `POST /upload` — multipart file upload endpoint writing to `./data`.
  - `DELETE /files/{filename}` — deletes a file from `./data`.

- **Frontend / Backend communication:**
  - Frontend API helpers in `hdf5-viewer_fe/src/api.js` call root-relative endpoints (e.g., `/files`, `/structure/{filename}`, `/data/{filename}`), with an `API_URL` placeholder variable.
  - CORS is enabled in the backend (`allow_origins=["*"]`) for straightforward dev usage.

- **State & caching:**
  - Frontend uses React `useState` for local state. No global store or persistent cache is included.
  - Backend does not use an external cache or DB — it streams from disk and uses `mmap` for `.npy` to reduce memory usage.

---

## Folder Structure

```
.
├─ main.py                # FastAPI app with endpoints
├─ Procfile               # Start command: uvicorn main:app --port $PORT
├─ requirements.txt       # Python dependencies
├─ data/                  # Folder to store .h5 and .npy files (runtime)
├─ hdf5-viewer_fe/        # Frontend React + Vite app
   ├─ package.json
   ├─ vite.config.js
   └─ src/
      ├─ api.js
      ├─ App.jsx
      └─ components/
         ├─ Sidebar.jsx
         ├─ MatrixViewer.jsx
         └─ ImageViewer.jsx
```

- `main.py`: Backend endpoint logic, file IO, preview slicing, static mount.
- `Procfile`: Production process command for platforms like Heroku.
- `requirements.txt`: Backend Python dependencies.
- `data/`: Runtime storage for HDF5/NumPy files.
- `hdf5-viewer_fe/`: Frontend project (React + Vite). Key UI and API client code lives in `src/`.

---

## API Endpoints & Routing

- `POST /upload`
  - Purpose: Accept `.h5` or `.npy` file uploads via multipart/form-data.
  - Request: multipart `file` field
  - Response: `{ "filename": "<name>", "message": "Upload successful" }`

- `GET /files`
  - Purpose: Return list of `.h5`/`.npy` files present in `./data`.
  - Response: `["file1.h5", "file2.npy", ...]`

- `GET /structure/{filename}`
  - Purpose: Return JSON tree of HDF5 groups/datasets or a synthesized dataset description for `.npy`.
  - Response example (HDF5):
    ```json
    { "type": "group", "name": "/", "children": { "grp": { "type":"group", "children": {"dset": {"type":"dataset","shape":[...],"dtype":"float32","name":"/grp/dset"}}}}}
    ```

- `POST /data/{filename}?path={datasetPath}`
  - Purpose: Return a preview slice for the dataset at `path` in `filename`.
  - Response: `{ "data": [...], "min": <float>, "max": <float>, "original_shape": [...], "note": "Preview slice: ..." }`
  - Notes: Server uses heuristics by dimensionality to choose a compact preview slice and converts arrays into JSON-serializable lists.

- `DELETE /files/{filename}`
  - Purpose: Delete the specified file from `./data`.
  - Response: `{ "message": "File <filename> deleted successfully", "filename": "<name>" }`

---

## Data Models / Storage

- No traditional database or ORM is used.
- Persistent store: file system storage in `data/` for `.h5` and `.npy` files.
- HDF5 model mapping (server-side):
  - `h5py.Group` → `{ "type": "group", "name": "/path", "children": { ... } }`
  - `h5py.Dataset` → `{ "type": "dataset", "shape": [...], "dtype": "<dtype>", "name": "/path/to/dset" }`

---

## Core Business Logic

- `get_h5_structure(item)` in `main.py`:
  - Recursively inspects HDF5 groups and datasets and builds the JSON representation used by the frontend tree view.

- `POST /data/{filename}` preview logic in `main.py`:
  - Uses `mmap_mode='r'` for `.npy` to read from disk without loading whole file into memory.
  - Uses `h5py.File(..., 'r')` to access datasets lazily.
  - Heuristics by dimension (`ndim`) to select a compact preview slice suitable for browser visualization.
  - Normalizes/handles `float16` and `NaN` for JSON compatibility and returns `min`/`max` for display scaling.

- Frontend renderers:
  - `MatrixViewer.jsx` — custom virtualized grid (absolute-positioned cells and overscan) for rendering numeric matrices with headers.
  - `ImageViewer.jsx` — canvas-based renderer supporting:
    - single-band grayscale normalization,
    - multi-band composites (true/false color via channel selection and normalization),
    - discrete mask rendering with a 6-class color palette for segmentation/change-detection masks.

---

## Environment & Setup

- **Environment variables referenced:**
  - `PORT` — used by `Procfile` for server port in platform deployments.
  - `API_URL` — placeholder constant in `hdf5-viewer_fe/src/api.js` (currently `''`) if you prefer to explicitly set backend origin in the frontend.

- **Local dev setup (recommended):**

1. Backend: create and activate virtual environment, install dependencies, and run the server:

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# Unix
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8081
```

2. Frontend (in a separate terminal):

```bash
cd hdf5-viewer_fe
npm install
npm run dev
# or build for production
npm run build
```

3. Production (serve built frontend from backend):

```bash
cd hdf5-viewer_fe
npm run build
# Ensure 'dist' is available to the backend working dir (copy or build in backend root)
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## Notable Files Reference

- `main.py` — Backend API and static file mount
- `requirements.txt` — Backend dependencies
- `Procfile` — `uvicorn main:app --host 0.0.0.0 --port $PORT`
- `hdf5-viewer_fe/package.json` — Frontend dependencies & scripts
- `hdf5-viewer_fe/vite.config.js` — Dev server proxy config
- `hdf5-viewer_fe/src/api.js` — Frontend API wrappers
- `hdf5-viewer_fe/src/App.jsx` — Top-level UI orchestration
- `hdf5-viewer_fe/src/components/Sidebar.jsx` — File list / upload / tree navigation
- `hdf5-viewer_fe/src/components/MatrixViewer.jsx` — Matrix rendering
- `hdf5-viewer_fe/src/components/ImageViewer.jsx` — Image/mask rendering

---

## Observations & Recommended Improvements

- Fix dev proxy / API usage: `vite.config.js` proxies `/api` → backend, but `api.js` calls root-relative endpoints. To avoid confusion set `API_URL` or prefix calls with `/api` in dev.
- Harden security in production: restrict `CORS`, validate uploaded filenames, and sanitize paths to avoid path traversal.
- Consider server-side tiling or image encoding for very large image previews, and optional caching for frequent slices.
- Add automated tests for `get_h5_structure` and `get_data_slice`, plus E2E tests for upload→preview→delete workflows.

---

If you want, I can also:
- Create a `Dockerfile` and `.env.example` for deployment.
- Patch `hdf5-viewer_fe/src/api.js` to read `API_URL` from environment and provide a dev default.

Feel free to tell me which follow-up you'd like me to do next.
