import React, { useState, useEffect } from 'react';
import { ConnectionMode } from '../types';
import {
  Map,
  Box,
  TrendingUp,
  History,
  Sparkles,
  Volume2,
  VolumeX,
  Usb,
  Bluetooth,
  Activity,
  Smartphone,
  Download,
  X,
  CheckCircle2,
  Share2,
  Globe
} from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  connectionState: ConnectionMode;
  connectionStatus: string;
  onAutoConnect: () => void;
  onOpenBluetoothModal?: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  connectionState,
  connectionStatus,
  onAutoConnect,
  onOpenBluetoothModal,
  isMuted,
  onToggleMute
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const isNativeApp = /; wv\)/.test(navigator.userAgent);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  const getConnectionBadgeColor = () => {
    switch (connectionState) {
      case 'DISCONNECTED': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'CONNECTING_USB':
      case 'CONNECTING_BT': return 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse';
      case 'USB': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'BLUETOOTH': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'SIMULATOR': return 'bg-amber-400/20 text-amber-300 border-amber-400/30';
    }
  };

  const getConnectionIcon = () => {
    switch (connectionState) {
      case 'USB': return <Usb className="w-3.5 h-3.5 text-emerald-400" />;
      case 'BLUETOOTH': return <Bluetooth className="w-3.5 h-3.5 text-cyan-400" />;
      case 'SIMULATOR': return <Activity className="w-3.5 h-3.5 text-amber-400" />;
      default: return <Activity className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2 py-2">
          
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-cyan-400 p-0.5 shadow-lg shadow-amber-500/10">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Box className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-wider text-amber-400 font-mono">
                  AURAXIS X20
                </h1>
                <span className="text-[10px] px-1.5 py-0.5 bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 rounded font-mono font-semibold">
                  TACTICAL AI
                </span>
              </div>
              <p className="hidden sm:block text-xs text-slate-400">Gold Radar X20 — فیوژن هوشمند سنسورها و رادار زمین</p>
            </div>
          </div>

          {/* Right Action Widgets */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile App Install Button */}
            <button
              onClick={handleInstallClick}
              className={`${isNativeApp ? 'hidden' : 'flex'} items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs shadow-md shadow-amber-400/20 hover:scale-105 transition`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">نصب روی گوشی</span>
              <span className="sm:hidden">نصب</span>
            </button>

            {/* Audio Feedback Toggle */}
            <button
              onClick={onToggleMute}
              title={isMuted ? 'فعال‌سازی صوت پالس' : 'قطع صوت پالس'}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
            </button>

            {/* Connection Status Button */}
            <button
              onClick={() => {
                if (onOpenBluetoothModal) {
                  onOpenBluetoothModal();
                } else {
                  onAutoConnect();
                }
              }}
              title="ترمینال اتصال بلوتوث و ماژول‌های رادار"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all hover:scale-102 min-w-0 ${getConnectionBadgeColor()}`}
            >
              {getConnectionIcon()}
              <span className="truncate max-w-[9rem] sm:max-w-none">{connectionStatus}</span>
            </button>
          </div>
        </div>

        {/* Installation Modal */}
        {showInstallModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl relative">
              <button
                onClick={() => setShowInstallModal(false)}
                className="absolute left-4 top-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-400/20">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">نصب اپلیکیشن AURAXIS X20 روی موبایل</h3>
                  <p className="text-xs text-amber-400 font-mono">نصب به صورت PWA بدون نیاز به بازار یا گوگل پلی</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-300 bg-slate-955 p-4 rounded-2xl border border-slate-800">
                <div className="font-bold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>راهنمای نصب اندروید (Chrome / Firefox):</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-400 pr-1">
                  <li>منوی سه نقطه مرورگر (بالا سمت راست) را باز کنید.</li>
                  <li>گزینه <strong className="text-amber-400">«افزودن به صفحه اصلی» (Add to Home Screen)</strong> یا <strong className="text-amber-400">«نصب اپلیکیشن» (Install App)</strong> را انتخاب کنید.</li>
                  <li>آیکون OKM 3D روی صفحه گوشی شما قرار می‌گیرد.</li>
                </ol>

                <div className="font-bold text-white border-b border-slate-800 pb-2 pt-2 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-cyan-400" />
                  <span>راهنمای نصب آیفون iOS (Safari):</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-400 pr-1">
                  <li>در مرورگر Safari روی دکمه <strong className="text-cyan-400">Share (اشتراک‌گذاری)</strong> در پایین صفحه بزنید.</li>
                  <li>گزینه <strong className="text-cyan-400">Add to Home Screen</strong> را انتخاب کنید.</li>
                </ol>
              </div>

              <button
                onClick={() => setShowInstallModal(false)}
                className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-2xl text-xs transition"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs Bar */}
        <nav className="flex items-center justify-around sm:justify-start gap-1 sm:gap-2 pt-1 pb-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => onTabChange('scan')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              currentTab === 'scan'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Map className="w-4 h-4" />
            <span>اسکن (Scan)</span>
          </button>

          <button
            onClick={() => onTabChange('visualizer')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              currentTab === 'visualizer'
                ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Box className="w-4 h-4" />
            <span>سه‌بعدی (3D)</span>
          </button>

          <button
            onClick={() => onTabChange('map')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              currentTab === 'map'
                ? 'bg-emerald-400 text-slate-950 shadow-md shadow-emerald-400/20 font-extrabold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>نقشه (GIS Map)</span>
          </button>

          <button
            onClick={() => onTabChange('tracker')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              currentTab === 'tracker'
                ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>زنده (Live)</span>
          </button>

          <button
            onClick={() => onTabChange('history')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              currentTab === 'history'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <History className="w-4 h-4" />
            <span>تاریخچه (History)</span>
          </button>

          <button
            onClick={() => onTabChange('ai')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              currentTab === 'ai'
                ? 'bg-gradient-to-r from-amber-400 to-cyan-400 text-slate-950 shadow-md shadow-amber-400/20 font-extrabold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>هوش مصنوعی (AI)</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
