import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RefreshCw,
  Zap,
  Volume2,
  VolumeX,
  AlertCircle,
  ArrowLeft,
  Radio,
  SlidersHorizontal,
} from 'lucide-react';
import type { AppSettings, TranslationResult } from '../types';
import { translateImageFrame } from '../services/nvidiaApi';
import { voiceManager } from '../services/voiceService';

interface CameraViewProps {
  settings: AppSettings;
  onNewTranslation: (result: TranslationResult) => void;
  isTranslating: boolean;
  setIsTranslating: (val: boolean) => void;
  onError: (err: string) => void;
  screenStream: MediaStream | null;
  onClearScreenStream: () => void;
  onSpeak: (text: string) => void;
  onBackToMenu: () => void;
  onToggleTts: () => void;
  currentResult: TranslationResult | null;
}

type RoiPreset = 'bottom' | 'middle' | 'wide';

export const CameraView: React.FC<CameraViewProps> = ({
  settings,
  onNewTranslation,
  isTranslating,
  setIsTranslating,
  onError,
  screenStream,
  onClearScreenStream,
  onSpeak,
  onBackToMenu,
  onToggleTts,
  currentResult,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isLiveAuto, setIsLiveAuto] = useState<boolean>(true);
  const [isFrozen, setIsFrozen] = useState<boolean>(false);
  const [hasCameraError, setHasCameraError] = useState<string | null>(null);
  const [isSpeakingNow, setIsSpeakingNow] = useState<boolean>(false);
  const [roiPreset, setRoiPreset] = useState<RoiPreset>('bottom');
  const lastFrameHashRef = useRef<string>('');

  // Unlock iOS audio context on any touch
  const handleTouchUnlock = () => {
    voiceManager.unlockAudio();
  };

  // ROI Preset Configurations (GameCaption Style)
  const getRoiBox = (preset: RoiPreset) => {
    switch (preset) {
      case 'middle':
        return { x: 8, y: 38, width: 84, height: 26 }; // RPG Dialogue choices
      case 'wide':
        return { x: 5, y: 25, width: 90, height: 50 }; // Menu, Quest, Inventory
      case 'bottom':
      default:
        return { x: 6, y: 68, width: 88, height: 24 }; // Standard TV game subtitle area
    }
  };

  const activeRoi = getRoiBox(roiPreset);

  // Start video stream
  const startCamera = useCallback(async () => {
    try {
      setHasCameraError(null);

      if (screenStream) {
        if (videoRef.current) {
          videoRef.current.srcObject = screenStream;
          videoRef.current.play();
        }
        return;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = newStream;

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Kamera açma hatası:', err);
      let errMsg = 'Kamera başlatılamadı. Lütfen kamera izinlerini kontrol edin.';
      if (err.name === 'NotAllowedError') {
        errMsg = 'Kamera erişim izni reddedildi. Lütfen cihaz ayarlarından kamera izni verin.';
      } else if (err.name === 'NotFoundError') {
        errMsg = 'Kullanılabilir kamera bulunamadı.';
      }
      setHasCameraError(errMsg);
      onError(errMsg);
    }
  }, [facingMode, screenStream, onError]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [startCamera]);

  // Frame luminance hash to skip duplicate API calls when game dialogue is static
  const computeQuickHash = (ctx: CanvasRenderingContext2D, width: number, height: number): string => {
    try {
      const stepX = Math.max(1, Math.floor(width / 8));
      const stepY = Math.max(1, Math.floor(height / 8));
      const imgData = ctx.getImageData(0, 0, width, height).data;
      let hash = '';
      for (let y = 0; y < height; y += stepY) {
        for (let x = 0; x < width; x += stepX) {
          const idx = (y * width + x) * 4;
          const lum = Math.round((imgData[idx] * 0.299 + imgData[idx + 1] * 0.587 + imgData[idx + 2] * 0.114) / 32);
          hash += lum.toString(16);
        }
      }
      return hash;
    } catch {
      return '';
    }
  };

  // Capture frame strictly inside the GameCaption Green Box
  const captureFrame = useCallback((checkDiff: boolean = false): { base64: string; changed: boolean } | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // Crop strictly inside active ROI box
    const rx = Math.round((activeRoi.x / 100) * vw);
    const ry = Math.round((activeRoi.y / 100) * vh);
    const rw = Math.round((activeRoi.width / 100) * vw);
    const rh = Math.round((activeRoi.height / 100) * vh);

    const targetW = Math.min(540, rw);
    const targetH = Math.round((targetW * rh) / rw);

    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Draw strictly the green target box contents
    ctx.drawImage(video, rx, ry, rw, rh, 0, 0, targetW, targetH);

    let changed = true;
    if (checkDiff) {
      const currentHash = computeQuickHash(ctx, targetW, targetH);
      if (currentHash && currentHash === lastFrameHashRef.current) {
        changed = false;
      } else {
        lastFrameHashRef.current = currentHash;
      }
    }

    const base64 = canvas.toDataURL('image/jpeg', 0.72);
    return { base64, changed };
  }, [activeRoi]);

  // Translate and Auto-Dub
  const handleTranslateCurrentFrame = useCallback(async (isAutoScan: boolean = false) => {
    if (isTranslating) return;

    if (!settings.nvidiaApiKey || settings.nvidiaApiKey.trim() === '') {
      onError('Lütfen Ayarlar sekmesinden NVIDIA API Anahtarınızı girin.');
      return;
    }

    const captureResult = captureFrame(isAutoScan);
    if (!captureResult) return;

    // Skip if in-game subtitle didn't change
    if (isAutoScan && !captureResult.changed) {
      return;
    }

    try {
      setIsTranslating(true);

      const result = await translateImageFrame(
        captureResult.base64,
        settings.targetLanguage === 'tr' ? 'Turkish' : settings.targetLanguage,
        settings.nvidiaApiKey,
        settings.visionModel
      );

      if (result && result.translatedText) {
        onNewTranslation(result);

        // GameCaption Auto-Dubbing: Speak Turkish dialogue aloud immediately
        if (settings.enableTts) {
          setIsSpeakingNow(true);
          onSpeak(result.translatedText);
          setTimeout(() => setIsSpeakingNow(false), 3000);
        }
      }
    } catch (err: any) {
      if (!isAutoScan) {
        onError(err?.message || 'Çeviri sırasında bir hata oluştu.');
      }
    } finally {
      setIsTranslating(false);
    }
  }, [
    isTranslating,
    settings.nvidiaApiKey,
    settings.targetLanguage,
    settings.visionModel,
    settings.enableTts,
    captureFrame,
    setIsTranslating,
    onNewTranslation,
    onSpeak,
    onError,
  ]);

  // Live Auto-Scan Loop
  useEffect(() => {
    if (!isLiveAuto || isFrozen) return;

    const intervalMs = Math.max(1200, settings.autoIntervalSeconds * 1000);
    const interval = setInterval(() => {
      if (!isTranslating) {
        handleTranslateCurrentFrame(true);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isLiveAuto, isFrozen, isTranslating, settings.autoIntervalSeconds, handleTranslateCurrentFrame]);

  // Toggle Camera
  const toggleFacingMode = () => {
    handleTouchUnlock();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Toggle Freeze Frame
  const toggleFreeze = () => {
    handleTouchUnlock();
    const video = videoRef.current;
    if (!video) return;

    if (isFrozen) {
      video.play();
      setIsFrozen(false);
    } else {
      video.pause();
      setIsFrozen(true);
      handleTranslateCurrentFrame(false);
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleTouchUnlock}
      className="relative w-full h-[92vh] max-h-[92vh] flex flex-col items-center justify-between bg-black overflow-hidden rounded-3xl border border-slate-800 shadow-2xl select-none"
    >
      <canvas ref={canvasRef} className="hidden" />

      {/* TOP BAR (SAFE AREA PADDED FOR IPHONE CLOCK & NOTCH) */}
      <div className="absolute top-0 left-0 right-0 z-30 px-3 sm:px-4 pt-12 pb-3 bg-gradient-to-b from-slate-950 via-slate-950/80 to-transparent flex items-center justify-between gap-2 backdrop-blur-sm">
        {/* Back Button */}
        <button
          onClick={onBackToMenu}
          className="px-3.5 py-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition cursor-pointer min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
          <span>Menü</span>
        </button>

        {/* Center Live Badge */}
        <div className="flex items-center gap-1.5">
          {isTranslating ? (
            <div className="px-3 py-1.5 bg-emerald-500 text-slate-950 text-xs font-black rounded-full flex items-center gap-1.5 shadow-lg shadow-emerald-500/40 animate-pulse">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>ÇEVRİLİYOR</span>
            </div>
          ) : (
            <div className="px-3 py-1.5 bg-black/80 border border-white/15 rounded-full text-[11px] font-bold text-slate-200 flex items-center gap-1.5 backdrop-blur-md">
              <span className={`w-2 h-2 rounded-full ${isLiveAuto ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{isLiveAuto ? 'CANLI TARAMA' : 'DURAKLATILDI'}</span>
            </div>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* TTS Dubbing Toggle Button */}
          <button
            onClick={() => {
              handleTouchUnlock();
              onToggleTts();
            }}
            className={`px-3 py-2 rounded-2xl border text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer min-h-[44px] ${
              settings.enableTts
                ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300 shadow-emerald-500/20'
                : 'bg-slate-900/90 border-white/15 text-slate-400 hover:text-white'
            }`}
            title="Sesli Dublajı Aç/Kapat"
          >
            {settings.enableTts ? (
              <>
                <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>Dublaj: AÇIK</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-slate-400" />
                <span>Dublaj: KAPALI</span>
              </>
            )}
          </button>

          {/* Camera Flip */}
          {!screenStream && (
            <button
              onClick={toggleFacingMode}
              className="p-2.5 rounded-2xl bg-slate-900/90 border border-white/15 text-slate-300 hover:text-white active:scale-95 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Kamera Değiştir (Ön/Arka)"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {screenStream && (
            <button
              onClick={onClearScreenStream}
              className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 font-bold text-xs"
            >
              Ekranı Kapat
            </button>
          )}
        </div>
      </div>

      {/* GAMECAPTION LIVE FLOATING SUBTITLE BANNER (TOP OVERLAY) */}
      {currentResult && currentResult.translatedText && (
        <div className="absolute top-24 left-3 right-3 z-30 max-w-2xl mx-auto animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="rounded-2xl bg-black/95 border-2 border-emerald-400 shadow-[0_10px_35px_rgba(0,0,0,0.9)] p-3.5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-2 mb-1 pb-1 border-b border-white/10 text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-400 font-black">
                {isSpeakingNow ? (
                  <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>{isSpeakingNow ? 'Seslendiriliyor...' : 'Türkçe Altyazı'}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[10px]">⚡ {currentResult.latencyMs}ms</span>
                <button
                  onClick={() => {
                    handleTouchUnlock();
                    onSpeak(currentResult.translatedText);
                  }}
                  className="px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-black text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  <Volume2 className="w-3 h-3" /> Tekrar Oku
                </button>
              </div>
            </div>

            {/* Subtitle High-Contrast Golden / White Text */}
            <div className="text-amber-300 font-black text-base sm:text-xl leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
              {currentResult.translatedText}
            </div>

            {currentResult.originalText && (
              <div className="text-slate-400 text-xs mt-1 italic font-medium truncate">
                {currentResult.originalText}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIDEO VIEWPORT WITH GAMECAPTION GREEN TARGET FRAME */}
      <div className="relative w-full flex-1 flex items-center justify-center min-h-[360px] overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`w-full h-full object-cover ${
            facingMode === 'user' && !screenStream ? 'scale-x-[-1]' : ''
          }`}
        />

        {/* Error Screen */}
        {hasCameraError && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-20">
            <AlertCircle className="w-12 h-12 text-rose-500 mb-3 animate-bounce" />
            <h3 className="text-lg font-bold text-white mb-2">Kamera Açılamadı</h3>
            <p className="text-sm text-slate-400 max-w-md mb-4">{hasCameraError}</p>
            <button
              onClick={startCamera}
              className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl flex items-center gap-2 hover:bg-emerald-400"
            >
              <RefreshCw className="w-4 h-4" /> Yeniden Dene
            </button>
          </div>
        )}

        {/* GAMECAPTION GREEN SUBTITLE TARGET BOX (YEŞİL ALTYAZI KUTUSU) */}
        <div
          className="absolute border-2 border-emerald-400 rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.35)] pointer-events-none transition-all duration-300"
          style={{
            left: `${activeRoi.x}%`,
            top: `${activeRoi.y}%`,
            width: `${activeRoi.width}%`,
            height: `${activeRoi.height}%`,
          }}
        >
          {/* Corner Brackets (GameCaption Design) */}
          <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-300 rounded-tl" />
          <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-300 rounded-tr" />
          <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-300 rounded-bl" />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-300 rounded-br" />

          {/* Subtitle Alignment Guide Label */}
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 px-3 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1 whitespace-nowrap">
            <span>🎯 Oyun Altyazısını Bu Yeşil Kutunun İçine Hizalayın</span>
          </div>
        </div>
      </div>

      {/* GAMECAPTION PRESET SELECTOR & BOTTOM CONTROLS */}
      <div className="w-full bg-slate-950/95 pt-2 pb-6 px-3 sm:px-4 z-20 flex flex-col gap-2.5 border-t border-slate-900 backdrop-blur-md safe-bottom">
        {/* Preset Selector Buttons: Alt Altyazı | Orta Diyalog | Geniş Alan */}
        <div className="flex items-center justify-center gap-1.5 w-full">
          <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1 mr-1">
            <SlidersHorizontal className="w-3 h-3 text-emerald-400" /> Kutu:
          </span>

          <button
            onClick={() => setRoiPreset('bottom')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              roiPreset === 'bottom'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 border border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            Alt Altyazı
          </button>

          <button
            onClick={() => setRoiPreset('middle')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              roiPreset === 'middle'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 border border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            Orta Diyalog
          </button>

          <button
            onClick={() => setRoiPreset('wide')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              roiPreset === 'wide'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 border border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            Geniş Menü
          </button>
        </div>

        {/* Action Buttons: Snap Translate & Live Auto Toggle */}
        <div className="flex items-center justify-between gap-3">
          {/* Freeze Frame Button */}
          <button
            onClick={toggleFreeze}
            className={`p-3 rounded-2xl border text-xs transition cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center ${
              isFrozen
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
            }`}
            title={isFrozen ? 'Yayını Devam Ettir' : 'Kareyi Dondur ve Oku'}
          >
            {isFrozen ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>

          {/* Big GameCaption SNAP & TRANSLATE Button */}
          <button
            onClick={() => {
              handleTouchUnlock();
              handleTranslateCurrentFrame(false);
            }}
            disabled={isTranslating}
            className={`flex-1 py-3.5 px-4 rounded-2xl font-black text-sm sm:text-base tracking-wide flex items-center justify-center gap-2 shadow-xl transition-all min-h-[48px] ${
              isTranslating
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-500/30 active:scale-95 cursor-pointer'
            }`}
          >
            <Zap className="w-5 h-5 fill-current" />
            <span>{isTranslating ? 'ÇEVRİLİYOR...' : 'ŞİMDİ ÇEVİR & DUBLAJ'}</span>
          </button>

          {/* Live Auto-Scan Toggle */}
          <button
            onClick={() => {
              handleTouchUnlock();
              setIsLiveAuto(!isLiveAuto);
            }}
            className={`px-3.5 py-3 rounded-2xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer min-h-[48px] ${
              isLiveAuto
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-md shadow-rose-500/10'
                : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
            }`}
            title="Canlı Otomatik Tarama"
          >
            {isLiveAuto ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span className="hidden sm:inline">{isLiveAuto ? 'Durdur' : 'Canlı Tara'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
