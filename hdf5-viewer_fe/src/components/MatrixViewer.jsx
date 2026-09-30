import React, { useState, useRef, useEffect } from 'react';

const MatrixViewer = ({ data }) => {
  if (!data || data.length === 0) return <div className="p-8 text-slate-500 font-mono text-sm">No data arrays to display.</div>;

  const rows = Array.isArray(data[0]) ? data : [data];
  const rowCount = rows.length;
  const colCount = rows[0].length;

  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setViewportSize({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height
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
      
      let baseClasses = "absolute flex items-center text-xs font-mono border-r border-b border-surface-700/50 box-border";
      
      if (isHeaderRow && isHeaderCol) {
        content = '';
        baseClasses += " justify-center bg-surface-900 text-slate-500 font-bold z-20 shadow-[2px_2px_5px_rgba(0,0,0,0.2)]";
      } else if (isHeaderRow) {
        content = c - 1;
        baseClasses += " justify-center bg-surface-800/90 backdrop-blur text-slate-400 z-10 font-medium";
      } else if (isHeaderCol) {
        content = r - 1;
        baseClasses += " justify-center bg-surface-800/90 backdrop-blur text-slate-400 z-10 font-medium";
      } else {
        const val = rows[r - 1][c - 1];
        content = val === null ? 'NaN' : typeof val === 'number' ? val.toFixed(4) : val;
        
        // Data cell specific styling
        const isNaN = val === null;
        const isZero = val === 0;
        const isString = typeof val === 'string'; // Catches "Infinity"
        
        const textColor = isNaN ? "text-red-400/80" : isString ? "text-amber-400/80" : isZero ? "text-slate-600" : "text-slate-300";
        baseClasses += ` justify-end pr-3 bg-transparent ${textColor} hover:bg-surface-700/30 transition-colors`;
      }

      visibleCells.push(
        <div 
          key={`${r}-${c}`} 
          className={baseClasses}
          style={{
            top: r * rowHeight,
            left: c * colWidth,
            height: rowHeight,
            width: colWidth,
          }}
        >
          {content}
        </div>
      );
    }
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#111113]">
      <div 
        ref={containerRef} 
        onScroll={handleScroll}
        className="flex-1 overflow-auto relative"
      >
        <div style={{ 
          height: (rowCount + 1) * rowHeight, 
          width: (colCount + 1) * colWidth,
          position: 'relative'
        }}>
          {visibleCells}
        </div>
      </div>
    </div>
  );
};

export default MatrixViewer;