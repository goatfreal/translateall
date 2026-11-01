import React from 'react';
import {
  Tv,
  Gamepad2,
  Mic,
  Volume2,
  VolumeX,
  Settings,
  History,
  Monitor,
  Sparkles,
  Zap,
  ArrowRight,
  Languages,
  CheckCircle2,
} from 'lucide-react';
import type { AppSettings, TranslationResult } from '../types';

interface MainMenuProps {
  onStartCamera: () => void;
  onStartPs5: () => void;
  onStartVoice: () => void;
  onStartScreenShare: () => void;
  openSettings: () => void;
  openHistory: () => void;
  settings: AppSettings;
  onToggleTts: () => void;
  onToggleVoiceType: () => void;
  historyCount: number;
  lastTranslation?: TranslationResult | null;
  onSpeak: (text: string) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onStartCamera,
  onStartPs5,
  onStartVoice,
  onStartScreenShare,
  openSettings,
  openHistory,
  settings,
  onToggleTts,
  onToggleVoiceType,
  historyCount,
  lastTranslation,
  onSpeak,
}) => {
  const isPc = typeof window !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;

  return (
    <div className="flex-1 flex flex-col justify-between max-w-4xl mx-auto w-full px-4 safe-header safe-bottom animate-in fade-in duration-300">
      {/* Top Bar: Brand & Quick Settings (Positioned safely below iPhone Dynamic Island & Clock) */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Tv className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Game<span className="text-emerald-400">Caption</span> AI
              </h1>
              <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                NVIDIA NIM
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Konsol & TV Canlı Oyun Çevirisi & Dublajı
            </p>
          </div>
        </div>

        {/* Action icons (Large touch targets for iPhone) */}
        <div className="flex items-center gap-2">
          <button
            onClick={openHistory}
            className="p-3 sm:px-3 sm:py-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-white/15 text-slate-200 active:scale-95 transition flex items-center gap-2 text-xs font-semibold cursor-pointer shadow-md min-h-[44px] min-w-[44px] justify-center"
            title="Geçmiş Çeviriler"
          >
            <History className="w-5 h-5 text-emerald-400" />
            <span className="hidden sm:inline">Geçmiş</span>
            {historyCount > 0 && (
              <span className="bg-emerald-500 text-slate-950 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {historyCount}
              </span>
            )}
          </button>

          <button
            onClick={openSettings}
            className="p-3 sm:px-3 sm:py-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-white/15 text-slate-200 active:scale-95 transition flex items-center gap-2 text-xs font-semibold cursor-pointer shadow-md min-h-[44px] min-w-[44px] justify-center"
            title="Ayarlar"
          >
            <Settings className="w-5 h-5 text-emerald-400" />
            <span className="hidden sm:inline">Ayarlar</span>
          </button>
        </div>
      </div>

      {/* Hero Quick Banner & Spoken Audio Controls */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-blue-950/40 border border-emerald-500/20 p-4 sm:p-5 mb-4 backdrop-blur-md">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              GameCaption Sesli Altyazı Sistemi
            </div>
            <p className="text-xs sm:text-sm text-slate-200 font-medium">
              Altyazıları yeşil kutuyla algılar, hem ekranda Türkçe gösterir hem de anında sesli dublaj yapar.
            </p>
          </div>

          {/* Audio Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onToggleVoiceType}
              className="px-3 py-2 rounded-xl border border-white/15 bg-slate-900 text-xs font-bold text-slate-200 hover:text-white cursor-pointer active:scale-95"
              title="Ses Motoru"
            >
              {settings.voiceType === 'natural' ? '🌟 Doğal Türkçe Ses' : '📱 Cihaz Sesi'}
            </button>

            <button
              onClick={onToggleTts}
              className={`px-4 py-2 rounded-xl border font-black text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer active:scale-95 ${
                settings.enableTts
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300'
                  : 'bg-slate-800 border-white/10 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {settings.enableTts ? (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span>Sesli Dublaj: <strong>AÇIK</strong></span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-400" />
                  <span>Sesli Dublaj: <strong>KAPALI</strong></span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Choice Cards: Camera Mode | PS5 Remote Play | Voice */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-4">
        {/* Card 1: Camera Mode (GameCaption) */}
        <button
          onClick={onStartCamera}
          className="group relative flex flex-col justify-between p-5 rounded-3xl bg-gradient-to-b from-slate-900/95 to-slate-950/95 border-2 border-emerald-500/50 hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-300 text-left overflow-hidden cursor-pointer active:scale-[0.98]"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-110 transition duration-300">
              <Tv className="w-6 h-6" />
            </div>

            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-black text-white group-hover:text-emerald-300 transition">
                Kamera Modu
              </h2>
              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500 text-slate-950">
                Popüler
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Telefonu TV/monitöre çevirin. Yeşil altyazı kutusunu hizalayıp canlı Türkçe dublaj alın.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2.5 border-t border-white/10 text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition">
            <span className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              Kamerayı Başlat
            </span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        {/* Card 2: PS5 Remote Play Mode (GameCaption) */}
        <button
          onClick={onStartPs5}
          className="group relative flex flex-col justify-between p-5 rounded-3xl bg-gradient-to-b from-slate-900/95 to-slate-950/95 border-2 border-blue-500/40 hover:border-blue-400 hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 text-left overflow-hidden cursor-pointer active:scale-[0.98]"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 mb-3 group-hover:scale-110 transition duration-300">
              <Gamepad2 className="w-6 h-6" />
            </div>

            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-black text-white group-hover:text-blue-300 transition">
                PS5 Modu
              </h2>
              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-blue-500 text-white">
                Remote Play
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Kamerasız yerel Wi-Fi akışı. PS5 görüntüsünü doğrudan aktarıp ekrandan çevirir.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2.5 border-t border-white/10 text-xs font-bold text-blue-400 group-hover:translate-x-1 transition">
            <span className="flex items-center gap-1">
              <Gamepad2 className="w-3.5 h-3.5" />
              PS5'e Bağlan
            </span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        {/* Card 3: Voice Translation */}
        <button
          onClick={onStartVoice}
          className="group relative flex flex-col justify-between p-5 rounded-3xl bg-gradient-to-b from-slate-900/95 to-slate-950/95 border border-white/15 hover:border-teal-400/60 hover:shadow-2xl hover:shadow-teal-500/20 transition-all duration-300 text-left overflow-hidden cursor-pointer active:scale-[0.98]"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-3 group-hover:scale-110 transition duration-300">
              <Mic className="w-6 h-6" />
            </div>

            <h2 className="text-lg font-black text-white group-hover:text-teal-300 transition mb-1">
              Ses & Sohbet
            </h2>

            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Mikrofonu dinler, oyun konuşmalarını anında Türkçe&apos;ye çevirip seslendirir.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2.5 border-t border-white/10 text-xs font-bold text-teal-400 group-hover:translate-x-1 transition">
            <span className="flex items-center gap-1">
              <Languages className="w-3.5 h-3.5" />
              Mikrofonu Başlat
            </span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* Screen Share Card (PC / Desktop only) */}
      {isPc && (
        <div className="mb-4">
          <button
            onClick={onStartScreenShare}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/70 hover:bg-slate-800/90 border border-white/10 hover:border-white/20 transition text-left cursor-pointer active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  PC Ekran Paylaşımı
                  <span className="text-[9px] text-slate-400 bg-white/10 px-1.5 py-0.2 rounded">Masaüstü</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Oyun penceresini doğrudan seçin, kameraya gerek kalmadan ekrandan çevirsin.
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      )}

      {/* Last Translation Quick Card with Speak Button */}
      {lastTranslation && (
        <div className="rounded-2xl bg-slate-900/80 border border-white/15 p-3 mb-4 flex items-center justify-between gap-3 shadow-lg">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1 mb-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Son Çeviri
            </div>
            <div className="text-xs font-bold text-white truncate">
              {lastTranslation.translatedText}
            </div>
            {lastTranslation.originalText && (
              <div className="text-[11px] text-slate-400 truncate">
                {lastTranslation.originalText}
              </div>
            )}
          </div>
          <button
            onClick={() => onSpeak(lastTranslation.translatedText)}
            className="p-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 transition cursor-pointer active:scale-95 flex items-center gap-1 text-xs font-bold"
            title="Sesli Dinle"
          >
            <Volume2 className="w-4 h-4" />
            <span>Dinle</span>
          </button>
        </div>
      )}

      {/* Footer System Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 pt-2 border-t border-white/5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>GameCaption v2.5 • PS5 Remote Play & Kamera Çevirisi</span>
        </div>
        <div>
          Hedef Dil: <strong>Türkçe</strong>
        </div>
      </div>
    </div>
  );
};
