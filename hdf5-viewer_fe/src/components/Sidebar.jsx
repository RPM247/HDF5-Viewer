import React, { useState, useRef } from 'react';
// FIXED: Swapped 'Activity' for 'Layers' in the import list
import { Folder, FileDigit, ChevronRight, ChevronDown, Database, Upload, Trash2, FolderUp, Layers } from 'lucide-react';
import { uploadFile, uploadFolder } from '../api';

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
    <div className="pl-3 py-0.5">
      <div 
        onClick={handleToggle}
        className={`flex items-center cursor-pointer py-1.5 px-2 rounded-md transition-colors ${
          isSelected ? 'bg-brand-500/20 text-brand-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
        }`}
      >
        {isGroup && (
          <span className="mr-1">
            {isOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
          </span>
        )}
        {!isGroup && <span className="mr-3 ml-1 w-1 h-1 rounded-full bg-slate-600"></span>}
        <span className="mr-2">
          {isGroup ? <Folder size={14} className="text-amber-500/70" /> : <FileDigit size={14} className={isSelected ? 'text-brand-400' : 'text-slate-500'} />}
        </span>
        <span className="text-xs font-mono truncate font-medium tracking-wide">
          {node.name.split('/').pop() || node.name}
        </span>
      </div>

      {isGroup && isOpen && node.children && (
        <div className="border-l border-white/10 ml-2 mt-1 mb-1">
          {Object.entries(node.children).map(([key, childNode]) => (
            <TreeNode key={key} node={childNode} path={childNode.name} onSelect={onSelect} selectedPath={selectedPath} />
          ))}
        </div>
      )}
    </div>
  );
};

const Sidebar = ({ files, currentFile, structure, onFileSelect, onDatasetSelect, selectedDataset, onUploadSuccess, onFileDelete, onNavigateHome }) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setIsUploading(true);
      await uploadFile(file);
      onUploadSuccess(); 
    } catch (err) {
      alert("Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFolderUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const rootName = files[0].webkitRelativePath.split('/')[0];
    if (!rootName.endsWith('.zarr')) return alert("Select a valid .zarr folder.");
    
    try {
      setIsUploading(true);
      await uploadFolder(files);
      onUploadSuccess();
    } catch (err) {
      alert("Failed to upload folder");
    } finally {
      setIsUploading(false);
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  const handleDeleteClick = (e, filename) => {
    e.stopPropagation(); 
    if (window.confirm(`Delete "${filename}" forever?`)) {
      onFileDelete(filename);
    }
  };

  return (
    <div className="w-[300px] bg-[#0a0a0a] h-full flex flex-col">
      
      {/* Brand Header */}
      <div 
        onClick={onNavigateHome}
        className="p-6 flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
      >
        <div className="bg-brand-500 p-1.5 rounded-lg shadow-lg shadow-brand-500/20">
          <Layers className="w-4 h-4 text-surface-900" />
        </div>
        <span className="font-bold tracking-tight text-white text-lg">TenSeer</span>
      </div>
      
      <div className="px-6 flex flex-col gap-3 mb-8">
        <input type="file" accept=".h5,.npy,.npz,.nc,.mat" onChange={handleFileUpload} ref={fileInputRef} className="hidden" />
        <button 
          onClick={() => fileInputRef.current.click()}
          disabled={isUploading}
          className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all shadow-sm"
        >
          <Upload size={16} className="text-slate-400" />
          {isUploading ? 'Uploading...' : 'Upload File'}
        </button>

        <input type="file" webkitdirectory="true" directory="true" multiple onChange={handleFolderUpload} ref={folderInputRef} className="hidden" />
        <button 
          onClick={() => folderInputRef.current.click()}
          disabled={isUploading}
          className="w-full py-2.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all shadow-sm"
        >
          <FolderUp size={16} />
          {isUploading ? 'Uploading...' : 'Upload .zarr'}
        </button>
      </div>

      <div className="px-4 flex-1 overflow-y-auto pb-6">
        <h3 className="px-2 text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-4">Workspace Data</h3>
        <div className="flex flex-col gap-1.5">
          {files.map(file => {
            const isActive = currentFile === file;
            return (
              <div key={file} className="flex flex-col">
                {/* File Row */}
                <div 
                  onClick={() => onFileSelect(file)}
                  className={`flex justify-between items-center px-3 py-2.5 rounded-lg group transition-all cursor-pointer border ${
                    isActive 
                      ? 'bg-white/5 border-white/10 shadow-sm' 
                      : 'border-transparent hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-3 text-sm text-slate-400 group-hover:text-slate-200 flex-1 overflow-hidden">
                    {isActive ? <ChevronDown size={14} className="text-slate-500 shrink-0"/> : <ChevronRight size={14} className="text-slate-600 shrink-0 transition-transform group-hover:translate-x-0.5"/>}
                    <Database size={14} className={isActive ? "text-brand-400 shrink-0" : "text-slate-600 shrink-0"} /> 
                    <span className={`truncate ${isActive ? "text-slate-200 font-medium" : ""}`}>{file}</span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteClick(e, file)}
                    className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-md transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Inline Structure Expansion */}
                {isActive && structure && (
                  <div className="mt-1 ml-3 pl-3 border-l border-white/5 py-2">
                    <TreeNode node={structure} path={structure.name} onSelect={onDatasetSelect} selectedPath={selectedDataset} />
                  </div>
                )}
              </div>
            );
          })}
          {files.length === 0 && <div className="text-xs text-slate-600 italic px-2 mt-2">Workspace is empty.</div>}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;