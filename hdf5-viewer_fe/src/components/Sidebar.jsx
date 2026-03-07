import React, { useState, useRef } from 'react';
import { Folder, FileDigit, ChevronRight, ChevronDown, Database, Upload, Trash2 } from 'lucide-react';
import { uploadFile } from '../api';

const TreeNode = ({ node, path, onSelect, selectedPath }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isGroup = node.type === 'group';
  const isSelected = path === selectedPath;

  const handleToggle = (e) => {
    e.stopPropagation();
    if (isGroup) setIsOpen(!isOpen);
    else onSelect(path, node);
  };

  return (
    <div style={{ paddingLeft: '12px' }}>
      <div 
        onClick={handleToggle}
        style={{
          display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '4px',
          backgroundColor: isSelected ? '#e0e7ff' : 'transparent',
          borderRadius: '4px', color: isSelected ? '#3730a3' : '#333'
        }}
      >
        {isGroup && (
          <span style={{ marginRight: '4px' }}>
            {isOpen ? <ChevronDown size={14} color="#333" /> : <ChevronRight size={14} color="#333" />}
          </span>
        )}
        <span style={{ marginRight: '6px' }}>
          {isGroup ? <Folder size={16} color="#d97706" /> : <FileDigit size={16} color="#2563eb" />}
        </span>
        <span style={{ fontSize: '14px', fontFamily: 'monospace' }}>
          {node.name.split('/').pop() || node.name}
        </span>
      </div>

      {isGroup && isOpen && node.children && (
        <div style={{ borderLeft: '1px solid #eee', marginLeft: '7px' }}>
          {Object.entries(node.children).map(([key, childNode]) => (
            <TreeNode key={key} node={childNode} path={childNode.name} onSelect={onSelect} selectedPath={selectedPath} />
          ))}
        </div>
      )}
    </div>
  );
};

const Sidebar = ({ files, structure, onFileSelect, onDatasetSelect, selectedDataset, onUploadSuccess, onFileDelete }) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsUploading(true);
      await uploadFile(file);
      onUploadSuccess(); 
    } catch (err) {
      alert("Failed to upload file: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteClick = (e, filename) => {
    e.stopPropagation(); // Prevents the file from being selected when clicking the trash can
    if (window.confirm(`Are you sure you want to permanently delete "${filename}"?`)) {
      onFileDelete(filename);
    }
  };

  return (
    <div style={{ width: '250px', borderRight: '1px solid #ddd', height: '100vh', overflowY: 'auto', padding: '10px', backgroundColor: '#f8f9fa', color: '#333' }}>
      
      {/* Upload Button Area */}
      <div style={{ marginBottom: '20px' }}>
        <input 
          type="file" 
          accept=".h5,.npy" 
          onChange={handleFileUpload} 
          ref={fileInputRef}
          style={{ display: 'none' }} 
        />
        <button 
          onClick={() => fileInputRef.current.click()}
          disabled={isUploading}
          style={{ 
            width: '100%', padding: '8px', backgroundColor: '#2563eb', color: 'white', 
            border: 'none', borderRadius: '4px', cursor: isUploading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}
        >
          <Upload size={16} />
          {isUploading ? 'Uploading...' : 'Upload File'}
        </button>
      </div>

      <h3 style={{ fontSize: '14px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Files</h3>
      
      {/* File List with Delete Option */}
      <div style={{ marginBottom: '20px' }}>
        {files.map(file => (
          <div 
            key={file} 
            style={{ 
              padding: '6px', display: 'flex', justifyContent: 'space-between', 
              alignItems: 'center', borderRadius: '4px' 
            }}
          >
            <div 
              onClick={() => onFileSelect(file)}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#333', flex: 1 }}
            >
              <Database size={16} /> {file}
            </div>
            
            <button
              onClick={(e) => handleDeleteClick(e, file)}
              style={{ 
                background: 'none', border: 'none', padding: '4px', cursor: 'pointer', 
                color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' 
              }}
              title="Delete File"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {files.length === 0 && <div style={{ fontSize: '12px', color: '#aaa' }}>No files found. Upload one!</div>}
      </div>

      {structure && (
        <>
          <h3 style={{ fontSize: '14px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '20px' }}>Structure</h3>
          <TreeNode node={structure} path={structure.name} onSelect={onDatasetSelect} selectedPath={selectedDataset} />
        </>
      )}
    </div>
  );
};

export default Sidebar;