import axios from 'axios';

// Change this to use the proxy we just created!
const API_URL = '/api';

export const fetchFiles = async () => {
  const response = await axios.get(`${API_URL}/files`);
  return response.data;
};

// ... keep the rest of your functions exactly the same ...

export const fetchStructure = async (filename) => {
  const response = await axios.get(`${API_URL}/structure/${filename}`);
  return response.data;
};

export const fetchDataSlice = async (filename, path) => {
  const response = await axios.post(`${API_URL}/data/${filename}?path=${path}`);
  return response.data;
};

// NEW: Upload function
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