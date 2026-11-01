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
  Flame
} from 'lucide-react';
import type { AppSettings, TranslationResult } from '../types';
import { translateImageFrame } from '../services/nvidiaApi';

interface CameraViewProps {
  settings: AppSettings;
  onNewTranslation: (result: TranslationResult) => void;
  isTranslating: boolean;
  setIsTranslating: (val: boolean) => void;
  onError: (err: string) => void;
  screenStream: MediaStream | null;
  onClearScreenStream: () => void;
  onSpeak: (text: string) => void;
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
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isLiveAuto, setIsLiveAuto] = useState<boolean>(true); // Default to live auto-scan for games
  const [isFrozen, setIsFrozen] = useState<boolean>(false);
  const [showRoi, setShowRoi] = useState<boolean>(settings.roiEnabled);
  const [hasCameraError, setHasCameraError] = useState<string | null>(null);
  const lastFrameHashRef = useRef<string>('');

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
        errMsg = 'Kamera erişim izni reddedildi. Lütfen tarayıcı/cihaz izinlerinden kameraya onay verin.';
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

  // Quick 8x8 luminance hash for frame diff checking (avoids redundant API calls if subtitle hasn't changed)
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

    let targetW = 640; // High speed target width for gaming
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

    // Check frame diff to avoid redundant requests if game dialogue is unchanged
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

  // Perform translation
  const handleTranslateCurrentFrame = useCallback(async (isAutoScan: boolean = false) => {
    if (isTranslating) return;

    if (!settings.nvidiaApiKey || settings.nvidiaApiKey.trim() === '') {
      onError('Lütfen Ayarlar sekmesinden NVIDIA API Anahtarınızı girin.');
      return;
    }

    const captureResult = captureFrame(isAutoScan);
    if (!captureResult) return;

    // If auto scanning and frame hasn't changed, skip to save quota and lag
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

      if (result) {
        onNewTranslation(result);
        if (settings.enableTts && result.translatedText) {
          onSpeak(result.translatedText);
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

  // Freeze Frame Toggle
  const toggleFreeze = () => {
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

  const toggleFacingMode = () => {
    setSelectedDeviceId('');
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden rounded-3xl border border-slate-800 shadow-2xl">
      <canvas ref={canvasRef} className="hidden" />

      {/* Video Viewport */}
      <div className="relative w-full h-full flex items-center justify-center min-h-[320px] max-h-[70vh]">
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`w-full h-full object-contain ${
            facingMode === 'user' && !screenStream ? 'scale-x-[-1]' : ''
          }`}
        />

        {hasCameraError && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-20">
            <AlertCircle className="w-12 h-12 text-rose-500 mb-3 animate-bounce" />
            <h3 className="text-lg font-bold text-white mb-2">Kamera Açılamadı</h3>
            <p className="text-sm text-slate-400 max-w-md mb-4">{hasCameraError}</p>
            <button
              onClick={startCamera}
              className="px-4 py-2 bg-lime-500 text-slate-950 font-bold rounded-xl flex items-center gap-2 hover:bg-lime-400"
            >
              <RefreshCw className="w-4 h-4" /> Yeniden Dene
            </button>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1 bg-black/70 backdrop-blur-md border border-lime-500/30 rounded-full text-lime-400 text-xs font-black flex items-center gap-1.5 shadow-lg">
            <Flame className="w-3.5 h-3.5 text-lime-400 animate-pulse" />
            <span>TURBO OYUN MODU</span>
          </div>

          {screenStream ? (
            <div className="px-3 py-1 bg-sky-500/80 backdrop-blur-md rounded-full text-white text-xs font-bold flex items-center gap-1.5 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
              <span>PC Ekranı</span>
              <button
                onClick={onClearScreenStream}
                className="ml-1 text-[10px] bg-sky-900/60 hover:bg-rose-500 px-1.5 py-0.5 rounded transition-colors"
              >
                Kapat
              </button>
            </div>
          ) : (
            <div className="px-3 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-slate-300 text-xs font-semibold flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isLiveAuto ? 'bg-lime-400 animate-ping' : isFrozen ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              ></span>
              <span>{isFrozen ? 'DONDURULDU' : isLiveAuto ? 'CANLI OTO-TARAMA' : 'BEKLEMEDE'}</span>
            </div>
          )}

          {isTranslating && (
            <div className="px-3 py-1 bg-lime-500 text-slate-950 text-xs font-black rounded-full flex items-center gap-1.5 shadow-lg shadow-lime-500/30">
              <Zap className="w-3.5 h-3.5 fill-current animate-bounce" />
              <span>NVIDIA NIM</span>
            </div>
          )}
        </div>

        {/* Region of Interest (ROI) Box Overlay */}
        {showRoi && (
          <div
            className="absolute border-2 border-dashed border-lime-400/80 bg-lime-400/5 pointer-events-none rounded-lg shadow-[0_0_15px_rgba(118,185,0,0.3)] transition-all"
            style={{
              left: `${settings.roiBox.x}%`,
              top: `${settings.roiBox.y}%`,
              width: `${settings.roiBox.width}%`,
              height: `${settings.roiBox.height}%`,
            }}
          >
            <div className="absolute -top-6 left-0 bg-lime-500 text-slate-950 px-2 py-0.5 text-[10px] font-black rounded uppercase tracking-wider flex items-center gap-1">
              <Crop className="w-3 h-3" /> TV Altyazı Odak Alanı
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Control Bar */}
      <div className="w-full bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent p-4 sm:p-5 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-slate-900">
        <div className="flex items-center gap-2 flex-wrap">
          {devices.length > 1 && !screenStream && (
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 outline-none focus:border-lime-500"
            >
              {devices.map((d, idx) => (
                <option key={d.deviceId || idx} value={d.deviceId}>
                  {d.label || `Kamera ${idx + 1}`}
                </option>
              ))}
            </select>
          )}

          {!screenStream && (
            <button
              onClick={toggleFacingMode}
              title="Ön / Arka Kamera Değiştir"
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setShowRoi(!showRoi)}
            title="Altyazı Bölgesi Odakla (ROI)"
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showRoi
                ? 'bg-lime-500/20 border-lime-500/50 text-lime-400'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Crop className="w-4 h-4" />
            <span className="hidden sm:inline">Altyazı Alanı</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleTranslateCurrentFrame(false)}
            disabled={isTranslating}
            className={`px-6 py-3 rounded-2xl font-black text-sm tracking-wide flex items-center gap-2 shadow-lg transition-all ${
              isTranslating
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-lime-500 hover:bg-lime-400 text-slate-950 shadow-lime-500/25 active:scale-95'
            }`}
          >
            <Zap className="w-5 h-5 fill-current" />
            <span>{isTranslating ? 'ÇEVRİLİYOR...' : 'ŞİMDİ ÇEVİR (SNAP)'}</span>
          </button>

          <button
            onClick={() => setIsLiveAuto(!isLiveAuto)}
            className={`px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 border transition-all ${
              isLiveAuto
                ? 'bg-rose-500/20 border-rose-500 text-rose-400 shadow-rose-500/20 shadow-lg'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            {isLiveAuto ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span className="hidden md:inline">
              {isLiveAuto ? 'Oto-Taramayı Durdur' : `Oto-Tarama (${settings.autoIntervalSeconds}s)`}
            </span>
          </button>

          <button
            onClick={toggleFreeze}
            title={isFrozen ? 'Yayını Devam Ettir' : 'Kareyi Dondur ve Oku'}
            className={`p-3 rounded-2xl border transition-all ${
              isFrozen
                ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {isFrozen ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              settings.enableTts = !settings.enableTts;
            }}
            title={settings.enableTts ? 'Sesli Dublaj Açık' : 'Sesli Dublaj Kapalı'}
            className={`p-2.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${
              settings.enableTts
                ? 'bg-lime-500/20 border-lime-500 text-lime-400'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {settings.enableTts ? (
              <>
                <Volume2 className="w-4 h-4" />
                <span className="hidden lg:inline">Sesli Dublaj</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4" />
                <span className="hidden lg:inline">Sessiz</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
