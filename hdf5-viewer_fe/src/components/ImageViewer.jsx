import React, { useRef, useEffect, useState } from 'react';

// Exact 6-Class Mapping for Change Detection Masks
const COLOR_MAP = {
  0: [0, 0, 0, 0],         // Stable / NoData (Transparent)
  1: [255, 0, 0, 255],     // Veg Loss (Red)
  2: [0, 255, 0, 255],     // Veg Gain (Green)
  3: [255, 255, 0, 255],   // Urban Gain (Yellow)
  4: [0, 255, 255, 255],   // Water Loss (Cyan)
  5: [0, 0, 255, 255]      // Water Gain (Blue)
};

const ImageViewer = ({ data, path }) => {
  const canvasRef = useRef(null);
  const [composite, setComposite] = useState('false_color'); 
  const [zoom, setZoom] = useState(200); // Default to 200% so it's instantly bigger

  // 1. Detect Dimensions and Shape (Moved outside useEffect so CSS can use W and H)
  const is3D = data && Array.isArray(data[0]) && Array.isArray(data[0][0]);
  let C = 1, H = 0, W = 0, isChannelFirst = true;

  if (is3D) {
    if (data.length <= 15) { 
      C = data.length; H = data[0].length; W = data[0][0].length;
      isChannelFirst = true;
    } else { 
      H = data.length; W = data[0].length; C = data[0][0].length;
      isChannelFirst = false;
    }
  } else if (data) {
    H = data.length; W = data[0]?.length || 0;
  }

  useEffect(() => {
    if (!data || !canvasRef.current || W === 0 || H === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(W, H);
    
    const isMask = path && (path.toLowerCase().includes('mask') || path.toLowerCase().includes('label'));

    // --- MODE A: SEGMENTATION MASK ---
    if (isMask) {
      const flat = data.flat(Infinity); 
      for (let i = 0; i < flat.length; i++) {
        const val = Math.round(flat[i]);
        const color = COLOR_MAP[val] || [255, 255, 255, 255]; 
        
        imgData.data[i * 4] = color[0];
        imgData.data[i * 4 + 1] = color[1];
        imgData.data[i * 4 + 2] = color[2];
        imgData.data[i * 4 + 3] = color[3];
      }
    } 
    // --- MODE B: MULTI-BAND SATELLITE IMAGE ---
    else if (is3D && C >= 3) {
      const bands = [];
      for (let c = 0; c < C; c++) {
        bands.push(isChannelFirst ? data[c].flat() : data.map(row => row.map(pixel => pixel[c])).flat(Infinity));
      }

      const rIdx = composite === 'true_color' ? 2 : 3;
      const gIdx = composite === 'true_color' ? 1 : 2;
      const bIdx = composite === 'true_color' ? 0 : 1;

      let min = Infinity, max = -Infinity;
      const combined = [...bands[rIdx], ...bands[gIdx], ...bands[bIdx]];
      for (let v of combined) { if (v < min) min = v; if (v > max) max = v; }

      for (let i = 0; i < bands[0].length; i++) {
        imgData.data[i * 4] = ((bands[rIdx][i] - min) / (max - min)) * 255;
        imgData.data[i * 4 + 1] = ((bands[gIdx][i] - min) / (max - min)) * 255;
        imgData.data[i * 4 + 2] = ((bands[bIdx][i] - min) / (max - min)) * 255;
        imgData.data[i * 4 + 3] = 255;
      }
    } 
    // --- MODE C: SINGLE BAND GRAYSCALE ---
    else {
      const flat = data.flat(Infinity);
      let min = Infinity, max = -Infinity;
      for (let v of flat) { if (v < min) min = v; if (v > max) max = v; }

      for (let i = 0; i < flat.length; i++) {
          let pixel = ((flat[i] - min) / (max - min)) * 255;
          imgData.data[i * 4] = pixel; imgData.data[i * 4 + 1] = pixel; imgData.data[i * 4 + 2] = pixel; imgData.data[i * 4 + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [data, path, composite, W, H]);

  const isMask = path && (path.toLowerCase().includes('mask') || path.toLowerCase().includes('label'));
  const showComposite = is3D && !isMask && (C >= 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      
      {/* Universal Controls Bar */}
      <div style={{ padding: '10px 20px', backgroundColor: '#fff', borderBottom: '1px solid #ddd', display: 'flex', gap: '30px', alignItems: 'center', flexWrap: 'wrap' }}>
        
        {/* Zoom Controls (Always Visible) */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>Zoom: {zoom}%</label>
          <input 
            type="range" 
            min="50" 
            max="1000" 
            step="50"
            value={zoom} 
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ cursor: 'pointer' }}
          />
          <button 
            onClick={() => setZoom(100)} 
            style={{ padding: '4px 8px', fontSize: '12px', background: '#e5e7eb', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Reset
          </button>
        </div>

        {/* Composite Controls (Only for Multi-band images) */}
        {showComposite && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', borderLeft: '1px solid #ccc', paddingLeft: '30px' }}>
            <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>Composite:</label>
            <select 
              value={composite} 
              onChange={(e) => setComposite(e.target.value)}
              style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc', color: '#333' }}
            >
              <option value="false_color">False Color (NIR, Red, Green)</option>
              <option value="true_color">True Color (RGB)</option>
            </select>
          </div>
        )}
      </div>

      {/* Viewport */}
      <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#e5e7eb', padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <canvas 
          ref={canvasRef} 
          width={W}
          height={H}
          style={{ 
            imageRendering: 'pixelated', 
            backgroundColor: isMask ? '#fff' : '#000', 
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            width: `${W * (zoom / 100)}px`,
            height: `${H * (zoom / 100)}px`,
            transition: 'width 0.1s, height 0.1s' 
          }} 
        />
      </div>
    </div>
  );
};

export default ImageViewer;