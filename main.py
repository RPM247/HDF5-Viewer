#from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import h5py
import numpy as np
import zarr
import os
import shutil

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = "./data"
os.makedirs(BASE_DIR, exist_ok=True)

# Define our supported extensions in one place
SUPPORTED_EXTENSIONS = ('.h5', '.npy', '.npz', '.nc', '.mat', '.zarr')
HDF5_EXTENSIONS = ('.h5', '.nc', '.mat')

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

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    safe_filename = os.path.basename(file.filename)
    
    if not safe_filename.endswith(SUPPORTED_EXTENSIONS):
        raise HTTPException(status_code=400, detail=f"Only {SUPPORTED_EXTENSIONS} files are supported.")
    
    file_path = os.path.join(BASE_DIR, safe_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"filename": safe_filename, "message": "Upload successful"}

@app.post("/api/upload_folder")
async def upload_folder(paths: List[str] = Form(...), files: List[UploadFile] = File(...)):
    if not paths or not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    # The root folder name is the first part of the path (e.g. "my_data.zarr")
    root_folder = paths[0].split('/')[0]
    if not root_folder.endswith('.zarr'):
        raise HTTPException(status_code=400, detail="Folder must be a .zarr directory")
        
    for path, file in zip(paths, files):
        # Security: Prevent path traversal
        if '..' in path or path.startswith('/'):
            continue 
            
        full_path = os.path.join(BASE_DIR, path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        with open(full_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
    return {"filename": root_folder, "message": "Folder upload successful"}

@app.get("/api/files")
def list_files():
    return [f for f in os.listdir(BASE_DIR) if f.endswith(SUPPORTED_EXTENSIONS)]

@app.get("/api/structure/{filename}")
def get_structure(filename: str):
    safe_filename = os.path.basename(filename)
    path = os.path.join(BASE_DIR, safe_filename)
    
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
def get_data_slice(filename: str, path: str):
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(BASE_DIR, safe_filename)
    
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
        
        # 1. Slicing logic (unchanged)
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

        # 2. THE NEW NORMALIZATION LAYER
        # Handle Complex Numbers (JSON crashes on '1+2j')
        if np.iscomplexobj(arr):
            is_complex = True
            # Default to showing the Magnitude (absolute value) of the complex number
            arr = np.abs(arr)
            
        # Handle Float16 / Float8 (Cast to standard Float32 for JSON/Browser support)
        if arr.dtype in [np.float16]: 
            # Note: if using ml_dtypes for float8, you'd add those types to this list
            arr = arr.astype(np.float32)
            
        # Handle Booleans (Cast to int for UI rendering)
        elif arr.dtype == np.bool_:
            arr = arr.astype(np.int8)

        # Handle NaNs and Infs safely
        # Evaluate conditions on the numeric array BEFORE inserting None/Strings
        is_nan = np.isnan(arr)
        is_pos_inf = np.isposinf(arr)
        is_neg_inf = np.isneginf(arr)
        
        # Convert to an object array so it can hold numbers, None, and Strings simultaneously
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
def delete_file(filename: str):
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(BASE_DIR, safe_filename)
    
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