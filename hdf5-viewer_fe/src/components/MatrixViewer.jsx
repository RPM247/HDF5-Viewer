import React, { useState, useRef, useEffect, useCallback } from 'react';
import Plotly from 'plotly.js-dist-min';
import _factory from 'react-plotly.js/factory';
const createPlotlyComponent = _factory.default || _factory;
const Plot = createPlotlyComponent(Plotly);
import { X } from 'lucide-react';

// ---- Line Profile Modal ----
const LineProfileModal = ({ profileData, title, onClose }) => {
  if (!profileData) return null;
  const { labels, values, axisLabel } = profileData;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl w-[700px] max-w-[95vw] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-mono font-semibold text-slate-200">{title}</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Plotly Chart */}
        <Plot
          data={[
            {
              x: labels,
              y: values,
              type: 'scatter',
              mode: 'lines+markers',
              line: { color: '#6366f1', width: 2 },
              marker: { color: '#818cf8', size: 4 },
              name: axisLabel,
            },
          ]}
          layout={{
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#94a3b8', family: 'monospace', size: 11 },
            xaxis: {
              title: { text: axisLabel === 'Row' ? 'Column Index' : 'Row Index', font: { size: 11 } },
              gridcolor: 'rgba(255,255,255,0.05)',
              zerolinecolor: 'rgba(255,255,255,0.1)',
            },
            yaxis: {
              title: { text: 'Value', font: { size: 11 } },
              gridcolor: 'rgba(255,255,255,0.05)',
              zerolinecolor: 'rgba(255,255,255,0.1)',
            },
            margin: { l: 55, r: 20, t: 10, b: 50 },
            showlegend: false,
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: 320 }}
          useResizeHandler
        />
      </div>
    </div>
  );
};

// ---- Main Component ----
const MatrixViewer = ({ data }) => {
  if (!data || data.length === 0)
    return <div className="p-8 text-slate-500 font-mono text-sm">No data arrays to display.</div>;

  const rows = Array.isArray(data[0]) ? data : [data];
  const rowCount = rows.length;
  const colCount = rows[0].length;

  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [profileData, setProfileData] = useState(null);
  const [profileTitle, setProfileTitle] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setViewportSize({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
    setScrollLeft(e.target.scrollLeft);
  };

  // --- Line profiling ---
  const openRowProfile = useCallback((rowIdx) => {
    const vals = rows[rowIdx].map((v) => (v === null ? null : typeof v === 'number' ? v : null));
    const labels = vals.map((_, i) => i);
    setProfileData({ labels, values: vals, axisLabel: 'Row' });
    setProfileTitle(`Row ${rowIdx} — Cross-Section Profile`);
  }, [rows]);

  const openColProfile = useCallback((colIdx) => {
    const vals = rows.map((r) => {
      const v = r[colIdx];
      return v === null ? null : typeof v === 'number' ? v : null;
    });
    const labels = vals.map((_, i) => i);
    setProfileData({ labels, values: vals, axisLabel: 'Col' });
    setProfileTitle(`Column ${colIdx} — Cross-Section Profile`);
  }, [rows]);

  const rowHeight = 36;
  const colWidth = 100;
  const overscan = 4;

  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endRow = Math.min(rowCount + 1, Math.ceil((scrollTop + viewportSize.height) / rowHeight) + overscan);
  const startCol = Math.max(0, Math.floor(scrollLeft / colWidth) - overscan);
  const endCol = Math.min(colCount + 1, Math.ceil((scrollLeft + viewportSize.width) / colWidth) + overscan);

  const visibleCells = [];

  for (let r = startRow; r < endRow; r++) {
    for (let c = startCol; c < endCol; c++) {
      const isHeaderRow = r === 0;
      const isHeaderCol = c === 0;
      let content = '';
      let baseClasses = 'absolute flex items-center text-xs font-mono border-r border-b border-surface-700/50 box-border';
      let clickHandler = undefined;

      if (isHeaderRow && isHeaderCol) {
        content = '';
        baseClasses += ' justify-center bg-surface-900 text-slate-500 font-bold z-20 shadow-[2px_2px_5px_rgba(0,0,0,0.2)]';
      } else if (isHeaderRow) {
        // Clickable column header
        const colIdx = c - 1;
        content = colIdx;
        baseClasses += ' justify-center bg-surface-800/90 backdrop-blur text-slate-400 z-10 font-medium cursor-pointer hover:bg-brand-500/20 hover:text-brand-300 transition-colors select-none';
        clickHandler = () => openColProfile(colIdx);
      } else if (isHeaderCol) {
        // Clickable row header
        const rowIdx = r - 1;
        content = rowIdx;
        baseClasses += ' justify-center bg-surface-800/90 backdrop-blur text-slate-400 z-10 font-medium cursor-pointer hover:bg-brand-500/20 hover:text-brand-300 transition-colors select-none';
        clickHandler = () => openRowProfile(rowIdx);
      } else {
        const val = rows[r - 1][c - 1];
        content = val === null ? 'NaN' : typeof val === 'number' ? val.toFixed(4) : val;

        const isNaNVal = val === null;
        const isZero = val === 0;
        const isString = typeof val === 'string';

        const textColor = isNaNVal ? 'text-red-400/80' : isString ? 'text-amber-400/80' : isZero ? 'text-slate-600' : 'text-slate-300';
        baseClasses += ` justify-end pr-3 bg-transparent ${textColor} hover:bg-surface-700/30 transition-colors`;
      }

      visibleCells.push(
        <div
          key={`${r}-${c}`}
          className={baseClasses}
          style={{ top: r * rowHeight, left: c * colWidth, height: rowHeight, width: colWidth }}
          onClick={clickHandler}
        >
          {content}
        </div>
      );
    }
  }

  return (
    <>
      <div className="h-full w-full flex flex-col bg-[#111113]">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto relative"
        >
          <div
            style={{
              height: (rowCount + 1) * rowHeight,
              width: (colCount + 1) * colWidth,
              position: 'relative',
            }}
          >
            {visibleCells}
          </div>
        </div>
      </div>

      {/* Line Profile Modal */}
      {profileData && (
        <LineProfileModal
          profileData={profileData}
          title={profileTitle}
          onClose={() => setProfileData(null)}
        />
      )}
    </>
  );
};

export default MatrixViewer;