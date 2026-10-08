import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronRight, Database, Layers, Zap, Code, Cpu, FileCode,
  Github, Linkedin, Download, BarChart2,
} from 'lucide-react';
import Sidebar from './components/Sidebar';
import MatrixViewer from './components/MatrixViewer';
import ImageViewer from './components/ImageViewer';
import HistogramViewer from './components/HistogramViewer';
import { fetchFiles, fetchStructure, fetchDataSlice, deleteFile } from './api';

// ─────────────────────────────────────────────────────────────────────────────
// Home / Landing Page
// ─────────────────────────────────────────────────────────────────────────────
const Home = () => {
  const navigate = useNavigate();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
  };

  return (
    <div className="min-h-screen bg-surface-900 relative overflow-x-hidden font-sans selection:bg-brand-500/30 text-slate-300">
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-40 mix-blend-overlay" />
      <div className="absolute top-[-20%] left-[20%] w-[60%] h-[60%] bg-brand-500/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[150px] rounded-full pointer-events-none" />

      <nav className="w-full px-8 py-6 flex justify-between items-center z-20 relative max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">TenSeer</span>
        </div>
        <button
          onClick={() => navigate('/app')}
          className="px-5 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-white transition-all"
        >
          Open App
        </button>
      </nav>

      <main className="max-w-7xl mx-auto px-6 pt-24 pb-32 relative z-10">
        <motion.div variants={containerVariants} initial="hidden" animate="show"
          className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-brand-400 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
            TenSeer Engine v2.0
          </motion.div>

          <motion.h1 variants={itemVariants} className="text-6xl md:text-8xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-8 leading-[1.1]">
            Visualize datasets.<br />Without the code.
          </motion.h1>

          <motion.p variants={itemVariants} className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 font-light leading-relaxed">
            The memory-safe, zero-config browser viewer for massive scientific arrays.
            Instantly unpack HDF5, Zarr, and NumPy data without writing a single line of matplotlib or throwaway scripts.
          </motion.p>

          <motion.button
            variants={itemVariants}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/app')}
            className="group flex items-center gap-3 px-8 py-4 bg-white text-surface-900 rounded-full font-semibold text-lg hover:bg-slate-200 transition-all shadow-[0_0_40px_rgba(255,255,255,0.15)]"
          >
            Launch Workspace
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-40"
        >
          <div className="md:col-span-2 p-8 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-md relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-[80px] group-hover:bg-brand-500/20 transition-colors" />
            <Database className="w-8 h-8 text-brand-400 mb-6" />
            <h3 className="text-2xl font-semibold text-white mb-3 tracking-tight">Universal Architecture</h3>
            <p className="text-slate-400 mb-6 font-light">Natively parses the most demanding structural formats in modern machine learning and earth sciences.</p>
            <div className="flex flex-wrap gap-2">
              {['.h5', '.npy', '.npz', '.nc (NetCDF4)', '.mat (v7.3)', '.zarr'].map(ext => (
                <span key={ext} className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-sm font-mono text-slate-300">{ext}</span>
              ))}
            </div>
          </div>

          <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-md">
            <Zap className="w-8 h-8 text-amber-400 mb-6" />
            <h3 className="text-2xl font-semibold text-white mb-3 tracking-tight">Zero-Memory Slicing</h3>
            <p className="text-slate-400 font-light text-sm leading-relaxed">
              Never crash your browser again. TenSeer utilizes intelligent <code>mmap</code> heuristics to stream fractional previews of 100GB+ files instantly.
            </p>
          </div>

          <div className="md:col-span-3 p-8 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-md flex flex-col md:flex-row gap-8 items-center">
            <div className="flex-1">
              <Cpu className="w-8 h-8 text-purple-400 mb-6" />
              <h3 className="text-2xl font-semibold text-white mb-3 tracking-tight">Complex Type Safe</h3>
              <p className="text-slate-400 font-light">
                Standard JSON breaks on half-precision and complex numbers. TenSeer's backend normalization layer automatically casts volatile types for flawless rendering.
              </p>
            </div>
            <div className="flex-1 w-full grid grid-cols-2 gap-3">
              {[
                { name: 'Half Precision', val: 'float16, fp8' },
                { name: 'Standard Float', val: 'float32, float64' },
                { name: 'Complex Numbers', val: 'complex64, complex128' },
                { name: 'Logic Masks', val: 'bool, uint8' },
              ].map(type => (
                <div key={type.name} className="p-4 rounded-xl bg-black/40 border border-white/5">
                  <div className="text-xs text-slate-500 mb-1">{type.name}</div>
                  <div className="font-mono text-sm text-brand-300">{type.val}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </main>

      <footer className="border-t border-white/10 bg-black/20 backdrop-blur-lg relative z-20">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-brand-500 flex items-center justify-center"><Layers className="w-3 h-3 text-white" /></div>
            <span className="font-semibold text-white tracking-tight">TenSeer</span>
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            Designed &amp; Developed by <span className="text-white font-medium">RPM</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://github.com/RPM247" className="text-slate-500 hover:text-white transition-colors"><Github className="w-5 h-5" /></a>
            <a href="https://www.linkedin.com/in/priyanshu-rami-271824312" className="text-slate-500 hover:text-blue-400 transition-colors"><Linkedin className="w-5 h-5" /></a>
          </div>
        </div>
      </footer>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Statistic Pill
// ─────────────────────────────────────────────────────────────────────────────
const StatPill = ({ label, value, color = 'text-slate-300' }) => (
  <div className="flex flex-col items-center px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5 min-w-[90px]">
    <span className={`text-sm font-mono font-semibold ${color}`}>
      {value !== null && value !== undefined ? value : '—'}
    </span>
    <span className="text-[10px] uppercase tracking-widest text-slate-600 mt-0.5">{label}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// N-D Sliders
// ─────────────────────────────────────────────────────────────────────────────
const NDSliders = ({ shape, indices, onIndicesChange }) => {
  // Show sliders only for dimensions > 2 (first N-2 dims)
  const highDims = shape.slice(0, -2); // everything except the last two spatial dims
  if (highDims.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-4 px-6 py-3 border-b border-white/5 bg-black/20">
      {highDims.map((size, dimIdx) => (
        <div key={dimIdx} className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-slate-500 shrink-0">Dim {dimIdx}</span>
          <input
            type="range"
            min={0}
            max={size - 1}
            step={1}
            value={indices[dimIdx] ?? 0}
            onChange={(e) => {
              const next = [...indices];
              next[dimIdx] = Number(e.target.value);
              onIndicesChange(next);
            }}
            className="w-28 accent-brand-500 cursor-pointer"
          />
          <span className="text-[11px] font-mono text-brand-400 w-8 text-right">
            {indices[dimIdx] ?? 0}
          </span>
          <span className="text-[11px] font-mono text-slate-600">/ {size - 1}</span>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Workspace
// ─────────────────────────────────────────────────────────────────────────────
const Workspace = () => {
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [structure, setStructure] = useState(null);
  const [datasetPath, setDatasetPath] = useState(null);

  const [datasetData, setDatasetData] = useState(null);
  const [datasetInfo, setDatasetInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('matrix');

  // N-D slider state: array of indices for all higher dims
  const [ndIndices, setNdIndices] = useState([]);
  const [isRefetching, setIsRefetching] = useState(false);

  // Canvas ref shared with ImageViewer (for PNG download)
  const imageCanvasRef = useRef(null);

  const navigate = useNavigate();

  const loadFiles = () => fetchFiles().then(setFiles).catch(console.error);

  useEffect(() => { loadFiles(); }, []);

  const handleFileSelect = async (filename) => {
    if (currentFile === filename) {
      setCurrentFile(null); setStructure(null); setDatasetPath(null);
      setDatasetData(null); setDatasetInfo(null); setNdIndices([]);
    } else {
      setCurrentFile(filename);
      const struct = await fetchStructure(filename);
      setStructure(struct);
      setDatasetPath(null); setDatasetData(null); setDatasetInfo(null); setNdIndices([]);
    }
  };

  // Core load function, reusable for both first-load and slider refetch
  const loadDataset = useCallback(async (file, path, indices) => {
    setIsRefetching(true);
    try {
      const result = await fetchDataSlice(file, path, indices.length ? indices : null);
      setDatasetData(result.data);
      setDatasetInfo({
        original_shape: result.original_shape,
        original_dtype: result.original_dtype,
        is_complex: result.is_complex,
        note: result.note,
        min: result.min,
        max: result.max,
        mean: result.mean,
        median: result.median,
        std_dev: result.std_dev,
        nan_percentage: result.nan_percentage,
        zero_percentage: result.zero_percentage,
      });
    } catch (err) {
      console.error('Failed to load dataset', err);
      alert('Error loading dataset. Check backend console.');
    } finally {
      setIsRefetching(false);
    }
  }, []);

  const handleDatasetSelect = async (path, nodeInfo) => {
    setDatasetPath(path);
    if (nodeInfo.type === 'dataset') {
      setDatasetData(null);
      setDatasetInfo(null);
      setNdIndices([]);
      await loadDataset(currentFile, path, []);
    }
  };

  // Called when an N-D slider changes
  const handleNdSliderChange = useCallback((newIndices) => {
    setNdIndices(newIndices);
    loadDataset(currentFile, datasetPath, newIndices);
  }, [currentFile, datasetPath, loadDataset]);

  const handleFileDelete = async (filename) => {
    try {
      await deleteFile(filename);
      if (filename === currentFile) {
        setCurrentFile(null); setStructure(null); setDatasetPath(null);
        setDatasetData(null); setDatasetInfo(null); setNdIndices([]);
      }
      loadFiles();
    } catch (err) {
      console.error('Failed to delete file', err);
      alert('Error deleting file.');
    }
  };

  // ── Download CSV (matrix tab) ──
  const handleDownloadCSV = () => {
    if (!datasetData) return;
    const rows = Array.isArray(datasetData[0]) ? datasetData : [datasetData];
    const csv = rows.map(r => r.map(v => (v === null ? 'NaN' : v)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${datasetPath?.replace(/\//g, '_') || 'data'}_slice.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Shape detection for ND sliders ──
  const shape = datasetInfo?.original_shape ?? [];
  const hasHigherDims = shape.length > 2;

  const fmtStat = (v, decimals = 4) =>
    v !== null && v !== undefined ? Number(v).toFixed(decimals) : '—';

  return (
    <div className="flex h-screen w-full bg-[#0a0a0a] text-slate-200 overflow-hidden font-sans">
      <Sidebar
        files={files || []}
        currentFile={currentFile}
        structure={structure}
        onFileSelect={handleFileSelect}
        onDatasetSelect={handleDatasetSelect}
        selectedDataset={datasetPath}
        onUploadSuccess={loadFiles}
        onFileDelete={handleFileDelete}
        onNavigateHome={() => navigate('/')}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-[#111113] shadow-[-10px_0_30px_rgba(0,0,0,0.8)] z-10 border-l border-white/5 overflow-hidden rounded-l-3xl my-2 mr-2">
        {!datasetPath ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 bg-grid-pattern opacity-60">
            <Code className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg font-light tracking-wide">Select a dataset array to inspect</p>
          </div>
        ) : !datasetData ? (
          <div className="flex-1 flex items-center justify-center bg-[#111113]">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
              <span className="text-sm font-mono text-slate-500">Streaming slice…</span>
            </div>
          </div>
        ) : (
          <>
            {/* ── Glassmorphism Header ── */}
            <div className="flex-none px-6 py-4 bg-[#111113]/90 backdrop-blur-md border-b border-white/5 flex flex-col gap-3 relative z-20">

              {/* Row 1: breadcrumb + badges + download */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 font-mono text-sm">
                  <FileCode className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-400">{currentFile}</span>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                  <span className="text-brand-400 font-medium">{datasetPath}</span>
                </div>

                <div className="flex items-center gap-2">
                  {isRefetching && (
                    <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  )}
                  <span className="px-2.5 py-1 text-xs font-mono font-medium rounded bg-white/5 text-slate-400 border border-white/10">
                    {shape.length ? `[${shape.join(', ')}]` : 'N/A'}
                  </span>
                  <span className={`px-2.5 py-1 text-xs font-mono font-semibold rounded border ${
                    datasetInfo.original_dtype.includes('float16') ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                    datasetInfo.is_complex ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    datasetInfo.original_dtype.includes('bool') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    'bg-brand-500/10 text-brand-400 border-brand-500/20'
                  }`}>
                    {datasetInfo.original_dtype}
                  </span>
                  {datasetInfo.is_complex && (
                    <span className="px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      Mag |Z|
                    </span>
                  )}

                  {/* Download button */}
                  <button
                    onClick={activeTab === 'matrix' ? handleDownloadCSV : undefined}
                    title={activeTab === 'matrix' ? 'Download CSV' : 'Use the PNG button inside the Canvas tab'}
                    disabled={activeTab !== 'matrix'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-white hover:bg-surface-800 border border-transparent hover:border-surface-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Download size={14} />
                    {activeTab === 'matrix' ? 'CSV' : 'PNG ↗'}
                  </button>
                </div>
              </div>

              {/* Row 2: Stats row */}
              {datasetInfo.mean !== undefined && (
                <div className="flex items-center gap-2 flex-wrap">
                  <StatPill label="Mean"   value={fmtStat(datasetInfo.mean)}   color="text-brand-300" />
                  <StatPill label="Median" value={fmtStat(datasetInfo.median)} color="text-slate-300" />
                  <StatPill label="Std Dev" value={fmtStat(datasetInfo.std_dev)} color="text-purple-300" />
                  <StatPill label="NaN %" value={fmtStat(datasetInfo.nan_percentage, 2) + '%'} color="text-red-400" />
                  <StatPill label="Zero %" value={fmtStat(datasetInfo.zero_percentage, 2) + '%'} color="text-amber-400" />
                </div>
              )}

              {/* Row 3: Tab switcher */}
              <div className="flex items-center gap-1 bg-[#0a0a0a] p-1 rounded-lg w-max border border-white/5 shadow-inner">
                {[
                  { id: 'matrix', label: 'Data Grid' },
                  { id: 'image',  label: 'Canvas Render' },
                  { id: 'histogram', label: 'Distribution', icon: <BarChart2 size={12} /> },
                ].map(({ id, label, icon }) => (
                  <button
                    key={id}
                    className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === id ? 'bg-[#27272a] text-white shadow' : 'text-slate-500 hover:text-slate-300'
                    }`}
                    onClick={() => setActiveTab(id)}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── N-D Sliders (shown when shape has >2 dims) ── */}
            {hasHigherDims && activeTab !== 'histogram' && (
              <NDSliders
                shape={shape}
                indices={ndIndices}
                onIndicesChange={handleNdSliderChange}
              />
            )}

            {/* ── Viewer Panel ── */}
            <div className="flex-1 overflow-hidden bg-[#0a0a0a]">
              {activeTab === 'matrix' && <MatrixViewer data={datasetData} />}
              {activeTab === 'image' && (
                <ImageViewer
                  data={datasetData}
                  path={datasetPath}
                  datasetInfo={datasetInfo}
                  canvasRef={imageCanvasRef}
                />
              )}
              {activeTab === 'histogram' && (
                <HistogramViewer
                  filename={currentFile}
                  datasetPath={datasetPath}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Router root
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/app" element={<Workspace />} />
    </Routes>
  );
}

export default App;