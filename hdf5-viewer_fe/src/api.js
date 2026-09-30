import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const fetchFiles = async () => {
  const response = await axios.get(`${API_URL}/files`);
  return response.data;
};

export const fetchStructure = async (filename) => {
  const response = await axios.get(`${API_URL}/structure/${filename}`);
  return response.data;
};

export const fetchDataSlice = async (filename, path) => {
  const response = await axios.post(`${API_URL}/data/${filename}?path=${path}`);
  return response.data;
};

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await axios.post(`${API_URL}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const deleteFile = async (filename) => {
  const response = await axios.delete(`${API_URL}/files/${filename}`);
  return response.data;
};

// NEW: Upload Folder (for Zarr)
export const uploadFolder = async (fileList) => {
  const formData = new FormData();
  
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    formData.append('files', file);
    // webkitRelativePath contains the full folder structure (e.g., "my_data.zarr/.zgroup")
    formData.append('paths', file.webkitRelativePath);
  }
  
  const response = await axios.post(`${API_URL}/upload_folder`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};