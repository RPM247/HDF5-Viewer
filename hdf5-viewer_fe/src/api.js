import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// --- Session Management ---
// Retrieve an existing session ID or generate a new one for this browser tab.
// sessionStorage is tab-isolated: a new tab always gets a fresh UUID,
// but reloads within the same tab reuse the existing one.
let sessionId = sessionStorage.getItem('tenseer_session');
if (!sessionId) {
  sessionId = uuidv4();
  sessionStorage.setItem('tenseer_session', sessionId);
}

// --- Axios Instance ---
// All requests automatically carry the session header so the backend
// can route each request to the correct isolated workspace directory.
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

export const fetchDataSlice = async (filename, path) => {
  const response = await api.post(`/data/${filename}?path=${path}`);
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
    // webkitRelativePath contains the full folder structure (e.g., "my_data.zarr/.zgroup")
    formData.append('paths', file.webkitRelativePath);
  }

  const response = await api.post('/upload_folder', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};