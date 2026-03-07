import React, { useState, useRef, useEffect } from 'react';

const MatrixViewer = ({ data }) => {
  if (!data || data.length === 0) return <div style={{ padding: '20px' }}>No Data Available</div>;

  // Handle 1D arrays by wrapping them
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

  const rowHeight = 35;
  const colWidth = 85;
  const overscan = 2; 
  
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
      
      let cellStyle = {
        position: 'absolute',
        top: r * rowHeight,
        left: c * colWidth,
        height: rowHeight,
        width: colWidth,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: '8px',
        borderRight: '1px solid #ddd',
        borderBottom: '1px solid #ddd',
        fontSize: '12px',
        fontFamily: 'monospace',
        boxSizing: 'border-box',
        color: '#111111',
        backgroundColor: '#ffffff'
      };

      if (isHeaderRow && isHeaderCol) {
        content = '#';
        cellStyle.backgroundColor = '#e0e0e0';
        cellStyle.fontWeight = 'bold';
        cellStyle.justifyContent = 'center';
      } else if (isHeaderRow) {
        content = c - 1;
        cellStyle.backgroundColor = '#e0e0e0';
        cellStyle.fontWeight = 'bold';
        cellStyle.justifyContent = 'center';
      } else if (isHeaderCol) {
        content = r - 1;
        cellStyle.backgroundColor = '#e0e0e0';
        cellStyle.fontWeight = 'bold';
        cellStyle.justifyContent = 'center';
      } else {
        const val = rows[r - 1][c - 1];
        content = val === null ? 'NaN' : typeof val === 'number' ? val.toFixed(4) : val;
        cellStyle.color = val === 0 ? '#999999' : '#111111';
      }

      visibleCells.push(
        <div key={`${r}-${c}`} style={cellStyle}>
          {content}
        </div>
      );
    }
  }

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header Info Banner */}
      <div style={{ 
        padding: '12px 20px', 
        fontSize: '13px', 
        color: '#333', 
        backgroundColor: '#f8f9fa', 
        borderBottom: '1px solid #ddd',
        flexShrink: 0
      }}>
        Showing full dataset: <strong>{rowCount} x {colCount}</strong> matrix. 
        <em> (Scroll to view all data)</em>
      </div>
      
      {/* Custom Virtualized Scroll Container */}
      <div 
        ref={containerRef} 
        onScroll={handleScroll}
        style={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative' }}
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