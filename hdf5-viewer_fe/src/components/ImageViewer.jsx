import React, { useRef, useEffect, useState, useMemo } from 'react';
import { ZoomIn, RotateCcw, Download } from 'lucide-react';

// --- DYNAMIC COLOR GENERATION ENGINE ---
const colorCache = new Map();
// Force Class 0 to be transparent (Standard for NoData/Background)
colorCache.set(0, [0, 0, 0, 0]);

const hslToRgba = (h, s, l) => {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h / 360 + 1 / 3);
    g = hue2rgb(p, q, h / 360);
    b = hue2rgb(p, q, h / 360 - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), 255];
};

export const getDynamicColor = (val) => {
  if (colorCache.has(val)) return colorCache.get(val);
  // Golden Angle Approximation (137.508 degrees) ensures distinct colors for sequential classes
  const hue = (val * 137.508) % 360;
  const color = hslToRgba(hue, 0.75, 0.55);
  colorCache.set(val, color);
  return color;
};
// ---------------------------------------

/** Converts [r,g,b,a] to a css rgba() string. */
const toCSS = ([r, g, b, a]) => `rgba(${r},${g},${b},${a === 0 ? 0 : 1})`;

// ---- Legend sub-components ----

const MaskLegend = ({ uniqueVals }) => (
  <div className="flex flex-col gap-1 overflow-y-auto flex-1 pr-1 custom-scrollbar">
    {uniqueVals.map((val) => {
      const [r, g, b, a] = getDynamicColor(val);
      const css = a === 0 ? 'transparent' : `rgb(${r},${g},${b})`;
      return (
        <div key={val} className="flex items-center gap-2 shrink-0">
          <div
            className="w-3.5 h-3.5 rounded-sm border border-white/10 shrink-0"
            style={{ background: css }}
          />
          <span className="text-[11px] font-mono text-slate-400 truncate">
            {val === 0 ? `${val} (bg)` : `Class ${val}`}
          </span>
        </div>
      );
    })}
  </div>
);

const GrayscaleLegend = ({ min, max }) => (
  <div className="flex flex-col items-center gap-1 flex-1">
    <span className="text-[10px] font-mono text-slate-400">{typeof max === 'number' ? max.toExponential(2) : max}</span>
    <div
      className="w-4 flex-1 rounded border border-white/10"
      style={{ background: 'linear-gradient(to bottom, #ffffff, #000000)' }}
    />
    <span className="text-[10px] font-mono text-slate-400">{typeof min === 'number' ? min.toExponential(2) : min}</span>
  </div>
);

const CompositeLegend = ({ composite, rIdx, gIdx, bIdx }) => {
  const bands =
    composite === 'true_color'
      ? [{ ch: 'R', band: rIdx, color: '#f87171' }, { ch: 'G', band: gIdx, color: '#4ade80' }, { ch: 'B', band: bIdx, color: '#60a5fa' }]
      : [{ ch: 'R', band: rIdx, color: '#f87171', label: 'NIR' }, { ch: 'G', band: gIdx, color: '#4ade80', label: 'Red' }, { ch: 'B', band: bIdx, color: '#60a5fa', label: 'Green' }];
  return (
    <div className="flex flex-col gap-2 flex-1">
      {bands.map(({ ch, band, color, label }) => (
        <div key={ch} className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: color }} />
          <span className="text-[11px] font-mono text-slate-400">
            {ch} = Band {band}{label ? ` (${label})` : ''}
          </span>
        </div>
      ))}
    </div>
  );
};

// ---- Main Component ----

const ImageViewer = ({ data, path, datasetInfo, canvasRef: externalCanvasRef, onDownload }) => {
  const internalCanvasRef = useRef(null);
  // Prefer external ref (from App.jsx) so parent can trigger download
  const canvasRef = externalCanvasRef || internalCanvasRef;

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

  const isMask = path && (path.toLowerCase().includes('mask') || path.toLowerCase().includes('label'));
  const showComposite = is3D && !isMask && C >= 3;

  const rIdx = composite === 'true_color' ? 2 : 3;
  const gIdx = composite === 'true_color' ? 1 : 2;
  const bIdx = composite === 'true_color' ? 0 : 1;

  // Derive unique class values for the mask legend (memoised to avoid re-scanning on every render)
  const uniqueMaskVals = useMemo(() => {
    if (!isMask || !data) return [];
    const flat = Array.isArray(data[0]) ? data.flat(Infinity) : data;
    const seen = new Set();
    for (const v of flat) seen.add(Math.round(v));
    return Array.from(seen).sort((a, b) => a - b);
  }, [data, isMask]);

  // --- Canvas rendering ---
  useEffect(() => {
    if (!data || !canvasRef.current || W === 0 || H === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(W, H);

    if (isMask) {
      const flat = data.flat(Infinity);
      for (let i = 0; i < flat.length; i++) {
        const val = Math.round(flat[i]);
        const color = getDynamicColor(val);
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

      let min = Infinity, max = -Infinity;
      const combined = [...bands[rIdx], ...bands[gIdx], ...bands[bIdx]];
      for (const v of combined) { if (v < min) min = v; if (v > max) max = v; }
      const range = max - min || 1;

      for (let i = 0; i < bands[0].length; i++) {
        imgData.data[i * 4]     = ((bands[rIdx][i] - min) / range) * 255;
        imgData.data[i * 4 + 1] = ((bands[gIdx][i] - min) / range) * 255;
        imgData.data[i * 4 + 2] = ((bands[bIdx][i] - min) / range) * 255;
        imgData.data[i * 4 + 3] = 255;
      }
    } else {
      const flat = data.flat(Infinity);
      let min = Infinity, max = -Infinity;
      for (const v of flat) { if (v < min) min = v; if (v > max) max = v; }
      const range = max - min || 1;
      for (let i = 0; i < flat.length; i++) {
        const pixel = ((flat[i] - min) / range) * 255;
        imgData.data[i * 4] = pixel;
        imgData.data[i * 4 + 1] = pixel;
        imgData.data[i * 4 + 2] = pixel;
        imgData.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [data, path, composite, W, H, rIdx, gIdx, bIdx]);

  // --- Download PNG ---
  const handleDownloadPng = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `${path?.replace(/\//g, '_') || 'canvas'}_render.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

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

        {/* Download PNG */}
        <div className="ml-auto">
          <button
            onClick={handleDownloadPng}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-white hover:bg-surface-800 border border-transparent hover:border-surface-700 transition-all"
            title="Download rendered canvas as PNG"
          >
            <Download size={14} />
            PNG
          </button>
        </div>
      </div>

      {/* Canvas + Legend */}
      <div className="flex-1 overflow-hidden flex">

        {/* Canvas Viewport */}
        <div className="flex-1 overflow-auto bg-black flex justify-center items-center p-8 relative custom-scrollbar">
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

        {/* Legend Panel – docked right */}
        <div className="w-40 shrink-0 flex flex-col gap-3 bg-[#0f0f11] border-l border-surface-800 p-3 overflow-hidden">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Legend</span>

          {isMask && uniqueMaskVals.length > 0 && (
            <MaskLegend uniqueVals={uniqueMaskVals} />
          )}

          {!isMask && !showComposite && (
            <GrayscaleLegend
              min={datasetInfo?.min ?? 0}
              max={datasetInfo?.max ?? 1}
            />
          )}

          {showComposite && (
            <CompositeLegend
              composite={composite}
              rIdx={rIdx}
              gIdx={gIdx}
              bIdx={bIdx}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;