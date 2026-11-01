import React from 'react';
import {
  Camera,
  Mic,
  Tv,
  Settings,
  Maximize2,
  Minimize2,
  Sparkles,
  History,
  Monitor
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'camera' | 'voice';
  setActiveTab: (tab: 'camera' | 'voice') => void;
  tvMode: boolean;
  setTvMode: (val: boolean) => void;
  openSettings: () => void;
  toggleHistory: () => void;
  historyCount: number;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  apiKeyConfigured: boolean;
  onSelectScreenShare?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  tvMode,
  setTvMode,
  openSettings,
  toggleHistory,
  historyCount,
  isFullscreen,
  toggleFullscreen,
  apiKeyConfigured,
  onSelectScreenShare,
}) => {
  return (
    <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-lime-600 to-emerald-400 p-0.5 shadow-lg shadow-lime-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-lime-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-lg tracking-wider text-white">
                TRANSLATE<span className="text-lime-400">ALL</span>
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-lime-500/10 text-lime-400 border border-lime-500/30">
                NVIDIA NIM
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Canlı Oyun, TV & Kamera Çevirici
            </p>
          </div>
        </div>

        {/* Center Mode Switcher */}
        <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'camera'
                ? 'bg-lime-500 text-slate-950 shadow-md shadow-lime-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Kamera / Ekran</span>
          </button>
          <button
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'voice'
                ? 'bg-lime-500 text-slate-950 shadow-md shadow-lime-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>Sesli Çeviri</span>
          </button>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-2">
          {/* PC Screen share button (if supported) */}
          {onSelectScreenShare && (
            <button
              onClick={onSelectScreenShare}
              title="PC Ekranı / Oyun Penceresi Paylaş"
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-lime-400 hover:border-lime-500/40 transition-colors hidden md:flex items-center gap-1.5 text-xs"
            >
              <Monitor className="w-4 h-4" />
              <span>Ekran Seç</span>
            </button>
          )}

          {/* TV Mode Toggle */}
          <button
            onClick={() => setTvMode(!tvMode)}
            title="TV / Altyazı Modu"
            className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-medium ${
              tvMode
                ? 'bg-lime-500/20 border-lime-500/50 text-lime-400'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span className="hidden lg:inline">{tvMode ? 'TV Modu: Açık' : 'TV Modu'}</span>
          </button>

          {/* Dialogue History */}
          <button
            onClick={toggleHistory}
            title="Diyalog Geçmişi"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white relative transition-colors"
          >
            <History className="w-4 h-4" />
            {historyCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-lime-500 text-slate-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {historyCount > 9 ? '9+' : historyCount}
              </span>
            )}
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            title="Tam Ekran"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Settings */}
          <button
            onClick={openSettings}
            title="Ayarlar (NVIDIA API Key)"
            className={`p-2 rounded-xl border transition-all relative ${
              !apiKeyConfigured
                ? 'bg-amber-500/20 border-amber-500 text-amber-400 animate-pulse'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-lime-400'
            }`}
          >
            <Settings className="w-4 h-4" />
            {!apiKeyConfigured && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full"></span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
