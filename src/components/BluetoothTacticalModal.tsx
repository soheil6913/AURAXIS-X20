import React, { useState, useEffect, useRef } from 'react';
import {
  bluetoothHardware,
  HardwareState,
  RawLogEntry,
  NativeBtDevice
} from '../utils/bluetoothHardware';
import {
  Bluetooth,
  Radio,
  Usb,
  X,
  RefreshCw,
  Terminal,
  Activity,
  Battery,
  Wifi,
  WifiOff,
  Zap,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Send,
  Cpu,
  Trash2,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';

interface BluetoothTacticalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSimulator: () => void;
  onSelectHardwareConnected: (mode: 'BLUETOOTH' | 'USB') => void;
}

export const BluetoothTacticalModal: React.FC<BluetoothTacticalModalProps> = ({
  isOpen,
  onClose,
  onSelectSimulator,
  onSelectHardwareConnected
}) => {
  const [hwState, setHwState] = useState<HardwareState>(bluetoothHardware.state);
  const [logs, setLogs] = useState<RawLogEntry[]>([]);
  const [customCommand, setCustomCommand] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [activeBaudRate, setActiveBaudRate] = useState<number>(115200);
  const [showHelp, setShowHelp] = useState<boolean>(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to hardware engine state and raw log events
  useEffect(() => {
    const unsubState = bluetoothHardware.onStateChange((newState) => {
      setHwState(newState);
      if (newState.isConnected) {
        if (newState.connectionType === 'BLE' || newState.connectionType === 'BT_CLASSIC') {
          onSelectHardwareConnected('BLUETOOTH');
        } else if (newState.connectionType === 'USB_SERIAL') {
          onSelectHardwareConnected('USB');
        }
      }
    });

    const unsubLog = bluetoothHardware.onRawLog((newLog) => {
      setLogs((prev) => [...prev.slice(-150), newLog]);
    });

    return () => {
      unsubState();
      unsubLog();
    };
  }, [onSelectHardwareConnected]);

  // Auto-scroll terminal
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Native Android bridge (real Bluetooth Classic SPP + BLE) device picker
  const isNative = bluetoothHardware.isNativeBluetoothAvailable();
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [pairedDevices, setPairedDevices] = useState<NativeBtDevice[]>([]);
  const [foundDevices, setFoundDevices] = useState<NativeBtDevice[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  useEffect(() => {
    const offDevice = bluetoothHardware.onNativeDevice((d) => {
      setFoundDevices((prev) => (prev.some((p) => p.address === d.address) ? prev : [...prev, d]));
    });
    const offScan = bluetoothHardware.onNativeScanState((active) => setIsScanning(active));
    const offPerm = bluetoothHardware.onNativePermission((granted) => {
      if (granted) {
        bluetoothHardware.nativeEnable();
        setPairedDevices(bluetoothHardware.nativePairedDevices());
      }
    });
    return () => {
      offDevice();
      offScan();
      offPerm();
    };
  }, []);

  const openNativePicker = () => {
    setShowPicker(true);
    setFoundDevices([]);
    if (!bluetoothHardware.nativeHasPermissions()) {
      bluetoothHardware.nativeRequestPermissions();
      return;
    }
    bluetoothHardware.nativeEnable();
    setPairedDevices(bluetoothHardware.nativePairedDevices());
  };

  const connectNativeDevice = (d: NativeBtDevice, mode: 'SPP' | 'BLE') => {
    bluetoothHardware.nativeStopScan();
    bluetoothHardware.connectNative(d.address, mode, d.name);
    setShowPicker(false);
  };

  if (!isOpen) return null;

  const handleConnectBle = async () => {
    if (isNative) {
      openNativePicker();
      return;
    }
    setIsConnecting(true);
    try {
      await bluetoothHardware.connectPhysicalBle();
    } catch (err: any) {
      // Error is logged to terminal by engine
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectUsb = async () => {
    setIsConnecting(true);
    try {
      await bluetoothHardware.connectPhysicalUsbSerial(activeBaudRate);
    } catch (err: any) {
      // Handled in engine
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await bluetoothHardware.disconnectHardware();
  };

  const handleSendCommand = (cmd: string) => {
    if (!cmd.trim()) return;
    bluetoothHardware.sendCommand(cmd);
    setCustomCommand('');
  };

  const isBleSupported = isNative || bluetoothHardware.isWebBluetoothSupported();
  const isSerialSupported = bluetoothHardware.isWebSerialSupported();

  return (
    <div className="fixed inset-0 z-[700] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden dir-rtl">
        
        {/* Modal Header */}
        <div className="bg-slate-950 border-b border-slate-800 p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-cyan-500/20">
              <Bluetooth className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">اتصال بلوتوث و ماژول رادار</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                  BLE 5.0 / SPP
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                ارتباط مستقیم با سنسورهای مگنتومتر Gold Radar X20، ماژول‌های HC-05/HM-10 و درایور CH340
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          
          {/* Hardware Connection Status Banner */}
          <div className={`p-4 rounded-2xl border transition-all ${
            hwState.isConnected
              ? 'bg-emerald-950/30 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
              : 'bg-slate-955 border-slate-800'
          }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-3.5 h-3.5 rounded-full ${
                  hwState.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                }`} />
                <div>
                  <div className="text-xs font-bold text-slate-400">وضعیت سخت‌افزار:</div>
                  <div className="text-sm font-black text-white flex items-center gap-2 mt-0.5">
                    {hwState.isConnected ? (
                      <span className="text-emerald-400 font-mono flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        سخت‌افزار متصل است ({hwState.deviceName})
                      </span>
                    ) : (
                      <span className="text-slate-300">سخت‌افزار متصل نیست (قطع ارتباط)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Real Metrics Badges */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                {hwState.batteryPercent !== null && (
                  <div className="flex items-center gap-1 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 text-emerald-400">
                    <Battery className="w-3.5 h-3.5" />
                    <span>{hwState.batteryPercent}%</span>
                  </div>
                )}
                {hwState.rssi !== null && (
                  <div className="flex items-center gap-1 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 text-cyan-400">
                    <Wifi className="w-3.5 h-3.5" />
                    <span>{hwState.rssi} dBm</span>
                  </div>
                )}
                <div className="flex items-center gap-1 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 text-amber-400">
                  <Activity className="w-3.5 h-3.5" />
                  <span>{hwState.packetsPerSecond} pkt/s</span>
                </div>
                <div className="flex items-center gap-1 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>{hwState.packetCount} بسته</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Bluetooth Connect Button */}
            <button
              onClick={handleConnectBle}
              disabled={isConnecting}
              className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center gap-2 transition-all font-bold text-xs ${
                hwState.isConnected && (hwState.connectionType === 'BLE' || hwState.connectionType === 'BT_CLASSIC')
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : 'bg-gradient-to-br from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-cyan-400/30 shadow-lg shadow-cyan-500/20'
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <Bluetooth className={`w-5 h-5 ${isConnecting ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <div className="text-sm font-black">اتصال بلوتوث (روشن کردن و جفت‌سازی)</div>
                <div className="text-[11px] text-cyan-200/80 font-normal mt-0.5">درخواست روشن‌شدن بلوتوث گوشی و اتصال به ماژول</div>
              </div>
            </button>

            {/* Serial USB Connect */}
            <button
              onClick={handleConnectUsb}
              disabled={isConnecting}
              className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center gap-2 transition-all font-bold text-xs ${
                hwState.isConnected && hwState.connectionType === 'USB_SERIAL'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center">
                <Usb className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-black">اتصال با کابل USB OTG</div>
                <div className="text-[11px] text-slate-400 font-normal mt-0.5">درایور سخت‌افزاری CH340 / CP2102</div>
              </div>
            </button>

            {/* Disconnect when connected */}
            {hwState.isConnected && (
              <div className="sm:col-span-2">
                <button
                  onClick={handleDisconnect}
                  className="w-full p-3 rounded-2xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 flex items-center justify-center text-center gap-2 transition font-bold text-xs"
                >
                  <WifiOff className="w-4 h-4 text-red-400" />
                  <span>قطع اتصال سخت‌افزار</span>
                </button>
              </div>
            )}
          </div>

          {/* Native device picker (Android app): paired Classic SPP + BLE scan */}
          {isNative && showPicker && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-cyan-500/30 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-cyan-300 flex items-center gap-2">
                  <Bluetooth className="w-4 h-4" />
                  انتخاب دستگاه بلوتوث
                </span>
                <button onClick={() => setShowPicker(false)} className="text-slate-500 hover:text-slate-300">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] text-slate-400">
                  دستگاه‌های جفت‌شده (برای ماژول‌های HC-05 / HC-06 با بلوتوث کلاسیک SPP):
                </div>
                {pairedDevices.length === 0 ? (
                  <div className="text-[11px] text-slate-500 bg-slate-900 rounded-xl p-3 leading-relaxed">
                    دستگاه جفت‌شده‌ای پیدا نشد. ابتدا ماژول را روشن کنید و در تنظیمات بلوتوث گوشی جفت کنید
                    (رمز معمولاً 1234 یا 0000 است)، سپس این پنجره را دوباره باز کنید.
                  </div>
                ) : (
                  pairedDevices.map((d) => (
                    <div key={d.address} className="flex items-center justify-between gap-2 bg-slate-900 rounded-xl p-2.5 border border-slate-800">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{d.name || 'دستگاه بدون نام'}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{d.address}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {d.type !== 'ble' && (
                          <button
                            onClick={() => connectNativeDevice(d, 'SPP')}
                            className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[11px] font-bold"
                          >
                            SPP
                          </button>
                        )}
                        {d.type !== 'classic' && (
                          <button
                            onClick={() => connectNativeDevice(d, 'BLE')}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[11px] font-bold"
                          >
                            BLE
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <button
                  onClick={() => bluetoothHardware.nativeOpenSettings()}
                  className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-[11px] font-bold"
                >
                  باز کردن تنظیمات بلوتوث گوشی (برای جفت‌سازی)
                </button>
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-slate-400">
                    جستجوی BLE (برای ماژول‌هایی مثل HM-10 یا Nordic UART):
                  </div>
                  <button
                    onClick={() => {
                      setFoundDevices([]);
                      bluetoothHardware.nativeStartScan();
                    }}
                    disabled={isScanning}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-bold disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>{isScanning ? 'در حال جستجو...' : 'جستجو'}</span>
                  </button>
                </div>
                {foundDevices.map((d) => (
                  <div key={d.address} className="flex items-center justify-between gap-2 bg-slate-900 rounded-xl p-2.5 border border-slate-800">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{d.name || 'دستگاه BLE بدون نام'}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {d.address}
                        {d.rssi !== undefined ? ` • ${d.rssi} dBm` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => connectNativeDevice(d, 'BLE')}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[11px] font-bold shrink-0"
                    >
                      اتصال BLE
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Hardware Commands */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-2 text-amber-400">
                <Radio className="w-4 h-4" />
                ارسال فرامین سخت‌افزاری (Hardware Commands):
              </span>
              <span className="text-[10px] text-slate-500 font-mono">UART TX String</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => handleSendCommand('TARE')}
                disabled={!hwState.isConnected}
                className="p-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-400 disabled:opacity-40 text-amber-300 font-mono text-xs flex items-center justify-center gap-1.5 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>کالیبراسیون و صفر (TARE)</span>
              </button>

              <button
                onClick={() => handleSendCommand('PING')}
                disabled={!hwState.isConnected}
                className="p-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-400 disabled:opacity-40 text-cyan-300 font-mono text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>استعلام پالس (PING)</span>
              </button>

              <button
                onClick={() => handleSendCommand('RATE,10')}
                disabled={!hwState.isConnected}
                className="p-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-emerald-400 disabled:opacity-40 text-emerald-300 font-mono text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>نرخ 10Hz (RATE)</span>
              </button>

              <button
                onClick={() => handleSendCommand('LED,1')}
                disabled={!hwState.isConnected}
                className="p-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-purple-400 disabled:opacity-40 text-purple-300 font-mono text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Play className="w-3.5 h-3.5" />
                <span>روشنایی ال‌ای‌دی (LED)</span>
              </button>
            </div>

            {/* Custom ASCII Command Input */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendCommand(customCommand)}
                placeholder="دستور سفارشی UART (مثلاً: $OKM,GET_INFO)"
                disabled={!hwState.isConnected}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:border-amber-400 outline-none"
              />
              <button
                onClick={() => handleSendCommand(customCommand)}
                disabled={!hwState.isConnected || !customCommand.trim()}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 rounded-xl font-bold text-xs flex items-center gap-1.5 transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>ارسال</span>
              </button>
            </div>
          </div>

          {/* Real-time Hardware Terminal (Raw Hex & ASCII Log) */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 font-bold text-white">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>ترمینال داده‌های خام سنسور (Hardware Live Monitor)</span>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-amber-400"
                  />
                  <span>اسکرول خودکار</span>
                </label>

                <button
                  onClick={() => setLogs([])}
                  className="p-1 text-slate-500 hover:text-slate-300 transition"
                  title="پاک کردن ترمینال"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Terminal Window */}
            <div className="bg-black/90 rounded-xl p-3 h-48 overflow-y-auto font-mono text-[11px] space-y-1.5 dir-ltr text-left border border-slate-900">
              {logs.length === 0 ? (
                <div className="text-slate-600 italic text-center py-10 dir-rtl">
                  در انتظار اتصال و دریافت بایت‌های فیزیکی از دستگاه...
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="leading-tight flex items-start gap-2">
                    <span className="text-slate-600 shrink-0">
                      {new Date(log.timestamp).toISOString().slice(11, 19)}
                    </span>
                    <span
                      className={`font-bold px-1 rounded text-[10px] shrink-0 ${
                        log.direction === 'RX'
                          ? 'bg-emerald-950 text-emerald-400'
                          : log.direction === 'TX'
                          ? 'bg-amber-950 text-amber-400'
                          : 'bg-cyan-950 text-cyan-400'
                      }`}
                    >
                      {log.direction}
                    </span>
                    <span
                      className={`break-all ${
                        log.direction === 'RX'
                          ? 'text-emerald-300'
                          : log.direction === 'TX'
                          ? 'text-amber-300'
                          : 'text-slate-400'
                      }`}
                    >
                      {log.text}
                      {log.hex && <span className="text-slate-600 ml-2">[{log.hex}]</span>}
                    </span>
                  </div>
                ))
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>

          {/* Browser Diagnostic & Protocol Notice */}
          <div className="bg-slate-955 p-3.5 rounded-2xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                وضعیت سازگاری مرورگر با اتصال فیزیکی:
              </span>
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="text-cyan-400 hover:underline flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>راهنمای فعال‌سازی در اندروید</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
              <div className={`p-2 rounded-lg border flex items-center gap-2 ${
                isBleSupported ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400' : 'bg-red-950/20 border-red-500/30 text-red-400'
              }`}>
                <span>{isNative ? '✓ بلوتوث بومی اندروید (SPP و BLE)' : isBleSupported ? '✓ Web Bluetooth API فعال است' : '✗ Web Bluetooth پشتیبانی نمی‌شود'}</span>
              </div>
              <div className={`p-2 rounded-lg border flex items-center gap-2 ${
                isSerialSupported ? 'bg-cyan-950/20 border-cyan-500/30 text-cyan-400' : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}>
                <span>{isSerialSupported ? '✓ Web Serial USB فعال است' : '✗ Web Serial در این بستر در دسترس نیست'}</span>
              </div>
            </div>

            {showHelp && (
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-slate-300 mt-2 space-y-1 leading-relaxed">
                <p className="font-bold text-amber-400">راهنمای اتصال بلوتوث در گوشی:</p>
                <p>۱. هنگام لمس دکمه اتصال بلوتوث، درخواست روشن شدن بلوتوث گوشی به صورت خودکار برای سیستم ارسال می‌شود.</p>
                <p>۲. دستگاه رادار یا ماژول HC-05 / HM-10 را روشن کنید.</p>
                <p>۳. دستگاه موردنظر را از پنجره اسکن انتخاب کرده تا تبادل داده بلادرنگ آغاز گردد.</p>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-950 border-t border-slate-800 p-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400 font-mono">
            پروتکل‌های پشتیبانی‌شده: OKM NMEA, Nordic NUS, HM-10, CH340
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-lg shadow-amber-400/20 transition"
          >
            بستن و ادامه اسکن
          </button>
        </div>

      </div>
    </div>
  );
};
