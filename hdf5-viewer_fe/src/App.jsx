import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import MatrixViewer from './components/MatrixViewer';
import ImageViewer from './components/ImageViewer';
import { fetchFiles, fetchStructure, fetchDataSlice, deleteFile } from './api';
import './App.css';

function App() {
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [structure, setStructure] = useState(null);
  const [datasetPath, setDatasetPath] = useState(null);
  
  const [datasetData, setDatasetData] = useState(null);
  const [datasetInfo, setDatasetInfo] = useState(null); 
  const [activeTab, setActiveTab] = useState('matrix');

  const loadFiles = () => {
    fetchFiles().then(setFiles).catch(console.error);
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleFileSelect = async (filename) => {
    setCurrentFile(filename);
    const struct = await fetchStructure(filename);
    setStructure(struct);
    setDatasetPath(null);
    setDatasetData(null);
    setDatasetInfo(null);
  };

  const handleDatasetSelect = async (path, nodeInfo) => {
    setDatasetPath(path);
    if (nodeInfo.type === 'dataset') {
      try {
        setDatasetData(null);
        setDatasetInfo(null);
        
        const result = await fetchDataSlice(currentFile, path);
        
        setDatasetData(result.data);
        setDatasetInfo({
          original_shape: result.original_shape,
          note: result.note,
          min: result.min,
          max: result.max
        });
      } catch (err) {
        console.error("Failed to load dataset", err);
        alert("Error loading dataset. Check backend console.");
      }
    }
  };

  const handleFileDelete = async (filename) => {
    try {
      await deleteFile(filename);
      
      // If the user deleted the file they are currently looking at, clear the screen
      if (filename === currentFile) {
        setCurrentFile(null);
        setStructure(null);
        setDatasetPath(null);
        setDatasetData(null);
        setDatasetInfo(null);
      }
      // Refresh the list of files in the sidebar
      loadFiles();
    } catch (err) {
      console.error("Failed to delete file", err);
      alert("Error deleting file. Check console for details.");
    }
  };

  return (
    <div className="app-container">
      <Sidebar 
        files={files} 
        structure={structure} 
        onFileSelect={handleFileSelect}
        onDatasetSelect={handleDatasetSelect}
        selectedDataset={datasetPath}
        onUploadSuccess={loadFiles}
        onFileDelete={handleFileDelete}
      />

      <div className="main-content">
        {!datasetPath ? (
          <div className="empty-state">Select a dataset from the sidebar to view data</div>
        ) : !datasetData ? (
          <div className="empty-state">Loading preview...</div>
        ) : (
          <>
            <div className="toolbar">
              <span className="path-crumb" style={{ color: '#333' }}>{currentFile} :: {datasetPath}</span>
              <div className="tabs">
                <button 
                  className={activeTab === 'matrix' ? 'active' : ''} 
                  onClick={() => setActiveTab('matrix')}
                >
                  Matrix View
                </button>
                <button 
                  className={activeTab === 'image' ? 'active' : ''} 
                  onClick={() => setActiveTab('image')}
                >
                  Image View
                </button>
              </div>
            </div>

            {datasetInfo && (
              <div style={{ 
                padding: '8px 20px', backgroundColor: '#f0f9ff', borderBottom: '1px solid #ddd', 
                fontSize: '12px', color: '#0369a1', display: 'flex', gap: '20px' 
              }}>
                <span><strong>Full Shape:</strong> {datasetInfo.original_shape ? `[${datasetInfo.original_shape.join(', ')}]` : 'N/A'}</span>
                <span><strong>Displaying:</strong> {datasetInfo.note || 'Full Array'}</span>
                <span><strong>Range:</strong> {datasetInfo.min !== undefined ? `${datasetInfo.min.toFixed(4)} to ${datasetInfo.max.toFixed(4)}` : 'N/A'}</span>
              </div>
            )}

            <div className="viewport">
              {activeTab === 'matrix' && <MatrixViewer data={datasetData} />}
              {activeTab === 'image' && <ImageViewer data={datasetData} path={datasetPath} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;