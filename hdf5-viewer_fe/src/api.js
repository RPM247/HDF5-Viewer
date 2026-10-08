import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// --- Session Management ---
let sessionId = sessionStorage.getItem('tenseer_session');
if (!sessionId) {
  sessionId = uuidv4();
  sessionStorage.setItem('tenseer_session', sessionId);
}

// --- Axios Instance ---
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'X-Session-ID': sessionId,
  },
});

// --- API Functions ---

export const fetchFiles = async () => {
  const response = await api.get('/files');
  return response.data;
};

export const fetchStructure = async (filename) => {
  const response = await api.get(`/structure/${filename}`);
  return response.data;
};

/**
 * Fetch a data slice from the backend.
 * @param {string} filename
 * @param {string} path        – dataset path within the file
 * @param {number[]|null} indices – optional array of dimension indices for N-D slicing
 */
export const fetchDataSlice = async (filename, path, indices = null) => {
  const params = new URLSearchParams({ path });
  if (indices && indices.length > 0) {
    params.set('indices', JSON.stringify(indices));
  }
  const response = await api.post(`/data/${filename}?${params.toString()}`);
  return response.data;
};

/** Fetch a pre-computed 50-bin histogram from the backend (NaN-safe). */
export const fetchHistogram = async (filename, path) => {
  const response = await api.post(`/histogram/${filename}?path=${encodeURIComponent(path)}`);
  return response.data;
};

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const deleteFile = async (filename) => {
  const response = await api.delete(`/files/${filename}`);
  return response.data;
};

// Upload Folder (for Zarr)
export const uploadFolder = async (fileList) => {
  const formData = new FormData();
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    formData.append('files', file);
    formData.append('paths', file.webkitRelativePath);
  }
  const response = await api.post('/upload_folder', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};