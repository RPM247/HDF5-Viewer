from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import h5py
import numpy as np
import zarr
import os
import shutil
import asyncio
import time
import json
import logging

logger = logging.getLogger("tenseer.sweeper")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
BASE_DIR = "./data"
SUPPORTED_EXTENSIONS = ('.h5', '.npy', '.npz', '.nc', '.mat', '.zarr')
HDF5_EXTENSIONS = ('.h5', '.nc', '.mat')

SWEEPER_INTERVAL_SECONDS = 30 * 60     # every 30 minutes
SESSION_MAX_AGE_SECONDS   = 3 * 60 * 60  # delete sessions idle > 3 hours

# ---------------------------------------------------------------------------
# Sweeper
# ---------------------------------------------------------------------------

async def session_sweeper():
    logger.info("Session sweeper started.")
    while True:
        await asyncio.sleep(SWEEPER_INTERVAL_SECONDS)
        logger.info("Sweeper running...")
        now = time.time()
        try:
            for entry in os.scandir(BASE_DIR):
                if not entry.is_dir(follow_symlinks=False):
                    continue
                age = now - entry.stat().st_mtime
                if age > SESSION_MAX_AGE_SECONDS:
                    try:
                        shutil.rmtree(entry.path)
                        logger.info(f"Deleted stale session: {entry.name} (age={age/3600:.1f}h)")
                    except Exception as exc:
                        logger.warning(f"Could not delete {entry.path}: {exc}")
        except FileNotFoundError:
            pass

# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(BASE_DIR, exist_ok=True)
    task = asyncio.create_task(session_sweeper())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

# ---------------------------------------------------------------------------
# App + CORS
# ---------------------------------------------------------------------------

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://hdf-5-viewer.vercel.app", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ---------------------------------------------------------------------------
# Session dependency
# ---------------------------------------------------------------------------

def get_session_dir(x_session_id: str = Header(...)) -> str:
    safe_id = os.path.basename(x_session_id)
    if not safe_id:
        raise HTTPException(status_code=400, detail="Invalid X-Session-ID header.")
    session_path = os.path.join(BASE_DIR, safe_id)
    os.makedirs(session_path, exist_ok=True)
    return session_path

# ---------------------------------------------------------------------------
# Structure helpers
# ---------------------------------------------------------------------------

def get_h5_structure(item):
    if isinstance(item, h5py.Dataset):
        return {"type": "dataset", "shape": item.shape, "dtype": str(item.dtype), "name": item.name}
    elif isinstance(item, h5py.Group):
        return {"type": "group", "name": item.name, "children": {k: get_h5_structure(v) for k, v in item.items()}}


def get_zarr_structure(item):
    if isinstance(item, zarr.core.Array):
        return {"type": "dataset", "shape": item.shape, "dtype": str(item.dtype), "name": item.name}
    elif isinstance(item, zarr.hierarchy.Group):
        return {"type": "group", "name": item.name, "children": {k: get_zarr_structure(v) for k, v in item.items()}}

# ---------------------------------------------------------------------------
# Shared: open dataset → raw numpy array (for both /data and /histogram)
# ---------------------------------------------------------------------------

def _open_raw_dataset(file_path: str, safe_filename: str, path: str):
    """
    Opens a dataset by path inside the given file and returns it as a
    numpy-compatible array-like (may be an mmap view).
    """
    if safe_filename.endswith('.npy'):
        return np.load(file_path, mmap_mode='r')
    elif safe_filename.endswith('.npz'):
        npz_key = path.lstrip('/')
        with np.load(file_path) as archive:
            return archive[npz_key].copy()   # .copy() so the archive can close
    elif safe_filename.endswith('.zarr'):
        z = zarr.open(file_path, mode='r')
        return z[path]
    elif safe_filename.endswith(HDF5_EXTENSIONS):
        f = h5py.File(file_path, 'r')        # caller must close
        return f[path]
    raise ValueError("Unsupported file type")


def _dynamic_slice(data, shape: tuple, indices: list):
    """
    Dynamically slice a tensor of arbitrary rank using `indices` for the
    leading dimensions, always returning the final 2D (or 1D) spatial slice.

    Example: shape=(10,3,512,512), indices=[2,1] → data[2, 1, :, :]
    """
    ndim = len(shape)
    if ndim <= 2:
        return data[...]

    # How many leading dims to fix
    n_fixed = ndim - 2
    idx = list(indices[:n_fixed])          # use provided indices
    # Pad with zeros if fewer indices than needed
    while len(idx) < n_fixed:
        idx.append(0)

    # Build tuple slice: (i0, i1, ..., :, :)
    sl = tuple(int(i) for i in idx) + (slice(None), slice(None))
    return data[sl]

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    session_dir: str = Depends(get_session_dir),
):
    safe_filename = os.path.basename(file.filename)
    if not safe_filename.endswith(SUPPORTED_EXTENSIONS):
        raise HTTPException(status_code=400, detail=f"Only {SUPPORTED_EXTENSIONS} files are supported.")
    file_path = os.path.join(session_dir, safe_filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"filename": safe_filename, "message": "Upload successful"}


@app.post("/api/upload_folder")
async def upload_folder(
    paths: List[str] = Form(...),
    files: List[UploadFile] = File(...),
    session_dir: str = Depends(get_session_dir),
):
    if not paths or not files:
        raise HTTPException(status_code=400, detail="No files provided")
    root_folder = paths[0].split('/')[0]
    if not root_folder.endswith('.zarr'):
        raise HTTPException(status_code=400, detail="Folder must be a .zarr directory")
    for path, file in zip(paths, files):
        if '..' in path or path.startswith('/'):
            continue
        full_path = os.path.join(session_dir, path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    return {"filename": root_folder, "message": "Folder upload successful"}


@app.get("/api/files")
def list_files(session_dir: str = Depends(get_session_dir)):
    return [f for f in os.listdir(session_dir) if f.endswith(SUPPORTED_EXTENSIONS)]


@app.get("/api/structure/{filename}")
def get_structure(filename: str, session_dir: str = Depends(get_session_dir)):
    safe_filename = os.path.basename(filename)
    path = os.path.join(session_dir, safe_filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found on server.")
    try:
        if safe_filename.endswith('.npy'):
            arr = np.load(path)
            return {"type": "group", "name": "/", "children": {"array_data": {"type": "dataset", "shape": arr.shape, "dtype": str(arr.dtype), "name": "/array_data"}}}
        elif safe_filename.endswith('.npz'):
            with np.load(path) as data:
                children = {}
                for key in data.files:
                    arr = data[key]
                    children[key] = {"type": "dataset", "shape": arr.shape, "dtype": str(arr.dtype), "name": f"/{key}"}
                return {"type": "group", "name": "/", "children": children}
        elif safe_filename.endswith('.zarr'):
            z = zarr.open(path, mode='r')
            return get_zarr_structure(z)
        elif safe_filename.endswith(HDF5_EXTENSIONS):
            with h5py.File(path, 'r') as f:
                return get_h5_structure(f)
    except OSError:
        raise HTTPException(status_code=422, detail="File is unreadable or corrupted.")


@app.post("/api/data/{filename}")
def get_data_slice(
    filename: str,
    path: str,
    session_dir: str = Depends(get_session_dir),
    indices: Optional[str] = Query(default=None),  # JSON-encoded list, e.g. "[2, 0]"
):
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(session_dir, safe_filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server.")

    # Parse indices
    parsed_indices = []
    if indices:
        try:
            parsed_indices = json.loads(indices)
            if not isinstance(parsed_indices, list):
                parsed_indices = []
        except (json.JSONDecodeError, TypeError):
            parsed_indices = []

    try:
        data = _open_raw_dataset(file_path, safe_filename, path)
        shape = tuple(data.shape)
        ndim = len(shape)
        MAX_DIM = 4096

        # Dynamic N-D slicing
        if ndim > 2:
            arr = _dynamic_slice(data, shape, parsed_indices)
        elif ndim == 2:
            arr = data[:min(shape[0], MAX_DIM), :min(shape[1], MAX_DIM)]
        elif ndim == 1:
            arr = data[:min(shape[0], 1000)]
        else:
            arr = data[...]

        arr = np.array(arr)
        original_dtype = str(arr.dtype)
        is_complex = False

        if np.iscomplexobj(arr):
            is_complex = True
            arr = np.abs(arr)

        if arr.dtype in [np.float16]:
            arr = arr.astype(np.float32)
        elif arr.dtype == np.bool_:
            arr = arr.astype(np.int8)

        # --- Statistical metadata (NaN-safe) ---
        float_arr = arr.astype(np.float64)
        valid = float_arr[~np.isnan(float_arr)]
        total = float_arr.size
        nan_count = int(np.isnan(float_arr).sum())
        zero_count = int((float_arr == 0).sum())

        stat_mean       = float(np.mean(valid))       if valid.size > 0 else None
        stat_median     = float(np.median(valid))     if valid.size > 0 else None
        stat_std        = float(np.std(valid))        if valid.size > 0 else None
        nan_pct         = round(nan_count / total * 100, 4) if total > 0 else 0.0
        zero_pct        = round(zero_count / total * 100, 4) if total > 0 else 0.0

        # --- NaN/Inf normalization for JSON ---
        is_nan = np.isnan(arr)
        is_pos_inf = np.isposinf(arr)
        is_neg_inf = np.isneginf(arr)

        arr_clean = arr.astype(object)
        arr_clean[is_nan] = None
        arr_clean[is_pos_inf] = "Infinity"
        arr_clean[is_neg_inf] = "-Infinity"

        return {
            "data": arr_clean.tolist(),
            "min": float(np.nanmin(arr)) if arr.size > 0 else 0.0,
            "max": float(np.nanmax(arr)) if arr.size > 0 else 0.0,
            "original_shape": shape,
            "original_dtype": original_dtype,
            "is_complex": is_complex,
            "note": f"Preview slice: {arr.shape} (Original dtype: {original_dtype})",
            # Statistical metadata
            "mean": stat_mean,
            "median": stat_median,
            "std_dev": stat_std,
            "nan_percentage": nan_pct,
            "zero_percentage": zero_pct,
        }

    except KeyError:
        raise HTTPException(status_code=404, detail=f"Dataset path '{path}' not found in {safe_filename}.")
    except (OSError, ValueError):
        raise HTTPException(status_code=422, detail="Could not read dataset. File may be corrupted.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal processing error: {str(e)}")


@app.post("/api/histogram/{filename}")
def get_histogram(
    filename: str,
    path: str,
    session_dir: str = Depends(get_session_dir),
):
    """
    Computes a 50-bin histogram of the dataset slice on the server.
    NaN values are excluded before binning, so this will never crash
    the browser with a massive array transferred in full.
    """
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(session_dir, safe_filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server.")

    try:
        data = _open_raw_dataset(file_path, safe_filename, path)
        shape = tuple(data.shape)
        ndim = len(shape)
        MAX_DIM = 4096

        # Use same slice logic as /data so the histogram matches what the user sees
        if ndim > 2:
            arr = np.array(_dynamic_slice(data, shape, []))
        elif ndim == 2:
            arr = np.array(data[:min(shape[0], MAX_DIM), :min(shape[1], MAX_DIM)])
        elif ndim == 1:
            arr = np.array(data[:min(shape[0], 1000)])
        else:
            arr = np.array(data[...])

        if np.iscomplexobj(arr):
            arr = np.abs(arr)
        if arr.dtype in [np.float16]:
            arr = arr.astype(np.float32)
        elif arr.dtype == np.bool_:
            arr = arr.astype(np.int8)

        flat = arr.astype(np.float64).ravel()
        valid = flat[~np.isnan(flat)]

        if valid.size == 0:
            raise HTTPException(status_code=422, detail="All values are NaN — cannot compute histogram.")

        counts, bin_edges = np.histogram(valid, bins=50)

        return {
            "bins": bin_edges.tolist(),
            "counts": counts.tolist(),
        }

    except HTTPException:
        raise
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Dataset path '{path}' not found in {safe_filename}.")
    except (OSError, ValueError):
        raise HTTPException(status_code=422, detail="Could not read dataset. File may be corrupted.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal processing error: {str(e)}")


@app.delete("/api/files/{filename}")
def delete_file(filename: str, session_dir: str = Depends(get_session_dir)):
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(session_dir, safe_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    try:
        if os.path.isdir(file_path):
            shutil.rmtree(file_path)
        else:
            os.remove(file_path)
        return {"message": f"File {safe_filename} deleted successfully", "filename": safe_filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not delete file: {str(e)}")

#app.mount("/", StaticFiles(directory="dist", html=True), name="static")