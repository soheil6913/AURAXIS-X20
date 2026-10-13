import React, { useState, useEffect, useMemo } from 'react';
import { ScanRecord, RenderStyle, Anomaly } from '../types';
import { ThreeVisualizer, DepthSliceMode, HeatmapPalette } from './ThreeVisualizer';
import {
  Box,
  Layers,
  Sliders,
  Sparkles,
  Download,
  Save,
  RotateCcw,
  Eye,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileCode,
  Maximize2,
  Flame,
  Activity,
  Play,
  Pause,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface VisualizerTabProps {
  viewedScan: ScanRecord | null;
  onSaveScan: (name: string, notes: string) => void;
  onNavigateToAi: () => void;
  selectedNodeIndex: number | null;
  setSelectedNodeIndex: (idx: number | null) => void;
}

export const VisualizerTab: React.FC<VisualizerTabProps> = ({
  viewedScan,
  onSaveScan,
  onNavigateToAi,
  selectedNodeIndex,
  setSelectedNodeIndex
}) => {
  const [renderStyle, setRenderStyle] = useState<RenderStyle>('3d-mesh');
  const [zScale, setZScale] = useState<number>(1.2);
  const [colorThreshold, setColorThreshold] = useState<number>(0.5);
  const [sliceX, setSliceX] = useState<number | null>(null);
  const [sliceY, setSliceY] = useState<number | null>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [heatmapOpacity, setHeatmapOpacity] = useState<number>(0.72);
  const [heatmapPalette, setHeatmapPalette] = useState<HeatmapPalette>('spectral');

  // Subsurface Depth Slicing State
  const [isDepthSliceOpen, setIsDepthSliceOpen] = useState<boolean>(false);
  const [sliceZ, setSliceZ] = useState<number | null>(null);
  const [sliceZMode, setSliceZMode] = useState<DepthSliceMode>('cut');
  const [depthRange, setDepthRange] = useState<[number, number]>([0.5, 2.5]);
  const [showDepthPlane, setShowDepthPlane] = useState<boolean>(true);
  const [isDepthSweeping, setIsDepthSweeping] = useState<boolean>(false);

  // Auto Depth Sweep Playback Effect
  useEffect(() => {
    let interval: any;
    if (isDepthSweeping && viewedScan) {
      interval = setInterval(() => {
        setSliceZ((prevZ) => {
          const maxD = viewedScan.maxDepthMeters || 3.5;
          const current = prevZ === null ? 0 : prevZ;
          const next = current + 0.1;
          if (next > maxD) return 0;
          return parseFloat(next.toFixed(1));
        });
      }, 220);
    }
    return () => clearInterval(interval);
  }, [isDepthSweeping, viewedScan]);

  // Real-time Anomaly Count at Current Depth Slice
  const activeAnomaliesAtDepth = useMemo(() => {
    if (!viewedScan) return 0;
    if (sliceZ === null && depthRange === null) return 0;

    let count = 0;
    const maxD = viewedScan.maxDepthMeters || 3.5;

    viewedScan.gridData.forEach((adc) => {
      const ptDepth = maxD * (1 - Math.min(Math.max(adc, 0), 1024) / 1024);
      let matches = false;

      if (sliceZMode === 'cut' && sliceZ !== null) {
        matches = ptDepth >= sliceZ;
      } else if (sliceZMode === 'plane' && sliceZ !== null) {
        matches = Math.abs(ptDepth - sliceZ) <= 0.45;
      } else if (sliceZMode === 'band' && depthRange !== null) {
        matches = ptDepth >= depthRange[0] && ptDepth <= depthRange[1];
      }

      if (matches && (adc > 650 || adc < 250)) {
        count++;
      }
    });

    return count;
  }, [viewedScan, sliceZ, sliceZMode, depthRange]);

  // Save Modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveNotes, setSaveNotes] = useState('');

  // Node details
  const [nodeDetails, setNodeDetails] = useState<{
    x: number;
    y: number;
    adc: number;
    phase: number;
    depth: number;
  } | null>(null);

  if (!viewedScan) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-xl">
        <Box className="w-16 h-16 text-amber-400 mx-auto animate-bounce" />
        <h2 className="text-xl font-bold text-white">هیچ اسکن فعالی برای نمایش سه‌بعدی وجود ندارد</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          لطفاً ابتدا یک اسکن زمین جدید در تب «اسکن» ثبت کنید یا یکی از اسکن‌های ذخیره‌شده در تب «تاریخچه» را لود کنید.
        </p>
      </div>
    );
  }

  // Calculate highest anomaly peak & void drop
  let maxAdc = 0;
  let minAdc = 1024;
  let maxAdcIndex = 0;

  viewedScan.gridData.forEach((val, idx) => {
    if (val > maxAdc) {
      maxAdc = val;
      maxAdcIndex = idx;
    }
    if (val < minAdc) {
      minAdc = val;
    }
  });

  const maxX = maxAdcIndex % viewedScan.width;
  const maxY = Math.floor(maxAdcIndex / viewedScan.width);
  const maxPhase = viewedScan.phaseData[maxAdcIndex] ?? 0;

  // Metal vs Cavity Probability
  const isHighMetal = maxAdc > 750 && maxPhase > 20;
  const isDeepCavity = minAdc < 220;

  const handleSelectNode = (idx: number, x: number, y: number, adc: number, phase: number, depth: number) => {
    setSelectedNodeIndex(idx);
    setNodeDetails({ x, y, adc, phase, depth });
  };

  const handleExportCsv = () => {
    let csv = 'X,Y,ADC_Signal,Phase_Shift\n';
    for (let y = 0; y < viewedScan.length; y++) {
      for (let x = 0; x < viewedScan.width; x++) {
        const idx = y * viewedScan.width + x;
        csv += `${x + 1},${y + 1},${viewedScan.gridData[idx]},${viewedScan.phaseData[idx]}\n`;
      }
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${viewedScan.name || 'scan'}_grid.csv`;
    a.click();
  };

  const handleExportJson = () => {
    const json = JSON.stringify(viewedScan, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${viewedScan.name || 'scan'}_raw.json`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Top Banner & Main Quick Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-amber-400 font-mono">{viewedScan.name}</h2>
            <span className="text-xs font-mono px-2 py-0.5 bg-slate-800 text-cyan-400 border border-slate-700 rounded-full">
              {viewedScan.width}×{viewedScan.length} ({viewedScan.soilType})
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            تاریخ اسکن: {viewedScan.date} | سنسور: {viewedScan.sensorType} | الگوی اسکن: {viewedScan.scanPattern}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Send to AI */}
          <button
            onClick={onNavigateToAi}
            className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-cyan-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-400/10 hover:scale-102 transition flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-slate-950" />
            <span>تحلیل هوشمند (AI)</span>
          </button>

          {/* Save Scan Button */}
          <button
            onClick={() => {
              setSaveName(viewedScan.name);
              setShowSaveModal(true);
            }}
            className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-400/30 text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>ذخیره اسکن</span>
          </button>

          {/* Export Dropdown */}
          <button
            onClick={handleExportCsv}
            title="خروجی فایل اکسل CSV"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          </button>
          
          <button
            onClick={handleExportJson}
            title="خروجی Raw JSON"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition"
          >
            <FileCode className="w-4 h-4 text-cyan-400" />
          </button>
        </div>
      </div>

      {/* Evidence Tier Badge & Geophysical Modeling Notice */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="text-xs">
            <span className="text-slate-400">سطح طبقه‌بندی شواهد: </span>
            <span className="font-bold text-white font-mono">
              {viewedScan.anomalies?.[0]?.evidenceTier || (maxAdc > 750 ? '3. Multi-sensor anomaly — further investigation recommended' : '1. No significant anomaly detected')}
            </span>
          </div>
        </div>
        <div className="text-[11px] text-amber-300/90 bg-amber-950/40 border border-amber-500/30 px-3 py-1.5 rounded-xl">
          تذکر فیزیکی: لایه‌ها و عمق سه‌بعدی نمایش‌داده‌شده مدل درون‌یابی گرادیان پتانسیل بوده و جایگزین نمونه‌برداری مستقیم نیست.
        </div>
      </div>

      {/* Main 3D Canvas & Inspector Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Column: 3D Canvas (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* View Mode Controls Toolbar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            
            {/* Render Styles */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {[
                { id: '3d-mesh', label: 'سطحی (Surface)' },
                { id: 'point-cloud', label: 'ابر نقاط (Points)' },
                { id: 'wireframe', label: 'توری (Wireframe)' },
                { id: 'voxel', label: 'مکعبی (Voxel)' }
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setRenderStyle(st.id as RenderStyle)}
                  className={`px-3 py-1.5 rounded-md font-bold transition ${
                    renderStyle === st.id
                      ? 'bg-amber-400 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Z-Scale Multiplier */}
            <div className="flex items-center gap-2 text-slate-300 font-mono">
              <span className="text-amber-400 font-bold">ارتفاع Z:</span>
              <input
                type="range"
                min="0.2"
                max="3.0"
                step="0.1"
                value={zScale}
                onChange={(e) => setZScale(parseFloat(e.target.value))}
                className="w-24 accent-amber-400"
              />
              <span className="w-8 font-bold text-amber-400">{zScale.toFixed(1)}x</span>
            </div>

            {/* Auto Rotate Toggle */}
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`px-3 py-1.5 rounded-lg border font-bold transition flex items-center gap-1.5 ${
                autoRotate
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <RotateCcw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
              <span>چرخش خودکار</span>
            </button>

            {/* Magnetic Intensity Heatmap Overlay Toggle */}
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              title="نقشه حرارتی شدت میدان مغناطیسی (Magnetic Intensity Heatmap)"
              className={`px-3 py-1.5 rounded-lg border font-bold transition flex items-center gap-1.5 ${
                showHeatmap
                  ? 'bg-gradient-to-r from-orange-500 via-rose-500 to-red-600 border-orange-400 text-white shadow-lg shadow-orange-500/25'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
            >
              <Flame className={`w-3.5 h-3.5 ${showHeatmap ? 'text-yellow-200 animate-pulse' : 'text-orange-400'}`} />
              <span>نقشه حرارتی (Heatmap)</span>
              {showHeatmap && (
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-ping" />
              )}
            </button>

            {/* Subsurface Depth Slice Toggle Button */}
            <button
              onClick={() => setIsDepthSliceOpen(!isDepthSliceOpen)}
              title={isDepthSliceOpen ? 'بستن پنل برش عمقی زیرسطحی' : 'باز کردن پنل برش عمقی زیرسطحی'}
              className={`px-3 py-1.5 rounded-lg border font-bold transition flex items-center gap-1.5 ${
                isDepthSliceOpen
                  ? 'bg-gradient-to-r from-cyan-500/25 via-blue-500/20 to-amber-500/20 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
            >
              <Sliders className={`w-3.5 h-3.5 ${sliceZ !== null ? 'text-cyan-400' : 'text-amber-400'}`} />
              <span>برش عمق {sliceZ !== null ? `(${sliceZ.toFixed(1)}m)` : ''}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isDepthSliceOpen ? 'rotate-180 text-cyan-400' : 'text-slate-400'}`} />
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه سه‌بعدی'}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:border-amber-400/50 transition flex items-center gap-1"
            >
              <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">{isFullscreen ? 'بستن تمام‌صفحه' : 'تمام‌صفحه'}</span>
            </button>
          </div>

          {/* Heatmap Intensity & Color Scaling Configuration Panel */}
          {showHeatmap && (
            <div className="bg-slate-900/90 border border-orange-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg font-mono">
              {/* Heatmap Palette Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-orange-400 font-bold flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" />
                  <span>پالت D3:</span>
                </span>
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  {[
                    { id: 'spectral', label: 'Spectral' },
                    { id: 'turbo', label: 'Turbo' },
                    { id: 'inferno', label: 'Inferno' },
                    { id: 'jet', label: 'Jet' }
                  ].map((pal) => (
                    <button
                      key={pal.id}
                      onClick={() => setHeatmapPalette(pal.id as HeatmapPalette)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                        heatmapPalette === pal.id
                          ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {pal.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Semi-transparent Opacity Slider */}
              <div className="flex items-center gap-2 text-slate-300">
                <span className="text-amber-400 font-bold">شفافیت پوشش:</span>
                <input
                  type="range"
                  min="0.15"
                  max="1.0"
                  step="0.05"
                  value={heatmapOpacity}
                  onChange={(e) => setHeatmapOpacity(parseFloat(e.target.value))}
                  className="w-24 accent-orange-400 cursor-pointer"
                />
                <span className="w-10 font-bold text-amber-400">{Math.round(heatmapOpacity * 100)}%</span>
              </div>

              {/* D3 Gradient Bar Legend */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-[10px] text-slate-400">طیف شدت:</span>
                <div
                  className="flex-1 sm:w-36 h-3.5 rounded-lg overflow-hidden border border-slate-700 relative"
                  style={{
                    background:
                      heatmapPalette === 'inferno'
                        ? 'linear-gradient(to right, #000004, #57106e, #bb3754, #f98e09, #fcffa4)'
                        : heatmapPalette === 'turbo'
                        ? 'linear-gradient(to right, #30123b, #1ae4b6, #a2fc3c, #e34309)'
                        : heatmapPalette === 'jet'
                        ? 'linear-gradient(to right, #000080, #00ffff, #ffff00, #ff0000, #800000)'
                        : 'linear-gradient(to right, #1e1b4b, #06b6d4, #10b981, #f59e0b, #ef4444, #ffffff)'
                  }}
                />
                <span className="text-[10px] text-red-400 font-bold">طلا/فلز</span>
              </div>
            </div>
          )}

          {/* WebGL 3D Canvas Engine */}
          <div className={isFullscreen ? 'fixed inset-0 z-50 p-4 bg-slate-950/95 backdrop-blur-md flex flex-col' : 'h-[520px] relative'}>
            {isFullscreen && (
              <div className="flex items-center justify-between pb-3 text-xs text-amber-400 font-bold border-b border-slate-800 mb-2">
                <span>نمای تمام‌صفحه رادار سه‌بعدی ({viewedScan.name})</span>
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="px-3 py-1 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition"
                >
                  ✕ خروج از تمام‌صفحه
                </button>
              </div>
            )}
            <div className="flex-1 w-full h-full min-h-0 relative rounded-2xl overflow-hidden">
              {/* Collapsed Compact Floating Badge - Positioned cleanly on left HUD so right zoom buttons are 100% visible */}
              {!isDepthSliceOpen && (
                <button
                  onClick={() => setIsDepthSliceOpen(true)}
                  title="باز کردن کارت برش عمقی زیرسطحی (Open Depth Slice Panel)"
                  className="absolute top-14 left-3 z-20 flex items-center gap-2 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 hover:border-cyan-400 text-slate-200 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xl transition-all duration-200 pointer-events-auto hover:scale-105 group"
                >
                  <Sliders className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
                  <span>برش عمقی زیرسطحی</span>
                  {sliceZ !== null ? (
                    <span className="text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30">
                      {sliceZ.toFixed(1)}m
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">خاموش</span>
                  )}
                  {isDepthSweeping && (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400 animate-pulse font-mono">
                      <Play className="w-2.5 h-2.5" />
                      <span>پیمایش</span>
                    </span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
                </button>
              )}

              {/* Interactive Floating Subsurface Depth Slicing Overlay */}
              {isDepthSliceOpen && (
                <div className="absolute top-3 right-3 sm:right-16 z-30 max-w-xs sm:max-w-sm bg-slate-900/95 border border-slate-700/80 rounded-2xl p-3 shadow-2xl backdrop-blur-md space-y-2.5 dir-rtl text-xs transition-all pointer-events-auto">
                  {/* Overlay Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-1.5 font-bold text-cyan-400">
                      <Sliders className="w-4 h-4 text-amber-400" />
                      <span>برش عمقی زیرسطحی</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Auto Sweep Play/Pause Button */}
                      <button
                        onClick={() => {
                          if (sliceZ === null) setSliceZ(0);
                          setIsDepthSweeping(!isDepthSweeping);
                        }}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                          isDepthSweeping
                            ? 'bg-amber-400 text-slate-950 animate-pulse'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                        title="پیمایش خودکار عمق (Auto Depth Sweep)"
                      >
                        {isDepthSweeping ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        <span>{isDepthSweeping ? 'توقف' : 'پیمایش'}</span>
                      </button>

                      {/* Toggle Depth Slicing On/Off */}
                      <button
                        onClick={() => {
                          if (sliceZ === null) {
                            setSliceZ(1.0);
                          } else {
                            setSliceZ(null);
                            setIsDepthSweeping(false);
                          }
                        }}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition ${
                          sliceZ !== null
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {sliceZ !== null ? 'فعال' : 'خاموش'}
                      </button>

                      {/* Collapse / Close Button to reveal underlying zoom controls */}
                      <button
                        onClick={() => setIsDepthSliceOpen(false)}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1 transition"
                        title="بستن و کوچک‌کردن کارت برش عمقی برای دسترسی به دکمه‌های زوم و چرخش"
                      >
                        <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                        <span>بستن</span>
                      </button>
                    </div>
                  </div>

                {sliceZ !== null ? (
                  <div className="space-y-2.5">
                    {/* Mode Selector Chips */}
                    <div className="flex items-center justify-between gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px]">
                      {[
                        { id: 'cut', label: 'برش از سطح (Cut)' },
                        { id: 'plane', label: 'تک مقطع (Plane)' },
                        { id: 'band', label: 'بازه عمق (Band)' }
                      ].map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setSliceZMode(m.id as DepthSliceMode)}
                          className={`flex-1 py-1 rounded-lg font-bold transition text-center ${
                            sliceZMode === m.id
                              ? 'bg-gradient-to-r from-amber-400 to-cyan-400 text-slate-950 shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {/* Main Depth Range / Slider Input */}
                    {sliceZMode !== 'band' ? (
                      <div className="space-y-1 font-mono">
                        <div className="flex items-center justify-between text-slate-300 text-[11px]">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-amber-400" />
                            <span>عمق مقطع برش:</span>
                          </span>
                          <span className="text-cyan-400 font-extrabold text-sm">{sliceZ.toFixed(1)} متر</span>
                        </div>

                        <div className="relative pt-1">
                          <input
                            type="range"
                            min="0.0"
                            max={viewedScan.maxDepthMeters || 3.5}
                            step="0.1"
                            value={sliceZ}
                            onChange={(e) => {
                              setIsDepthSweeping(false);
                              setSliceZ(parseFloat(e.target.value));
                            }}
                            className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-950 rounded-lg"
                          />
                          {/* Meter Ticks */}
                          <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-0.5">
                            <span>0m (سطح)</span>
                            <span>{((viewedScan.maxDepthMeters || 3.5) / 2).toFixed(1)}m</span>
                            <span>{viewedScan.maxDepthMeters || 3.5}m (بستر)</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Depth Band Dual Range Filter */
                      <div className="space-y-1.5 font-mono text-[11px]">
                        <div className="flex justify-between text-slate-300">
                          <span>بازه عمقی انتخاب‌شده:</span>
                          <span className="text-amber-400 font-bold">
                            {depthRange[0].toFixed(1)}m تا {depthRange[1].toFixed(1)}m
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400">حداقل عمق:</label>
                            <input
                              type="range"
                              min="0.0"
                              max={depthRange[1] - 0.1}
                              step="0.1"
                              value={depthRange[0]}
                              onChange={(e) => setDepthRange([parseFloat(e.target.value), depthRange[1]])}
                              className="w-full accent-amber-400 cursor-pointer"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400">حداکثر عمق:</label>
                            <input
                              type="range"
                              min={depthRange[0] + 0.1}
                              max={viewedScan.maxDepthMeters || 3.5}
                              step="0.1"
                              value={depthRange[1]}
                              onChange={(e) => setDepthRange([depthRange[0], parseFloat(e.target.value)])}
                              className="w-full accent-cyan-400 cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quick Depth Presets */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                      <span className="text-[10px] text-slate-400 shrink-0">میانبر:</span>
                      {[0.5, 1.0, 1.5, 2.0, 2.5, 3.0].map((d) => (
                        <button
                          key={d}
                          onClick={() => {
                            setIsDepthSweeping(false);
                            setSliceZ(d);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 transition ${
                            sliceZ === d
                              ? 'bg-cyan-400 text-slate-950 font-bold'
                              : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {d}m
                        </button>
                      ))}
                    </div>

                    {/* Real-Time Anomaly Count & Laser Plane Indicator */}
                    <div className="flex items-center justify-between bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-[11px]">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Activity className="w-3.5 h-3.5 text-amber-400" />
                        <span>سیگنال‌های فعال در این عمق:</span>
                      </div>
                      <span className={`font-bold font-mono px-2 py-0.5 rounded-lg ${
                        activeAnomaliesAtDepth > 0
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                          : 'bg-slate-900 text-slate-500'
                      }`}>
                        {activeAnomaliesAtDepth} هدف
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 text-center py-1">
                    برای فعال‌سازی اسلایدر برش عمقی ۳بعدی روی «فعال» کلیک کنید.
                  </div>
                )}
              </div>
            )}

            <ThreeVisualizer
                gridData={viewedScan.gridData}
                phaseData={viewedScan.phaseData}
                width={viewedScan.width}
                length={viewedScan.length}
                zScale={zScale}
                renderStyle={renderStyle}
                colorThreshold={colorThreshold}
                maxDepthMeters={viewedScan.maxDepthMeters}
                selectedNodeIndex={selectedNodeIndex}
                onSelectNode={handleSelectNode}
                sliceX={sliceX}
                sliceY={sliceY}
                sliceZ={sliceZ}
                sliceZMode={sliceZMode}
                depthRange={depthRange}
                showDepthPlane={showDepthPlane}
                autoRotate={autoRotate}
                showHeatmap={showHeatmap}
                heatmapOpacity={heatmapOpacity}
                heatmapPalette={heatmapPalette}
                onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
              />
            </div>
          </div>

          {/* Cross-Section Slicing Tool */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-amber-400">
              <span className="flex items-center gap-1.5">
                <Scissors className="w-4 h-4 text-cyan-400" />
                ابزار برش مقطعی (Cross-Section Slice):
              </span>
              {(sliceX !== null || sliceY !== null) && (
                <button
                  onClick={() => {
                    setSliceX(null);
                    setSliceY(null);
                  }}
                  className="text-red-400 hover:underline"
                >
                  حذف برش
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>برش محور X (ستون):</span>
                  <span className="text-cyan-400 font-bold">{sliceX !== null ? `ستون ${sliceX + 1}` : 'کامل'}</span>
                </div>
                <input
                  type="range"
                  min="-1"
                  max={viewedScan.width - 1}
                  value={sliceX ?? -1}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSliceX(val === -1 ? null : val);
                  }}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>برش محور Y (ردیف):</span>
                  <span className="text-emerald-400 font-bold">{sliceY !== null ? `خط ${sliceY + 1}` : 'کامل'}</span>
                </div>
                <input
                  type="range"
                  min="-1"
                  max={viewedScan.length - 1}
                  value={sliceY ?? -1}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSliceY(val === -1 ? null : val);
                  }}
                  className="w-full accent-emerald-400"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Right Inspector Sidebar (1 col) */}
        <div className="space-y-4">
          
          {/* Anomaly Detection HUD Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-xl">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              خلاصه ناهنجاری زمین
            </h3>

            <div className="space-y-2.5 font-mono text-xs">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">حداکثر عمق اسکن:</span>
                <span className="text-amber-400 font-bold">{viewedScan.maxDepthMeters} متر</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">بیشترین پیک سیگنال:</span>
                <span className="text-cyan-400 font-bold">{maxAdc} ADC (X:{maxX + 1}, Y:{maxY + 1})</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">اختلاف فاز متناظر:</span>
                <span className="text-emerald-400 font-bold">{maxPhase}°</span>
              </div>
            </div>

            {/* Prediction Badge */}
            <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
              isHighMetal
                ? 'bg-amber-400/10 border-amber-400/40 text-amber-300'
                : isDeepCavity
                ? 'bg-blue-500/10 border-blue-500/40 text-blue-300'
                : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
            }`}>
              <div className="font-bold mb-1">
                {isHighMetal ? '🎯 آنومالی فلز نجیب / طلا' : isDeepCavity ? '🕳️ آنومالی فضای خالی / حفره' : '🌱 خاک نرم و یکنواخت'}
              </div>
              <p className="text-[11px] opacity-80">
                {isHighMetal
                  ? 'سیگنال مغناطیسی بالا همراه با فاز مثبت نشان‌دهنده شیء فلزی با رسانایی بسیار بالا است.'
                  : isDeepCavity
                  ? 'افت شدید سیگنال نشان‌دهنده وجود ساختار زیرزمینی توخالی یا کانال ساروجی است.'
                  : 'تغییرات زمین در محدوده طبیعی خاک و سنگ‌های معدنی معمولی است.'}
              </p>
            </div>
          </div>

          {/* Interactive Selected Node Inspector */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-xl">
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-cyan-400" />
              بازرسی نقطه انتخابی ۳بعدی
            </h3>

            {nodeDetails ? (
              <div className="space-y-2 font-mono text-xs">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex justify-between">
                  <span className="text-slate-400">مختصات شبکه‌ای:</span>
                  <span className="text-amber-400 font-bold">X: {nodeDetails.x + 1} | Y: {nodeDetails.y + 1}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex justify-between">
                  <span className="text-slate-400">شدت سیگنال ADC:</span>
                  <span className="text-cyan-400 font-bold">{nodeDetails.adc}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex justify-between">
                  <span className="text-slate-400">زاویه فاز Phase:</span>
                  <span className="text-emerald-400 font-bold">{nodeDetails.phase}°</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex justify-between">
                  <span className="text-slate-400">تخمین عمق هدف:</span>
                  <span className="text-amber-400 font-bold">{nodeDetails.depth} متر</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 text-center py-6 border border-dashed border-slate-800 rounded-xl">
                روی هر نقطه از مدل ۳بعدی کلیک کنید تا مشخصات دقیق عمق و سیگنال نمایش داده شود.
              </div>
            )}
          </div>

          {/* Color Spectrum or Magnetic Heatmap Legend */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                {showHeatmap ? (
                  <>
                    <Flame className="w-4 h-4 text-orange-400" />
                    <span>نقشه حرارتی شدت مغناطیسی (Thermal Heatmap):</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span>راهنمای طیف ژئوفیزیک OKM:</span>
                  </>
                )}
              </div>
              <button
                onClick={() => setShowHeatmap(!showHeatmap)}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold transition underline"
              >
                {showHeatmap ? 'طیف استاندارد OKM' : 'فعال‌سازی هیت‌مپ'}
              </button>
            </div>

            {showHeatmap ? (
              <div className="space-y-2.5">
                {/* 5-stop high-contrast thermal gradient */}
                <div className="h-5 rounded-lg bg-gradient-to-r from-indigo-800 via-cyan-500 via-emerald-400 via-amber-400 via-orange-500 to-rose-600 border border-slate-700 shadow-inner" />
                <div className="flex justify-between text-[10px] text-slate-300 font-mono">
                  <span className="text-indigo-400 font-bold">سرد (&le;250)</span>
                  <span className="text-cyan-400 font-bold">بستر (400)</span>
                  <span className="text-amber-400 font-bold">معدنی (650)</span>
                  <span className="text-rose-400 font-bold">داغ (&gt;800)</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1 text-[11px] font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>دامنه شدت مغناطیسی:</span>
                    <span className="text-orange-400 font-bold">{minAdc} - {maxAdc} ADC</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>تخمین شیب میدان (&Delta;B):</span>
                    <span className="text-cyan-400 font-bold">~{((maxAdc - minAdc) * 0.08).toFixed(1)} &mu;T</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="h-4 rounded-lg bg-gradient-to-r from-blue-700 via-emerald-500 via-amber-400 to-red-600 border border-slate-700" />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span className="text-blue-400">حفره/تونل</span>
                  <span className="text-emerald-400">خاک معمولی</span>
                  <span className="text-amber-400">مواد معدنی</span>
                  <span className="text-red-400">فلز/طلا</span>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Save Scan Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
              <Save className="w-5 h-5 text-amber-400" />
              ذخیره اسکن زمین در تاریخچه
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">نام یا عنوان اسکن:</label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-amber-400 outline-none"
                  placeholder="مثال: اسکن زمین منطقه الف"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">یادداشت‌ها و جزئیات میدان:</label>
                <textarea
                  value={saveNotes}
                  onChange={(e) => setSaveNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-amber-400 outline-none"
                  placeholder="موقعیت جغرافیایی، شرایط آب‌وهوا یا توضیحات خاک..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
              >
                انصراف
              </button>
              <button
                onClick={() => {
                  onSaveScan(saveName || 'اسکن زمین جدید', saveNotes);
                  setShowSaveModal(false);
                }}
                className="px-5 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs hover:bg-amber-300 shadow-md shadow-amber-400/20"
              >
                تأیید و ذخیره
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
