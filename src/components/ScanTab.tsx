import React, { useState, useEffect } from 'react';
import { SoilType, ScanPattern, SensorType, ConnectionMode } from '../types';
import { audioEngine } from '../utils/audio';
import {
  Plus,
  Minus,
  Play,
  RotateCcw,
  Zap,
  Compass,
  Settings,
  Info,
  X,
  AlignJustify,
  Repeat,
  Radio,
  ArrowRight,
  Sparkles,
  Bluetooth
} from 'lucide-react';

interface ScanTabProps {
  gridWidth: number;
  setGridWidth: (w: number) => void;
  gridLength: number;
  setGridLength: (l: number) => void;
  soilType: SoilType;
  setSoilType: (s: SoilType) => void;
  scanPattern: ScanPattern;
  setScanPattern: (p: ScanPattern) => void;
  sensorType: SensorType;
  setSensorType: (s: SensorType) => void;
  baudRate: number;
  setBaudRate: (r: number) => void;
  connectionState: ConnectionMode;
  connectionStatus: string;
  onOpenBluetoothModal?: () => void;
  compassHeading: number;
  isScanActive: boolean;
  onStartScan: () => void;
  onCancelScan: () => void;
  onCompleteScan: () => void;
  activeScanData: number[];
  activePhaseData: number[];
  currentCol: number;
  currentRow: number;
  onRecordStep: () => void;
  adcValue: number;
  phaseShift: number;
  onNavigateToAi: () => void;
}

export const ScanTab: React.FC<ScanTabProps> = ({
  gridWidth,
  setGridWidth,
  gridLength,
  setGridLength,
  soilType,
  setSoilType,
  scanPattern,
  setScanPattern,
  sensorType,
  setSensorType,
  baudRate,
  setBaudRate,
  connectionState,
  connectionStatus,
  onOpenBluetoothModal,
  compassHeading,
  isScanActive,
  onStartScan,
  onCancelScan,
  onCompleteScan,
  activeScanData,
  activePhaseData,
  currentCol,
  currentRow,
  onRecordStep,
  adcValue,
  phaseShift,
  onNavigateToAi
}) => {
  const [autoPulse, setAutoPulse] = useState(false);

  // Auto-pulse polling interval
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isScanActive && autoPulse) {
      timer = setInterval(() => {
        onRecordStep();
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [isScanActive, autoPulse, onRecordStep]);

  const soils: SoilType[] = [
    'خاک کشاورزی (Soil)',
    'خاک معدنی (Mineral)',
    'سنگ و صخره (Hard Rock)',
    'ماسه خیس (Wet Sand)'
  ];

  const totalPoints = gridWidth * gridLength;
  const scannedPoints = activeScanData.length;
  const progressPercent = totalPoints > 0 ? Math.min(100, Math.round((scannedPoints / totalPoints) * 100)) : 0;

  const getDirectionText = (deg: number) => {
    if (deg >= 337.5 || deg < 22.5) return 'شمال (N)';
    if (deg >= 22.5 && deg < 67.5) return 'شمال‌شرق (NE)';
    if (deg >= 67.5 && deg < 112.5) return 'شرق (E)';
    if (deg >= 112.5 && deg < 157.5) return 'جنوب‌شرق (SE)';
    if (deg >= 157.5 && deg < 202.5) return 'جنوب (S)';
    if (deg >= 202.5 && deg < 247.5) return 'جنوب‌غرب (SW)';
    if (deg >= 247.5 && deg < 292.5) return 'غرب (W)';
    return 'شمال‌غرب (NW)';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {!isScanActive ? (
        /* ================= SETUP CONFIGURATION MODE ================= */
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" />
                تنظیمات اسکن جدید (Scan Configuration)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                ابعاد شبکه، نوع خاک و پروتکل ارتباطی سنسورهای مگنتومتر را تنظیم کنید
              </p>
            </div>
          </div>

          {/* Grid Dimensions */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-xl">
            <h3 className="text-sm font-bold text-amber-400">۱. ابعاد شبکه اسکن زمین</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Width */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-200">تعداد پالس در خط (عرض)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Grid Width (Cols)</span>
                </div>
                <div className="flex items-center justify-between bg-slate-900 border border-slate-700/60 rounded-xl p-1">
                  <button
                    onClick={() => setGridWidth(Math.max(3, gridWidth - 1))}
                    className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-xl font-extrabold font-mono text-white">{gridWidth}</span>
                  <button
                    onClick={() => setGridWidth(Math.min(30, gridWidth + 1))}
                    className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Length */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-200">تعداد خطوط اسکن (طول)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Grid Length (Rows)</span>
                </div>
                <div className="flex items-center justify-between bg-slate-900 border border-slate-700/60 rounded-xl p-1">
                  <button
                    onClick={() => setGridLength(Math.max(3, gridLength - 1))}
                    className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-xl font-extrabold font-mono text-white">{gridLength}</span>
                  <button
                    onClick={() => setGridLength(Math.min(50, gridLength + 1))}
                    className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Total Area Summary */}
            <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-3 flex items-center justify-between text-xs text-amber-300 font-mono">
              <span>مجموع کل نقاط تصویربرداری:</span>
              <span className="text-sm font-bold">{gridWidth * gridLength} نقطه پالس</span>
            </div>
          </div>

          {/* Soil Type Selection */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div>
              <h3 className="text-sm font-bold text-amber-400">۲. نوع خاک هدف (Soil Type)</h3>
              <p className="text-xs text-slate-400 mt-1">تأثیر مستقیم بر سرعت انتشار امواج الکترومغناطیسی و محاسبه عمق</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {soils.map((s) => (
                <button
                  key={s}
                  onClick={() => setSoilType(s)}
                  className={`p-3 rounded-xl border text-xs font-semibold text-right transition-all ${
                    soilType === s
                      ? 'bg-amber-400/15 border-amber-400 text-amber-300 shadow-md shadow-amber-400/10'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Scan Pattern */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-amber-400">۳. طرح حرکت اسکن (Scan Pattern)</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setScanPattern('موازی (Parallel)')}
                className={`p-4 rounded-xl border text-right transition-all flex items-start gap-3 ${
                  scanPattern.includes('Parallel') || scanPattern.includes('موازی')
                    ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-400/10'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <div className="p-2 rounded-lg bg-cyan-400/20 text-cyan-400 mt-1">
                  <AlignJustify className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold">موازی (Parallel)</div>
                  <div className="text-xs text-slate-400 mt-1">شروع هر خط همیشه از یک سمت (دقت بالای جهت‌گیری)</div>
                </div>
              </button>

              <button
                onClick={() => setScanPattern('زیگزاگ (Zig-Zag)')}
                className={`p-4 rounded-xl border text-right transition-all flex items-start gap-3 ${
                  scanPattern.includes('Zig-Zag') || scanPattern.includes('زیگزاگ')
                    ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-400/10'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <div className="p-2 rounded-lg bg-cyan-400/20 text-cyan-400 mt-1">
                  <Repeat className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold">زیگزاگ (Zig-Zag)</div>
                  <div className="text-xs text-slate-400 mt-1">حرکت رفت و برگشتی متناوب (سرعت اجرای بالاتر)</div>
                </div>
              </button>
            </div>
          </div>

          {/* Hardware & Driver Config */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                ۴. درایور ارتباطی و ماژول بلوتوث فیزیکی
              </h3>
              {onOpenBluetoothModal && (
                <button
                  onClick={onOpenBluetoothModal}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>ترمینال بلوتوث</span>
                </button>
              )}
            </div>

            {/* Hardware Connection Card */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                  connectionState === 'BLUETOOTH'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                    : connectionState === 'USB'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}>
                  <Bluetooth className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>وضعیت اتصال:</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                      connectionState === 'BLUETOOTH' || connectionState === 'USB'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {connectionState === 'BLUETOOTH' ? 'BLE CONNECTED' : connectionState === 'USB' ? 'USB OTG CONNECTED' : 'DISCONNECTED'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                    {connectionStatus}
                  </div>
                </div>
              </div>

              {onOpenBluetoothModal && (
                <button
                  onClick={onOpenBluetoothModal}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-cyan-500/20 w-full sm:w-auto justify-center"
                >
                  <Bluetooth className="w-4 h-4" />
                  <span>اتصال سنسور (بلوتوث / کابل USB)</span>
                </button>
              )}
            </div>

            {/* Sensor Selection */}
            <div className="space-y-2">
              <span className="text-xs text-slate-300 font-semibold">پروفایل سنسور مگنتومتر:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'GOLD_RADAR_X20', label: 'استاندارد X20' },
                  { id: 'FMG3', label: 'FMG3 فلاکس‌گیت' },
                  { id: 'FLC100', label: 'FLC100 فلاکس‌گیت' },
                  { id: 'HMC5883L', label: 'قطب‌نما HMC5883L' }
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSensorType(s.id as SensorType)}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                      sensorType === s.id
                        ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Baud Rate Selection */}
            <div className="space-y-2">
              <span className="text-xs text-slate-300 font-semibold">سرعت اتصالات سریال (Baud Rate):</span>
              <div className="flex gap-3">
                {[9600, 115200].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => setBaudRate(rate)}
                    className={`flex-1 p-2.5 rounded-xl border text-xs font-mono font-bold transition ${
                      baudRate === rate
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    {rate} bps
                  </button>
                ))}
              </div>
            </div>

            {/* Compass Widget */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Compass
                  className="w-8 h-8 text-amber-400 transition-transform duration-300"
                  style={{ transform: `rotate(${-compassHeading}deg)` }}
                />
                <div>
                  <div className="text-xs font-bold text-white">قطب‌نمای دیجیتال HMC5883L</div>
                  <div className="text-[10px] text-slate-400">جهت‌نما و تراز الکترونیکی اسکن زمین</div>
                </div>
              </div>
              <div className="text-left font-mono">
                <div className="text-sm font-bold text-amber-400">{compassHeading.toFixed(1)}°</div>
                <div className="text-xs font-bold text-cyan-400">{getDirectionText(compassHeading)}</div>
              </div>
            </div>
          </div>

          {/* Big Start Scan Button */}
          <button
            onClick={onStartScan}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-black text-lg shadow-xl shadow-amber-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            <Play className="w-6 h-6 fill-current" />
            <span>شروع اسکن سه‌بعدی جدید (Start Scan)</span>
          </button>
        </div>
      ) : (
        /* ================= ACTIVE SCAN ACQUISITION MODE ================= */
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-2xl">
            
            {/* Active Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                  <h2 className="text-lg font-bold text-amber-400">در حال تصویربرداری سه‌بعدی زمین...</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  ابعاد شبکه: {gridWidth} × {gridLength} | الگوی اسکن: {scanPattern}
                </p>
              </div>

              <button
                onClick={onCancelScan}
                className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition text-xs font-bold flex items-center gap-1.5"
              >
                <X className="w-4 h-4" />
                <span>لغو اسکن</span>
              </button>
            </div>

            {/* Scan Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-300">پیشرفت کل تصویربرداری:</span>
                <span className="text-amber-400 font-bold">{scannedPoints} / {totalPoints} نقطه ({progressPercent}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-950 rounded-full border border-slate-800 overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 via-amber-400 to-amber-300 transition-all duration-300 relative"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
            </div>

            {/* 2D Acquisition Grid Matrix */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-inner space-y-3">
              <div className="flex justify-between items-center text-xs font-mono text-slate-400 border-b border-slate-900 pb-2">
                <span>ماتریس پالس متناظر با زمین:</span>
                <span className="text-cyan-400 font-semibold">موقعیت فعلی: (X: {currentCol + 1}, Y: {currentRow + 1})</span>
              </div>

              <div
                className="grid gap-1.5 p-2 bg-slate-900/60 rounded-xl overflow-x-auto"
                style={{
                  gridTemplateColumns: `repeat(${gridWidth}, minmax(0, 1fr))`
                }}
              >
                {Array.from({ length: totalPoints }).map((_, idx) => {
                  const x = idx % gridWidth;
                  const y = Math.floor(idx / gridWidth);
                  const isScanned = idx < activeScanData.length;
                  const isCurrent = x === currentCol && y === currentRow;
                  const val = activeScanData[idx] ?? 0;

                  // Color mapping for acquisition grid
                  let bgStyle = 'bg-slate-900 border-slate-800 text-slate-600';
                  if (isScanned) {
                    if (val > 750) bgStyle = 'bg-amber-400 text-slate-950 font-extrabold border-amber-300 shadow-sm shadow-amber-400/30';
                    else if (val > 550) bgStyle = 'bg-amber-600 text-white font-bold border-amber-500';
                    else if (val < 280) bgStyle = 'bg-blue-600 text-white font-bold border-blue-400';
                    else bgStyle = 'bg-emerald-600/80 text-white border-emerald-500';
                  }

                  return (
                    <div
                      key={idx}
                      className={`h-10 rounded-lg border text-[10px] font-mono flex items-center justify-center transition-all ${bgStyle} ${
                        isCurrent ? 'ring-2 ring-amber-400 scale-105 z-10 font-black shadow-lg shadow-amber-400/50' : ''
                      }`}
                    >
                      {isScanned ? val : `${x + 1},${y + 1}`}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Readout Values */}
            <div className="grid grid-cols-2 gap-4 bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="text-center font-mono">
                <div className="text-xs text-slate-400">سیگنال ADC سنسور</div>
                <div className="text-2xl font-black text-cyan-400 mt-1">{adcValue}</div>
              </div>
              <div className="text-center font-mono border-r border-slate-800">
                <div className="text-xs text-slate-400">اختلاف فاز (Phase)</div>
                <div className="text-2xl font-black text-emerald-400 mt-1">{phaseShift}°</div>
              </div>
            </div>

            {/* Controls Row */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              
              {/* Auto Pulse Switch */}
              <label className="flex items-center gap-3 cursor-pointer bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={autoPulse}
                  onChange={(e) => setAutoPulse(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-400 focus:ring-amber-400 bg-slate-900 border-slate-700"
                />
                <div>
                  <div className="font-bold">ثبت خودکار پالس (Auto-Pulse)</div>
                  <div className="text-[10px] text-slate-400">پالس هر ۱.۵ ثانیه صادر می‌شود</div>
                </div>
              </label>

              {/* Big Record Step Ping Button */}
              <button
                onClick={() => {
                  audioEngine.playStepPing(adcValue);
                  onRecordStep();
                }}
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-extrabold text-base shadow-xl shadow-amber-400/30 transition-all flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5 fill-current text-slate-950" />
                <span>ثبت پالس (Record Step)</span>
              </button>

              {/* View in 3D when finished */}
              {scannedPoints >= totalPoints && (
                <button
                  onClick={onCompleteScan}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-400/20 hover:scale-102 transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>مشاهده اسکن در ۳بعدی</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Hardware Setup Tip Footer */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-3 text-xs text-slate-400">
        <Info className="w-5 h-5 text-cyan-400 shrink-0" />
        <div>
          <span className="font-bold text-slate-200">راهنمای سخت‌افزار: </span>
          سنسورهای فلاکس‌گیت FMG3 و FLC100 را با درایور سریال CH340 جفت کنید. در صورت عدم وجود سخت‌افزار فیزیکی، شبیه‌ساز سیگنال‌های ژئوفیزیک به طور خودکار فعال خواهد شد.
        </div>
      </div>

    </div>
  );
};
