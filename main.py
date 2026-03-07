from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import h5py
import numpy as np
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

# @app.get("/")
# def home():
#     return {"message": "Backend is successfully running!"}

# FIX: Automatically create the data folder if it doesn't exist
os.makedirs(BASE_DIR, exist_ok=True)

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

# NEW: Upload Endpoint
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith(('.h5', '.npy')):
        raise HTTPException(status_code=400, detail="Only .h5 and .npy files are supported.")
    
    file_path = os.path.join(BASE_DIR, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"filename": file.filename, "message": "Upload successful"}

@app.get("/files")
def list_files():
    return [f for f in os.listdir(BASE_DIR) if f.endswith(('.h5', '.npy'))]

@app.get("/structure/{filename}")
def get_structure(filename: str):
    path = os.path.join(BASE_DIR, filename)
    
    if filename.endswith('.npy'):
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
        
    elif filename.endswith('.h5'):
        with h5py.File(path, 'r') as f:
            return get_h5_structure(f)

@app.post("/data/{filename}")
def get_data_slice(filename: str, path: str):
    file_path = os.path.join(BASE_DIR, filename)
    
    try:
        # 1. Open the file efficiently without loading it all into memory
        if filename.endswith('.npy'):
            # mmap_mode='r' reads from disk directly instead of RAM
            data = np.load(file_path, mmap_mode='r') 
        else:
            f = h5py.File(file_path, 'r')
            data = f[path]
            
        # 2. Prevent Memory Overload via Smart Slicing
        shape = data.shape
        ndim = len(shape)
        MAX_DIM = 4096 # Maximum pixels to send to the browser at once
        
        # Grab a preview slice based on how many dimensions the array has
        if ndim == 1:
            arr = data[:min(shape[0], 1000)]
        elif ndim == 2:
            arr = data[:min(shape[0], MAX_DIM), :min(shape[1], MAX_DIM)]
        elif ndim == 3:
            # Assumes format (channels/bands, height, width) or (height, width, channels)
            # We take the first channel/frame [0] and a 512x512 crop
            arr = data[0, :min(shape[1], MAX_DIM), :min(shape[2], MAX_DIM)]
        elif ndim == 4:
            # Assumes format (batch, channels, height, width)
            arr = data[0, 0, :min(shape[2], MAX_DIM), :min(shape[3], MAX_DIM)]
        else:
            # Fallback for 0D scalars or weird shapes
            arr = data[...] 
            
        # 3. Convert only the small slice to a standard numpy array
        arr = np.array(arr)

        # 4. Handle Float16 for JSON compatibility
        if arr.dtype == np.float16:
            arr = arr.astype(np.float32)

        return {
            "data": np.where(np.isnan(arr), None, arr).tolist(), 
            "min": float(np.nanmin(arr)), 
            "max": float(np.nanmax(arr)),
            "original_shape": shape, # Send the real shape to the frontend
            "note": f"Preview slice: {arr.shape}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.delete("/files/{filename}")
def delete_file(filename: str):
    file_path = os.path.join(BASE_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    try:
        os.remove(file_path)
        return {"message": f"File {filename} deleted successfully", "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not delete file: {str(e)}")


app.mount("/", StaticFiles(directory="dist", html=True), name="static")