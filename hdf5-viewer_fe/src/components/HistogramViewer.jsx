import React, { useEffect, useState } from 'react';
import Plotly from 'plotly.js-dist-min';
import _factory from 'react-plotly.js/factory';
const createPlotlyComponent = _factory.default || _factory;
const Plot = createPlotlyComponent(Plotly);
import { fetchHistogram } from '../api';
import { BarChart2 } from 'lucide-react';

const HistogramViewer = ({ filename, datasetPath }) => {
  const [histData, setHistData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!filename || !datasetPath) return;
    setLoading(true);
    setError(null);
    setHistData(null);

    fetchHistogram(filename, datasetPath)
      .then((d) => {
        setHistData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || 'Failed to compute histogram.');
        setLoading(false);
      });
  }, [filename, datasetPath]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
          <span className="text-sm font-mono text-slate-500">Computing distribution…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="p-6 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-mono max-w-md text-center">
          {error}
        </div>
      </div>
    );
  }

  if (!histData) return null;

  // Build bin midpoints for x-axis labels
  const { bins, counts } = histData;
  const midpoints = bins.slice(0, -1).map((b, i) => (b + bins[i + 1]) / 2);

  return (
    <div className="flex-1 flex flex-col bg-[#111113] overflow-hidden p-6 gap-4">
      {/* Panel Header */}
      <div className="flex items-center gap-2 text-slate-400">
        <BarChart2 size={16} className="text-brand-400" />
        <span className="text-sm font-medium text-slate-300">Value Distribution</span>
        <span className="ml-auto text-xs font-mono text-slate-600">50 bins · NaN excluded</span>
      </div>

      {/* Plotly Chart */}
      <div className="flex-1 rounded-2xl border border-white/5 bg-black/30 overflow-hidden p-2">
        <Plot
          data={[
            {
              x: midpoints,
              y: counts,
              type: 'bar',
              marker: {
                color: counts.map((_, i) => `hsla(${210 + (i / counts.length) * 60}, 80%, 60%, 0.85)`),
                line: { color: 'rgba(0,0,0,0)', width: 0 },
              },
              hovertemplate: '<b>Value:</b> %{x:.4g}<br><b>Count:</b> %{y:,}<extra></extra>',
            },
          ]}
          layout={{
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#94a3b8', family: 'ui-monospace, monospace', size: 11 },
            xaxis: {
              title: { text: 'Value', standoff: 12, font: { size: 11 } },
              gridcolor: 'rgba(255,255,255,0.04)',
              zerolinecolor: 'rgba(255,255,255,0.08)',
              tickfont: { size: 10 },
            },
            yaxis: {
              title: { text: 'Count', standoff: 8, font: { size: 11 } },
              gridcolor: 'rgba(255,255,255,0.04)',
              zerolinecolor: 'rgba(255,255,255,0.08)',
              tickfont: { size: 10 },
            },
            margin: { l: 60, r: 24, t: 16, b: 60 },
            bargap: 0.05,
            showlegend: false,
          }}
          config={{
            displayModeBar: false,
            responsive: true,
          }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>
    </div>
  );
};

export default HistogramViewer;
