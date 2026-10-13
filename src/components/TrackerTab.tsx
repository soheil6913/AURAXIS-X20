import React, { useState, useEffect } from 'react';
import { audioEngine } from '../utils/audio';
import { adcToMicroTesla } from '../utils/geophysicalEngine';
import {
  TrendingUp,
  Volume2,
  VolumeX,
  Sliders,
  RotateCcw,
  Zap,
  Activity,
  AlertOctagon,
  ShieldCheck,
  Compass,
  Info,
  Radio,
  Bluetooth
} from 'lucide-react';

interface TrackerTabProps {
  adcValue: number;
  phaseShift: number;
  connectionStatus: string;
  onOpenBluetoothModal?: () => void;
}

export const TrackerTab: React.FC<TrackerTabProps> = ({
  adcValue,
  phaseShift,
  connectionStatus,
  onOpenBluetoothModal
}) => {
  const [history, setHistory] = useState<Array<{ adc: number; phase: number; time: string; isMotionJerk: boolean }>>([]);
  const [threshold, setThreshold] = useState<number>(650);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [groundZero, setGroundZero] = useState<number>(380);

  // Simulated IMU Motion Acceleration & Tilt
  const [tiltAngle, setTiltAngle] = useState<number>(3.5);
  const [isMotionArtifact, setIsMotionArtifact] = useState<boolean>(false);

  // Poll live data stream into chart buffer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      // Calculate micro-tilt variations
      const currentTilt = Math.abs(Math.sin(Date.now() / 2000) * 8 + (Math.random() * 4 - 2));
      const jerk = currentTilt > 16.0;
      setTiltAngle(Number(currentTilt.toFixed(1)));
      setIsMotionArtifact(jerk);

      // Adjusted value based on ground zero calibration
      const adjAdc = Math.max(0, adcValue);

      setHistory((prev) => {
        const next = [...prev, { adc: adjAdc, phase: phaseShift, time: now, isMotionJerk: jerk }];
        if (next.length > 30) next.shift(); // Keep last 30 readings
        return next;
      });

      // Trigger audio tone
      if (soundEnabled) {
        audioEngine.playLiveSignalTone(adjAdc, phaseShift);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [adcValue, phaseShift, soundEnabled]);

  const deltaAdc = adcValue - groundZero;
  const uTesla = adcToMicroTesla(adcValue, 'GOLD_RADAR_X20');
  const isAlarm = adcValue > threshold && !isMotionArtifact;
  const isCavityAlert = phaseShift < -30 || adcValue < 200;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-red-500" />
              ردیابی زنده مگنتومتر (Live Magnetometer Tracker)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            پایش لحظه‌ای میدان مغناطیسی، چگالی شار (μT)، تفکیک آرتیفکت حرکتی و کالیبراسیون خط زمینه
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-4 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-2 ${
              soundEnabled
                ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            <span>صوت هشدار ({soundEnabled ? 'فعال' : 'خاموش'})</span>
          </button>

          {onOpenBluetoothModal && (
            <button
              onClick={onOpenBluetoothModal}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
              title="اتصال به سنسور واقعی با بلوتوث"
            >
              <Bluetooth className="w-4 h-4" />
              <span>اتصال بلوتوث فیزیکی</span>
            </button>
          )}

          <button
            onClick={() => setGroundZero(adcValue)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5"
            title="ثبت مقدار فعلی به عنوان خط صفر زمین"
          >
            <RotateCcw className="w-4 h-4" />
            <span>بالانس صفر زمین (Ground Tare)</span>
          </button>
        </div>
      </div>

      {/* Main Gauges Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* ADC Signal Gauge */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 shadow-xl text-center">
          <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">سیگنال مغناطیسی لحظه‌ای</div>
          <div className="text-3xl font-black font-mono text-cyan-400 my-1">{adcValue} ADC</div>
          <div className="text-[10px] text-slate-400 font-mono">
            انحراف از خط پایه: <strong className={deltaAdc >= 0 ? 'text-amber-400' : 'text-blue-400'}>{deltaAdc >= 0 ? `+${deltaAdc}` : deltaAdc}</strong>
          </div>

          {/* Bar indicator */}
          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mt-2">
            <div
              className={`h-full transition-all duration-200 ${
                isAlarm ? 'bg-red-500 shadow-md shadow-red-500/50' : 'bg-cyan-400'
              }`}
              style={{ width: `${Math.min(100, (adcValue / 1024) * 100)}%` }}
            />
          </div>
        </div>

        {/* Calibrated Magnetic Flux (microTesla) Gauge */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 shadow-xl text-center">
          <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">چگالی شار مغناطیسی (B)</div>
          <div className="text-3xl font-black font-mono text-amber-400 my-1">{uTesla} μT</div>
          <div className="text-[10px] text-slate-400">کالیبره‌شده در مقیاس میکروتسلا</div>

          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mt-2">
            <div
              className="h-full bg-amber-400 transition-all duration-200"
              style={{ width: `${Math.min(100, Math.max(0, ((uTesla + 80) / 160) * 100))}%` }}
            />
          </div>
        </div>

        {/* Phase Shift Gauge */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 shadow-xl text-center">
          <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">زاویه اختلاف فاز (Phase)</div>
          <div className="text-3xl font-black font-mono text-emerald-400 my-1">{phaseShift}°</div>
          <div className="text-[10px] text-slate-400">
            {phaseShift > 15 ? 'پاسخ رسانایی بالا (+)' : phaseShift < -15 ? 'پاسخ افت گرادیان (-)' : 'خاک یکنواخت'}
          </div>

          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 relative mt-2">
            <div
              className="h-full bg-emerald-400 transition-all duration-200"
              style={{ width: `${Math.min(100, Math.max(0, (phaseShift + 90) / 180 * 100))}%` }}
            />
          </div>
        </div>

        {/* IMU Motion & Tilt Angle Gauge */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 shadow-xl text-center">
          <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">پایداری حرکتی پروب (Tilt)</div>
          <div className={`text-3xl font-black font-mono my-1 ${tiltAngle > 15 ? 'text-red-400' : 'text-slate-100'}`}>
            {tiltAngle}°
          </div>
          <div className="text-[10px] text-slate-400">
            {tiltAngle > 15 ? 'انحراف بحرانی زاویه!' : 'حرکت یکنواخت و پایدار'}
          </div>

          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mt-2">
            <div
              className={`h-full transition-all duration-200 ${tiltAngle > 15 ? 'bg-red-500' : 'bg-emerald-400'}`}
              style={{ width: `${Math.min(100, (tiltAngle / 30) * 100)}%` }}
            />
          </div>
        </div>

      </div>

      {/* Motion Artifact Warning Banner */}
      {isMotionArtifact && (
        <div className="bg-amber-950/40 border border-amber-500/60 rounded-2xl p-4 flex items-center gap-3 text-amber-200 shadow-xl">
          <AlertOctagon className="w-6 h-6 text-amber-400 shrink-0" />
          <div className="text-xs">
            <strong className="text-amber-300 block">هشدار آرتیفکت حرکتی پروب (Motion Artifact Rejected):</strong>
            کج‌شدن زاویه سنسور ({tiltAngle} درجه) یا نوسان گام‌برداری مانع از ثبت پالس معتبر است. تغییرات میدان در این لحظه ناشی از چرخش سیم‌پیچ نسبت به میدان زمین است، نه شیء مدفون.
          </div>
        </div>
      )}

      {/* Alarm Warning Status Banner */}
      {isAlarm && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-2xl p-4 flex items-center gap-3 text-red-300 shadow-xl animate-pulse">
          <AlertOctagon className="w-6 h-6 text-red-400 shrink-0" />
          <div>
            <div className="font-bold text-sm">هشدار عبور از حد آستانه مغناطیسی (Threshold Alert)</div>
            <p className="text-xs opacity-90 mt-0.5">
              شدت سیگنال دریافتی ({adcValue} ADC) از آستانه تنظیم‌شده ({threshold} ADC) فراتر رفته است.
            </p>
          </div>
        </div>
      )}

      {isCavityAlert && (
        <div className="bg-cyan-500/20 border border-cyan-500/50 rounded-2xl p-4 flex items-center gap-3 text-cyan-300 shadow-xl">
          <Activity className="w-6 h-6 text-cyan-400 shrink-0" />
          <div>
            <div className="font-bold text-sm">اطلاعیه: افت محسوس گرادیان میدان (Magnetic Dipole Drop)</div>
            <p className="text-xs opacity-90 mt-0.5">
              افت سیگنال به {adcValue} ADC با فاز منفی حاکی از ساختار فضای خالی، اتاقک سنگی یا تغییر ضخامت لایه خاک است.
            </p>
          </div>
        </div>
      )}

      {/* Real-time Waveform Live Stream Chart Canvas */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between text-xs font-bold border-b border-slate-800 pb-3">
          <span className="text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            نمودار موج نوسانات زنده (Live Waveform Stream)
          </span>
          <span className="text-slate-400 font-mono">وضعیت اتصال: {connectionStatus}</span>
        </div>

        {/* Canvas / SVG Line Chart */}
        <div className="h-64 bg-slate-950 border border-slate-800 rounded-xl p-4 relative overflow-hidden flex items-end">
          
          {/* Grid lines background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-30 pointer-events-none" />

          {/* Threshold alert line */}
          <div
            className="absolute left-0 right-0 border-b border-dashed border-red-500 pointer-events-none z-10"
            style={{ bottom: `${(threshold / 1024) * 100}%` }}
          >
            <span className="text-[10px] text-red-400 font-mono px-2 py-0.5 bg-slate-950/80 rounded absolute -top-3 right-2">
              تراز هشدار ({threshold} ADC)
            </span>
          </div>

          {/* Ground Zero line */}
          <div
            className="absolute left-0 right-0 border-b border-dotted border-cyan-400/50 pointer-events-none z-10"
            style={{ bottom: `${(groundZero / 1024) * 100}%` }}
          >
            <span className="text-[10px] text-cyan-400 font-mono px-2 py-0.5 bg-slate-950/80 rounded absolute -top-3 left-2">
              خط صفر بالانس ({groundZero} ADC)
            </span>
          </div>

          {/* SVG Polyline */}
          <svg className="w-full h-full overflow-visible z-0">
            <defs>
              <linearGradient id="adcGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {history.length > 1 && (
              <>
                {/* Area under curve */}
                <polygon
                  points={`0,256 ${history
                    .map((item, idx) => {
                      const x = (idx / (history.length - 1)) * 100;
                      const y = 256 - (item.adc / 1024) * 256;
                      return `${x}%,${y}`;
                    })
                    .join(' ')} 100%,256`}
                  fill="url(#adcGradient)"
                />

                {/* Line */}
                <polyline
                  fill="none"
                  stroke="#00e5ff"
                  strokeWidth="2.5"
                  points={history
                    .map((item, idx) => {
                      const x = (idx / (history.length - 1)) * 100;
                      const y = 256 - (item.adc / 1024) * 256;
                      return `${x}%,${y}`;
                    })
                    .join(' ')}
                />
              </>
            )}
          </svg>
        </div>

        {/* Threshold Adjustment Controls */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-300 font-bold">تنظیم حد آستانه هشدار (Sensitivity Threshold):</span>
            <span className="text-red-400 font-bold">{threshold} ADC</span>
          </div>
          <input
            type="range"
            min="400"
            max="950"
            step="10"
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value))}
            className="w-full accent-red-500"
          />
        </div>

      </div>

      {/* Scientific Limitation Disclosure */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3 text-xs text-slate-400">
        <Info className="w-5 h-5 text-amber-400 shrink-0" />
        <span>
          نکته فنی: مقادیر لحظه‌ای سنسور بر حسب تغییرات میدان مغناطیسی کل محاسبه می‌شوند. برای استخراج ساختار هندسی و حذف اثر زاویه دست، انجام اسکن شبکه‌ای کامل در تب اسکن پیشنهاد می‌گردد.
        </span>
      </div>

    </div>
  );
};
