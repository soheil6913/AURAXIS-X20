import React, { useState, useEffect, useCallback } from 'react';
import {
  ScanRecord,
  ConnectionMode,
  SensorType,
  SoilType,
  ScanPattern,
  ImuMotionTelemetry
} from './types';
import { SAMPLE_SCANS } from './utils/sampleData';
import { audioEngine } from './utils/audio';
import { bluetoothHardware } from './utils/bluetoothHardware';
import { Header } from './components/Header';
import { ScanTab } from './components/ScanTab';
import { VisualizerTab } from './components/VisualizerTab';
import { TrackerTab } from './components/TrackerTab';
import { HistoryTab } from './components/HistoryTab';
import { AiAnalysisTab } from './components/AiAnalysisTab';
import { MapTab } from './components/MapTab';
import { BluetoothTacticalModal } from './components/BluetoothTacticalModal';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && ['scan', 'visualizer', 'map', 'tracker', 'history', 'ai'].includes(tabParam)) {
        return tabParam;
      }
      if (window.location.hash) {
        const hash = window.location.hash.replace('#', '');
        if (['scan', 'visualizer', 'map', 'tracker', 'history', 'ai'].includes(hash)) {
          return hash;
        }
      }
    }
    return 'scan';
  });

  const [isEmbed, setIsEmbed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('embed') === 'true' || params.get('mode') === 'embed';
    }
    return false;
  });

  // Connection Manager
  const [connectionState, setConnectionState] = useState<ConnectionMode>('DISCONNECTED');
  const [connectionStatus, setConnectionStatus] = useState<string>('سخت‌افزار متصل نیست');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Scan Configuration State
  const [gridWidth, setGridWidth] = useState<number>(10);
  const [gridLength, setGridLength] = useState<number>(14);
  const [soilType, setSoilType] = useState<SoilType>('خاک کشاورزی (Soil)');
  const [scanPattern, setScanPattern] = useState<ScanPattern>('موازی (Parallel)');
  const [sensorType, setSensorType] = useState<SensorType>('GOLD_RADAR_X20');
  const [baudRate, setBaudRate] = useState<number>(115200);

  // Live Magnetometer Readings
  const [adcValue, setAdcValue] = useState<number>(380);
  const [phaseShift, setPhaseShift] = useState<number>(2);
  const [compassHeading, setCompassHeading] = useState<number>(45.0);
  const [imuTelemetry, setImuTelemetry] = useState<ImuMotionTelemetry>({
    accelX: 0.0,
    accelY: 0.0,
    accelZ: 9.81,
    tiltAngleDeg: 1.8,
    motionStabilityPct: 98,
    isMotionArtifactSuspected: false,
    sampleRateHz: 10
  });

  // Active Scan Acquisition State
  const [isScanActive, setIsScanActive] = useState<boolean>(false);
  const [currentCol, setCurrentCol] = useState<number>(0);
  const [currentRow, setCurrentRow] = useState<number>(0);
  const [activeScanData, setActiveScanData] = useState<number[]>([]);
  const [activePhaseData, setActivePhaseData] = useState<number[]>([]);

  // Saved History & Active Viewed Scan in 3D
  const [savedScans, setSavedScans] = useState<ScanRecord[]>(SAMPLE_SCANS);
  const [viewedScan, setViewedScan] = useState<ScanRecord | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const scanId = params.get('scanId');
      if (scanId) {
        const found = SAMPLE_SCANS.find((s) => s.id === scanId);
        if (found) return found;
      }
    }
    return SAMPLE_SCANS[0];
  });
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(null);

  // Listen to postMessage from host (e.g. Android WebView)
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      try {
        if (!e.data) return;
        const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (msg.type === 'SET_TAB' && msg.tab) {
          setCurrentTab(msg.tab);
        } else if (msg.type === 'LOAD_SCAN' && msg.scan) {
          setViewedScan(msg.scan);
          setCurrentTab('visualizer');
        }
      } catch {
        // ignore non-json messages
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Audio mute handler
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    audioEngine.setMuted(next);
  };

  // Hardware Tactical Modal State
  const [isBluetoothModalOpen, setIsBluetoothModalOpen] = useState<boolean>(false);

  // Subscribe to real physical Bluetooth and USB hardware telemetry
  useEffect(() => {
    const unsubTelemetry = bluetoothHardware.onTelemetry((packet) => {
      setAdcValue(packet.adc);
      setPhaseShift(packet.phase);
      if (packet.heading !== undefined) {
        setCompassHeading(packet.heading);
      }
      if (packet.ax !== undefined && packet.ay !== undefined && packet.az !== undefined) {
        setImuTelemetry({
          accelX: packet.ax,
          accelY: packet.ay,
          accelZ: packet.az,
          tiltAngleDeg: packet.tiltAngle ?? 0,
          motionStabilityPct: packet.isMotionArtifact ? 35 : 95,
          isMotionArtifactSuspected: Boolean(packet.isMotionArtifact),
          sampleRateHz: 10
        });
      }
      if (!isMuted) {
        audioEngine.playLiveSignalTone(packet.adc, packet.phase);
      }
    });

    const unsubState = bluetoothHardware.onStateChange((state) => {
      if (state.isConnected) {
        if (state.connectionType === 'BLE' || state.connectionType === 'BT_CLASSIC') {
          setConnectionState('BLUETOOTH');
          setConnectionStatus(`بلوتوث فیزیکی: ${state.deviceName || 'متصل'}`);
        } else if (state.connectionType === 'USB_SERIAL') {
          setConnectionState('USB');
          setConnectionStatus(`کابل USB: ${state.deviceName || 'متصل'}`);
        }
      } else if (connectionState === 'BLUETOOTH' || connectionState === 'USB') {
        setConnectionState('DISCONNECTED');
        setConnectionStatus('سخت‌افزار قطع شد');
      }
    });

    return () => {
      unsubTelemetry();
      unsubState();
    };
  }, [isMuted, connectionState]);

  // Open Tactical Hardware Bluetooth Terminal
  const handleAutoConnect = () => {
    setIsBluetoothModalOpen(true);
  };

  // Continuous background sensor simulation (noise & compass drift) - ONLY active in SIMULATOR mode!
  useEffect(() => {
    if (connectionState !== 'SIMULATOR') return;

    const interval = setInterval(() => {
      // Compass slow natural drift
      setCompassHeading((prev) => (prev + (Math.random() * 1.2 - 0.6) + 360) % 360);

      // Sensor signal fluctuation
      const noise = Math.floor(Math.random() * 14 - 7);
      setAdcValue((prev) => {
        const next = Math.max(120, Math.min(980, prev + noise));
        return next;
      });

      setPhaseShift((prev) => {
        const pNoise = Math.floor(Math.random() * 4 - 2);
        return Math.max(-60, Math.min(60, prev + pNoise));
      });
    }, 500);

    return () => clearInterval(interval);
  }, [connectionState]);

  // Start new scan session
  const handleStartScan = () => {
    setIsScanActive(true);
    setCurrentCol(0);
    setCurrentRow(0);
    setActiveScanData([]);
    setActivePhaseData([]);
  };

  // Record single pulse step in scan mode
  const handleRecordStep = useCallback(() => {
    // Record only from a live source: real hardware, or the explicit demo simulator.
    const isDemo = connectionState === 'SIMULATOR';
    const hasLiveSource = isDemo || connectionState === 'BLUETOOTH' || connectionState === 'USB';
    if (!hasLiveSource) {
      setConnectionStatus('برای ثبت نقطه ابتدا سخت‌افزار را متصل کنید');
      return;
    }
    if (!isDemo && Date.now() - bluetoothHardware.state.lastPacketTime > 3000) {
      setConnectionStatus('داده تازه‌ای از سنسور دریافت نشده است');
      return;
    }

    let currentPulseAdc = adcValue;
    let currentPulsePhase = phaseShift;

    const totalPoints = gridWidth * gridLength;
    const currentIdx = activeScanData.length;

    if (currentIdx < totalPoints) {
      const x = currentIdx % gridWidth;
      const y = Math.floor(currentIdx / gridWidth);

      const centerX = Math.floor(gridWidth / 2);
      const centerY = Math.floor(gridLength / 2);
      const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));

      if (isDemo && dist < 1.8) {
        // High Gold Peak!
        currentPulseAdc = 850 + Math.floor(Math.random() * 60);
        currentPulsePhase = 45 + Math.floor(Math.random() * 10);
      } else if (isDemo && dist >= 1.8 && dist < 3.2) {
        // Cavity Drop surrounding
        currentPulseAdc = 170 + Math.floor(Math.random() * 30);
        currentPulsePhase = -40 + Math.floor(Math.random() * 10);
      }

      setActiveScanData((prev) => [...prev, currentPulseAdc]);
      setActivePhaseData((prev) => [...prev, currentPulsePhase]);

      // Calculate next cursor position
      const isZigZag = scanPattern.includes('Zig-Zag') || scanPattern.includes('زیگزاگ');
      const goingRight = !isZigZag || (y % 2 === 0);

      if (goingRight) {
        if (x < gridWidth - 1) {
          setCurrentCol(x + 1);
        } else if (y < gridLength - 1) {
          setCurrentRow(y + 1);
          setCurrentCol(isZigZag ? gridWidth - 1 : 0);
        }
      } else {
        if (x > 0) {
          setCurrentCol(x - 1);
        } else if (y < gridLength - 1) {
          setCurrentRow(y + 1);
          setCurrentCol(0);
        }
      }

      // If finished last point
      if (currentIdx + 1 >= totalPoints) {
        audioEngine.playScanCompleteChime();
      }
    }
  }, [adcValue, phaseShift, gridWidth, gridLength, activeScanData.length, scanPattern, connectionState]);

  // Cancel / Discard active scan
  const handleCancelScan = () => {
    setIsScanActive(false);
    setActiveScanData([]);
    setActivePhaseData([]);
  };

  // Complete scan and load into 3D Visualizer
  const handleCompleteScan = () => {
    const newScan: ScanRecord = {
      id: `scan-${Date.now()}`,
      name: `اسکن زمین (${new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })})`,
      date: new Date().toLocaleDateString('fa-IR'),
      width: gridWidth,
      length: gridLength,
      soilType,
      scanPattern,
      sensorType,
      gridData: activeScanData,
      phaseData: activePhaseData,
      maxDepthMeters: 4.5,
      notes: connectionState === 'SIMULATOR'
        ? 'داده نمایشی (شبیه‌ساز) — اندازه‌گیری واقعی نیست'
        : 'اسکن ثبت‌شده با درایور مگنتومتر OKM'
    };

    setSavedScans((prev) => [newScan, ...prev]);
    setViewedScan(newScan);
    setIsScanActive(false);
    setCurrentTab('visualizer');
  };

  // Save scan modal callback
  const handleSaveScanRecord = (name: string, notes: string) => {
    if (viewedScan) {
      const updated = { ...viewedScan, name, notes };
      setViewedScan(updated);
      setSavedScans((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    }
  };

  // Delete scan from history
  const handleDeleteScan = (id: string) => {
    setSavedScans((prev) => prev.filter((s) => s.id !== id));
    if (viewedScan && viewedScan.id === id) {
      setViewedScan(savedScans.find((s) => s.id !== id) || null);
    }
  };

  // Update scan coordinates
  const handleUpdateScanCoordinates = (scanId: string, lat: number, lng: number) => {
    setSavedScans((prev) =>
      prev.map((s) => (s.id === scanId ? { ...s, coordinates: { lat, lng } } : s))
    );
    if (viewedScan && viewedScan.id === scanId) {
      setViewedScan({ ...viewedScan, coordinates: { lat, lng } });
    }
  };

  // Navigate to AI with specific scan
  const handleNavigateToAiWithScan = (scan: ScanRecord) => {
    setViewedScan(scan);
    setCurrentTab('ai');
  };

  // If embed mode (e.g. from Android WebView or iframe)
  if (isEmbed) {
    return (
      <div className="w-full h-dvh bg-slate-950 text-slate-100 flex flex-col font-sans p-2 sm:p-3 overflow-y-auto dir-rtl" dir="rtl">
        <VisualizerTab
          viewedScan={viewedScan}
          onSaveScan={handleSaveScanRecord}
          onNavigateToAi={() => setCurrentTab('ai')}
          selectedNodeIndex={selectedNodeIndex}
          setSelectedNodeIndex={setSelectedNodeIndex}
        />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950 dir-rtl" dir="rtl">
      
      {/* Header */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        connectionState={connectionState}
        connectionStatus={connectionStatus}
        onAutoConnect={handleAutoConnect}
        onOpenBluetoothModal={() => setIsBluetoothModalOpen(true)}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {currentTab === 'scan' && (
          <ScanTab
            gridWidth={gridWidth}
            setGridWidth={setGridWidth}
            gridLength={gridLength}
            setGridLength={setGridLength}
            soilType={soilType}
            setSoilType={setSoilType}
            scanPattern={scanPattern}
            setScanPattern={setScanPattern}
            sensorType={sensorType}
            setSensorType={setSensorType}
            baudRate={baudRate}
            setBaudRate={setBaudRate}
            connectionState={connectionState}
            connectionStatus={connectionStatus}
            onOpenBluetoothModal={() => setIsBluetoothModalOpen(true)}
            compassHeading={compassHeading}
            isScanActive={isScanActive}
            onStartScan={handleStartScan}
            onCancelScan={handleCancelScan}
            onCompleteScan={handleCompleteScan}
            activeScanData={activeScanData}
            activePhaseData={activePhaseData}
            currentCol={currentCol}
            currentRow={currentRow}
            onRecordStep={handleRecordStep}
            adcValue={adcValue}
            phaseShift={phaseShift}
            onNavigateToAi={() => setCurrentTab('ai')}
          />
        )}

        {currentTab === 'visualizer' && (
          <VisualizerTab
            viewedScan={viewedScan}
            onSaveScan={handleSaveScanRecord}
            onNavigateToAi={() => setCurrentTab('ai')}
            selectedNodeIndex={selectedNodeIndex}
            setSelectedNodeIndex={setSelectedNodeIndex}
          />
        )}

        {currentTab === 'map' && (
          <MapTab
            scans={savedScans}
            viewedScan={viewedScan}
            onSelectScan={(scan) => {
              setViewedScan(scan);
              setCurrentTab('visualizer');
            }}
            onNavigateToAiWithScan={handleNavigateToAiWithScan}
            onUpdateScanCoordinates={handleUpdateScanCoordinates}
          />
        )}

        {currentTab === 'tracker' && (
          <TrackerTab
            adcValue={adcValue}
            phaseShift={phaseShift}
            connectionStatus={connectionStatus}
            onOpenBluetoothModal={() => setIsBluetoothModalOpen(true)}
          />
        )}

        {currentTab === 'history' && (
          <HistoryTab
            scans={savedScans}
            onLoadScan={(scan) => {
              setViewedScan(scan);
              setCurrentTab('visualizer');
            }}
            onDeleteScan={handleDeleteScan}
            onNavigateToAiWithScan={handleNavigateToAiWithScan}
          />
        )}

        {currentTab === 'ai' && (
          <AiAnalysisTab
            viewedScan={viewedScan}
            scans={savedScans}
            onLoadScan={(scan) => {
              setViewedScan(scan);
              setCurrentTab('visualizer');
            }}
          />
        )}

      </main>

      {/* Advanced Physical Bluetooth & Hardware Controller Modal */}
      <BluetoothTacticalModal
        isOpen={isBluetoothModalOpen}
        onClose={() => setIsBluetoothModalOpen(false)}
        onSelectSimulator={() => {
          setConnectionState('SIMULATOR');
          setConnectionStatus('شبیه‌ساز (Simulator)');
        }}
        onSelectHardwareConnected={(mode) => {
          if (mode === 'BLUETOOTH') {
            setConnectionState('BLUETOOTH');
            setConnectionStatus('بلوتوث فیزیکی متصل شد');
          } else {
            setConnectionState('USB');
            setConnectionStatus('کابل USB متصل شد');
          }
        }}
      />

      {/* Footer */}
      <footer className="bg-slate-900/60 border-t border-slate-800/80 py-4 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>AURAXIS X20 — Gold Radar X20 — Advanced Tactical Geophysical AI</div>
          <div>پشتیبانی از بلوتوث فیزیکی BLE 5.0، ماژول‌های HC-05/HM-10 و تفکیک آرتیفکت حرکتی</div>
        </div>
      </footer>

    </div>
  );
}
