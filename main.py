from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import h5py
import numpy as np
import zarr
import os
import shutil
import asyncio
import time
import logging

logger = logging.getLogger("tenseer.sweeper")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
BASE_DIR = "./data"
SUPPORTED_EXTENSIONS = ('.h5', '.npy', '.npz', '.nc', '.mat', '.zarr')
HDF5_EXTENSIONS = ('.h5', '.nc', '.mat')

SWEEPER_INTERVAL_SECONDS = 30 * 60   # run every 30 minutes
SESSION_MAX_AGE_SECONDS   = 3 * 60 * 60  # delete folders idle > 3 hours

# ---------------------------------------------------------------------------
# Sweeper background task
# ---------------------------------------------------------------------------

async def session_sweeper():
    """
    Runs forever while the server is alive.
    Every SWEEPER_INTERVAL_SECONDS it scans BASE_DIR for session sub-folders
    whose mtime is older than SESSION_MAX_AGE_SECONDS and deletes them with
    shutil.rmtree().  shutil.rmtree() handles plain files *and* entire
    directory trees (including nested Zarr stores) in a single call, so
    Zarr directory deletions are handled automatically — no special-casing needed.
    """
    logger.info("Session sweeper started.")
    while True:
        await asyncio.sleep(SWEEPER_INTERVAL_SECONDS)
        logger.info("Sweeper running...")
        now = time.time()
        try:
            for entry in os.scandir(BASE_DIR):
                if not entry.is_dir(follow_symlinks=False):
                    continue
                folder_mtime = entry.stat().st_mtime
                age = now - folder_mtime
                if age > SESSION_MAX_AGE_SECONDS:
                    try:
                        shutil.rmtree(entry.path)
                        logger.info(f"Deleted stale session: {entry.name} (age={age/3600:.1f}h)")
                    except Exception as exc:
                        logger.warning(f"Could not delete {entry.path}: {exc}")
        except FileNotFoundError:
            pass  # BASE_DIR doesn't exist yet — nothing to sweep


# ---------------------------------------------------------------------------
# Lifespan: start sweeper on startup, cancel on shutdown
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
# App
# ---------------------------------------------------------------------------

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://hdf-5-viewer.vercel.app", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],   # "*" already covers X-Session-ID
    expose_headers=["*"],
)


# ---------------------------------------------------------------------------
# Session isolation dependency
# ---------------------------------------------------------------------------

def get_session_dir(x_session_id: str = Header(...)) -> str:
    """
    Extracts X-Session-ID from the request header, sanitises it with
    os.path.basename to strip any path-traversal characters, then creates
    and returns the per-session directory inside BASE_DIR.
    A missing or empty header causes FastAPI to return 422 automatically.
    """
    safe_id = os.path.basename(x_session_id)
    if not safe_id:
        raise HTTPException(status_code=400, detail="Invalid X-Session-ID header.")
    session_path = os.path.join(BASE_DIR, safe_id)
    os.makedirs(session_path, exist_ok=True)
    return session_path


# ---------------------------------------------------------------------------
# Helper: HDF5 / Zarr structure walkers
# ---------------------------------------------------------------------------

def get_h5_structure(item):
    if isinstance(item, h5py.Dataset):
        return {
            "type": "dataset",
            "shape": item.shape,
            "dtype": str(item.dtype),
            "name": item.name
        }
    elif isinstance(item, h5py.Group):
        return {
            "type": "group",
            "name": item.name,
            "children": {k: get_h5_structure(v) for k, v in item.items()}
        }


def get_zarr_structure(item):
    if isinstance(item, zarr.core.Array):
        return {
            "type": "dataset",
            "shape": item.shape,
            "dtype": str(item.dtype),
            "name": item.name
        }
    elif isinstance(item, zarr.hierarchy.Group):
        return {
            "type": "group",
            "name": item.name,
            "children": {k: get_zarr_structure(v) for k, v in item.items()}
        }


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

    # The root folder name is the first part of the relative path (e.g. "my_data.zarr")
    root_folder = paths[0].split('/')[0]
    if not root_folder.endswith('.zarr'):
        raise HTTPException(status_code=400, detail="Folder must be a .zarr directory")

    for path, file in zip(paths, files):
        # Security: prevent path traversal
        if '..' in path or path.startswith('/'):
            continue

        # Construct destination inside the session-isolated folder
        full_path = os.path.join(session_dir, path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        with open(full_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

    return {"filename": root_folder, "message": "Folder upload successful"}


@app.get("/api/files")
def list_files(session_dir: str = Depends(get_session_dir)):
    return [f for f in os.listdir(session_dir) if f.endswith(SUPPORTED_EXTENSIONS)]


@app.get("/api/structure/{filename}")
def get_structure(
    filename: str,
    session_dir: str = Depends(get_session_dir),
):
    safe_filename = os.path.basename(filename)
    path = os.path.join(session_dir, safe_filename)

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found on server.")

    try:
        if safe_filename.endswith('.npy'):
            arr = np.load(path)
            return {
                "type": "group",
                "name": "/",
                "children": {
                    "array_data": {
                        "type": "dataset",
                        "shape": arr.shape,
                        "dtype": str(arr.dtype),
                        "name": "/array_data"
                    }
                }
            }
        elif safe_filename.endswith('.npz'):
            with np.load(path) as data:
                children = {}
                for key in data.files:
                    arr = data[key]
                    children[key] = {
                        "type": "dataset",
                        "shape": arr.shape,
                        "dtype": str(arr.dtype),
                        "name": f"/{key}"
                    }
                return {
                    "type": "group",
                    "name": "/",
                    "children": children
                }
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
):
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(session_dir, safe_filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server.")

    try:
        if safe_filename.endswith('.npy'):
            data = np.load(file_path, mmap_mode='r')
        elif safe_filename.endswith('.npz'):
            npz_key = path.lstrip('/')
            with np.load(file_path) as archive:
                data = archive[npz_key]
        elif safe_filename.endswith('.zarr'):
            z = zarr.open(file_path, mode='r')
            data = z[path]
        elif safe_filename.endswith(HDF5_EXTENSIONS):
            f = h5py.File(file_path, 'r')
            data = f[path]
        else:
            raise ValueError("Unsupported file type")

        shape = data.shape
        ndim = len(shape)
        MAX_DIM = 4096

        if ndim == 1:
            arr = data[:min(shape[0], 1000)]
        elif ndim == 2:
            arr = data[:min(shape[0], MAX_DIM), :min(shape[1], MAX_DIM)]
        elif ndim == 3:
            arr = data[0, :min(shape[1], MAX_DIM), :min(shape[2], MAX_DIM)]
        elif ndim == 4:
            arr = data[0, 0, :min(shape[2], MAX_DIM), :min(shape[3], MAX_DIM)]
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
            "note": f"Preview slice: {arr.shape} (Original dtype: {original_dtype})"
        }

    except KeyError:
        raise HTTPException(status_code=404, detail=f"Dataset path '{path}' not found in {safe_filename}.")
    except (OSError, ValueError):
        raise HTTPException(status_code=422, detail="Could not read dataset. File may be corrupted.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal processing error: {str(e)}")


@app.delete("/api/files/{filename}")
def delete_file(
    filename: str,
    session_dir: str = Depends(get_session_dir),
):
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