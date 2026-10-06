import React, { useRef, useEffect, useState } from 'react';
import { ZoomIn, RotateCcw } from 'lucide-react';

const COLOR_MAP = {
  0: [0, 0, 0, 0],       
  1: [239, 68, 68, 255], 
  2: [34, 197, 94, 255], 
  3: [234, 179, 8, 255], 
  4: [6, 182, 212, 255], 
  5: [59, 130, 246, 255] 
};

const ImageViewer = ({ data, path }) => {
  const canvasRef = useRef(null);
  const [composite, setComposite] = useState('false_color'); 
  const [zoom, setZoom] = useState(200);

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
    } else if (is3D && C >= 3) {
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
    } else {
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
    <div className="flex flex-col h-full w-full bg-[#111113]">
      
      {/* Controls Bar */}
      <div className="px-6 py-3 bg-surface-900 border-b border-surface-800 flex gap-8 items-center flex-wrap shadow-md z-10">
        
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2 text-slate-400">
            <ZoomIn size={16} />
            <span className="text-xs font-mono font-medium w-12">{zoom}%</span>
          </div>
          <input 
            type="range" min="50" max="1000" step="50" value={zoom} 
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-32 accent-brand-500 cursor-pointer"
          />
          <button 
            onClick={() => setZoom(100)} 
            className="p-1.5 hover:bg-surface-800 text-slate-500 hover:text-white rounded transition-colors"
            title="Reset Zoom"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {showComposite && (
          <div className="flex gap-3 items-center border-l border-surface-700 pl-8">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Composite</span>
            <select 
              value={composite} 
              onChange={(e) => setComposite(e.target.value)}
              className="bg-surface-800 text-sm text-slate-200 border border-surface-700 rounded-md px-3 py-1.5 focus:outline-none focus:border-brand-500 transition-colors cursor-pointer"
            >
              <option value="false_color">False Color (NIR, R, G)</option>
              <option value="true_color">True Color (RGB)</option>
            </select>
          </div>
        )}
      </div>

      {/* Canvas Viewport */}
      <div className="flex-1 overflow-auto bg-black flex justify-center items-center p-8 relative custom-scrollbar">
        {/* Subtle grid background for transparent masks */}
        {/*<div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>*/}
        
        <canvas 
          ref={canvasRef} 
          width={W} height={H}
          className={`shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-surface-800 transition-all duration-100 ease-linear ${isMask ? 'bg-surface-900' : 'bg-black'}`}
          style={{ 
            imageRendering: 'pixelated', 
            width: `${W * (zoom / 100)}px`,
            height: `${H * (zoom / 100)}px`,
          }} 
        />
      </div>
    </div>
  );
};

export default ImageViewer;