import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RefreshCw,
  Crop,
  Zap,
  Volume2,
  VolumeX,
  AlertCircle,
  ArrowLeft,
  Radio,
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
  const streamRef = useRef<MediaStream | null>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isLiveAuto, setIsLiveAuto] = useState<boolean>(true); // Default to live auto-scan
  const [isFrozen, setIsFrozen] = useState<boolean>(false);
  const [showRoi, setShowRoi] = useState<boolean>(settings.roiEnabled);
  const [hasCameraError, setHasCameraError] = useState<string | null>(null);
  const [isSpeakingNow, setIsSpeakingNow] = useState<boolean>(false);
  const lastFrameHashRef = useRef<string>('');

  // Audio unlock helper for iOS WebKit
  const handleTouchUnlock = () => {
    voiceManager.unlockAudio();
  };

  // List available video input devices
  const updateDeviceList = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = deviceList.filter((d) => d.kind === 'videoinput');
      setDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        const backOrUsb =
          videoInputs.find((d) =>
            /back|rear|arka|usb|capture|cam link|hdmi/i.test(d.label)
          ) || videoInputs[0];
        setSelectedDeviceId(backOrUsb.deviceId);
      }
    } catch (e: any) {
      console.warn('Cihaz listesi alınamadı:', e);
    }
  }, [selectedDeviceId]);

  // Start video stream from camera
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
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = newStream;

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play();
      }

      await updateDeviceList();
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
  }, [facingMode, selectedDeviceId, screenStream, onError, updateDeviceList]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [startCamera]);

  // Quick 8x8 luminance hash for frame diff checking
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

  // Capture current video frame as ultra-fast compressed JPEG
  const captureFrame = useCallback((checkDiff: boolean = false): { base64: string; changed: boolean } | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    let targetW = 640;
    let targetH = 360;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    if (showRoi) {
      // Focus strictly on the subtitle area (massive speed boost, ~25KB payload)
      const rx = (settings.roiBox.x / 100) * vw;
      const ry = (settings.roiBox.y / 100) * vh;
      const rw = (settings.roiBox.width / 100) * vw;
      const rh = (settings.roiBox.height / 100) * vh;

      targetW = Math.min(640, Math.round(rw));
      targetH = Math.round((targetW * rh) / rw);

      canvas.width = targetW;
      canvas.height = targetH;
      ctx.drawImage(video, rx, ry, rw, rh, 0, 0, targetW, targetH);
    } else {
      targetW = 640;
      targetH = Math.round((640 * vh) / vw);
      canvas.width = targetW;
      canvas.height = targetH;
      ctx.drawImage(video, 0, 0, targetW, targetH);
    }

    let changed = true;
    if (checkDiff) {
      const currentHash = computeQuickHash(ctx, targetW, targetH);
      if (currentHash && currentHash === lastFrameHashRef.current) {
        changed = false;
      } else {
        lastFrameHashRef.current = currentHash;
      }
    }

    const base64 = canvas.toDataURL('image/jpeg', 0.68);
    return { base64, changed };
  }, [showRoi, settings.roiBox]);

  // Perform translation & automatic TTS audio dubbing
  const handleTranslateCurrentFrame = useCallback(async (isAutoScan: boolean = false) => {
    if (isTranslating) return;

    if (!settings.nvidiaApiKey || settings.nvidiaApiKey.trim() === '') {
      onError('Lütfen Ayarlar sekmesinden NVIDIA API Anahtarınızı girin.');
      return;
    }

    const captureResult = captureFrame(isAutoScan);
    if (!captureResult) return;

    // Skip if subtitle unchanged in auto-scan mode
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

        // SESLİ DUBLAJ: Ekrandaki çeviriyi anında seslendir
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

  // Toggle Facing Mode
  const toggleFacingMode = () => {
    handleTouchUnlock();
    setSelectedDeviceId('');
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Toggle freeze frame
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
      onClick={handleTouchUnlock}
      className="relative w-full h-full flex flex-col items-center justify-between bg-black overflow-hidden rounded-3xl border border-slate-800 shadow-2xl select-none"
    >
      <canvas ref={canvasRef} className="hidden" />

      {/* TOP HEADER HUD */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3 sm:p-4 bg-gradient-to-b from-slate-950/95 via-slate-950/70 to-transparent flex items-center justify-between gap-2 backdrop-blur-sm">
        {/* Back to Menu Button */}
        <button
          onClick={onBackToMenu}
          className="px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
          <span>Menü</span>
        </button>

        {/* Center Live Status */}
        <div className="flex items-center gap-2">
          {isTranslating ? (
            <div className="px-3 py-1.5 bg-emerald-500 text-slate-950 text-xs font-black rounded-full flex items-center gap-1.5 shadow-lg shadow-emerald-500/30 animate-pulse">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>ÇEVRİLİYOR...</span>
            </div>
          ) : (
            <div className="px-3 py-1.5 bg-black/70 border border-white/10 rounded-full text-xs font-semibold text-slate-300 flex items-center gap-1.5 backdrop-blur-md">
              <span className={`w-2 h-2 rounded-full ${isLiveAuto ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{isLiveAuto ? 'CANLI TARAMA' : 'DURAKLATILDI'}</span>
            </div>
          )}
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center gap-2">
          {/* TTS Dubbing Toggle Button */}
          <button
            onClick={() => {
              handleTouchUnlock();
              onToggleTts();
            }}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
              settings.enableTts
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-emerald-500/20'
                : 'bg-slate-900/80 border-white/10 text-slate-400 hover:text-white'
            }`}
            title="Sesli Dublajı Aç/Kapat"
          >
            {settings.enableTts ? (
              <>
                <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="hidden sm:inline">Dublaj: AÇIK</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">Dublaj: KAPALI</span>
              </>
            )}
          </button>

          {/* Clear PC Screen Share Button */}
          {screenStream && (
            <button
              onClick={onClearScreenStream}
              className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 font-bold text-xs"
            >
              Ekranı Kapat
            </button>
          )}

          {/* Device Selector */}
          {devices.length > 1 && !screenStream && (
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="bg-slate-900 border border-white/10 text-slate-300 text-xs rounded-xl px-2 py-1 outline-none hidden md:inline-block"
            >
              {devices.map((d, idx) => (
                <option key={d.deviceId || idx} value={d.deviceId}>
                  {d.label || `Kamera ${idx + 1}`}
                </option>
              ))}
            </select>
          )}

          {/* Camera Flip */}
          {!screenStream && (
            <button
              onClick={toggleFacingMode}
              className="p-2 rounded-xl bg-slate-900/80 border border-white/15 text-slate-300 hover:text-white active:scale-95 transition cursor-pointer"
              title="Kamera Değiştir (Ön/Arka)"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* CAMERA VIDEO VIEWPORT */}
      <div className="relative w-full flex-1 flex items-center justify-center min-h-[300px] overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`w-full h-full object-contain ${
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

        {/* SUBTITLE FOCUS BOX (ROI) */}
        {showRoi && (
          <div
            className="absolute border-2 border-dashed border-emerald-400/70 bg-emerald-400/5 pointer-events-none rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all"
            style={{
              left: `${settings.roiBox.x}%`,
              top: `${settings.roiBox.y}%`,
              width: `${settings.roiBox.width}%`,
              height: `${settings.roiBox.height}%`,
            }}
          >
            <div className="absolute -top-5 left-2 bg-emerald-500 text-slate-950 px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-wider flex items-center gap-1 shadow">
              <Crop className="w-2.5 h-2.5" /> Altyazıyı Bu Alana Denk Getirin
            </div>
          </div>
        )}
      </div>

      {/* INTEGRATED SUBTITLE DISPLAY HUD */}
      {currentResult && currentResult.translatedText && (
        <div className="w-full px-3 py-2 z-20 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="max-w-3xl mx-auto rounded-2xl bg-slate-950/95 border-2 border-emerald-500/50 shadow-2xl p-3.5 backdrop-blur-md">
            <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-white/10 text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                {isSpeakingNow ? (
                  <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>{isSpeakingNow ? 'Seslendiriliyor...' : 'Türkçe Altyazı'}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[10px]">
                  ⚡ {currentResult.latencyMs}ms
                </span>
                <button
                  onClick={() => {
                    handleTouchUnlock();
                    onSpeak(currentResult.translatedText);
                  }}
                  className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[10px] flex items-center gap-1"
                >
                  <Volume2 className="w-3 h-3" /> Tekrar Dinle
                </button>
              </div>
            </div>

            {/* Main Translated Subtitle Text */}
            <div className="text-white font-extrabold text-base sm:text-xl leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              {currentResult.translatedText}
            </div>

            {/* Original Text if available */}
            {currentResult.originalText && (
              <div className="text-slate-400 text-xs mt-1 italic font-medium truncate">
                {currentResult.originalText}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STREAMLINED BOTTOM CONTROLS */}
      <div className="w-full bg-slate-950/95 p-3 sm:p-4 z-20 flex items-center justify-between gap-3 border-t border-slate-900 backdrop-blur-md">
        {/* Left: ROI Toggle */}
        <button
          onClick={() => {
            handleTouchUnlock();
            setShowRoi(!showRoi);
          }}
          className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
            showRoi
              ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
              : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
          }`}
          title="Altyazı Çerçevesi"
        >
          <Crop className="w-4 h-4" />
          <span className="hidden sm:inline">Odak Çerçevesi</span>
        </button>

        {/* Center: BIG SNAP & TRANSLATE BUTTON */}
        <button
          onClick={() => {
            handleTouchUnlock();
            handleTranslateCurrentFrame(false);
          }}
          disabled={isTranslating}
          className={`flex-1 max-w-xs py-3 px-4 rounded-2xl font-black text-sm tracking-wide flex items-center justify-center gap-2 shadow-xl transition-all ${
            isTranslating
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-500/25 active:scale-95 cursor-pointer'
          }`}
        >
          <Zap className="w-4 h-4 fill-current" />
          <span>{isTranslating ? 'ÇEVRİLİYOR...' : 'ŞİMDİ ÇEVİR & DUBLAJ'}</span>
        </button>

        {/* Right: Live Auto-Scan Toggle & Freeze */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              handleTouchUnlock();
              setIsLiveAuto(!isLiveAuto);
            }}
            className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isLiveAuto
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-md shadow-rose-500/10'
                : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
            }`}
            title="Canlı Otomatik Tarama"
          >
            {isLiveAuto ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span className="hidden sm:inline">
              {isLiveAuto ? 'Oto-Durdur' : 'Oto-Başlat'}
            </span>
          </button>

          <button
            onClick={toggleFreeze}
            className={`p-2.5 rounded-xl border text-xs transition cursor-pointer ${
              isFrozen
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
            }`}
            title={isFrozen ? 'Yayını Sürdür' : 'Ekranı Dondur & Oku'}
          >
            {isFrozen ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
