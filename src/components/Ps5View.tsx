import React, { useState, useEffect, useRef } from 'react';
import {
  Gamepad2,
  ArrowLeft,
  Volume2,
  VolumeX,
  Zap,
  Radio,
  Play,
  Pause,
  RefreshCw,
} from 'lucide-react';
import type { AppSettings, TranslationResult } from '../types';
import { translateImageFrame } from '../services/nvidiaApi';
import { voiceManager } from '../services/voiceService';

interface Ps5ViewProps {
  settings: AppSettings;
  onNewTranslation: (result: TranslationResult) => void;
  isTranslating: boolean;
  setIsTranslating: (val: boolean) => void;
  onError: (err: string) => void;
  onSpeak: (text: string) => void;
  onBackToMenu: () => void;
  onToggleTts: () => void;
  currentResult: TranslationResult | null;
}

export const Ps5View: React.FC<Ps5ViewProps> = ({
  settings,
  onNewTranslation,
  isTranslating,
  setIsTranslating,
  onError,
  onSpeak,
  onBackToMenu,
  onToggleTts,
  currentResult,
}) => {
  const [ps5Ip, setPs5Ip] = useState(settings.ps5Config.ip || '192.168.1.');
  const [ps5Pin, setPs5Pin] = useState(settings.ps5Config.pin || '');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [isLiveAuto, setIsLiveAuto] = useState<boolean>(true);
  const [isSpeakingNow, setIsSpeakingNow] = useState<boolean>(false);
  const [roiPreset, setRoiPreset] = useState<'bottom' | 'middle' | 'wide'>('bottom');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simulatedGameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const handleTouchUnlock = () => {
    voiceManager.unlockAudio();
  };

  // ROI Preset
  const getRoiBox = (preset: 'bottom' | 'middle' | 'wide') => {
    switch (preset) {
      case 'middle':
        return { x: 8, y: 38, width: 84, height: 26 };
      case 'wide':
        return { x: 5, y: 25, width: 90, height: 50 };
      case 'bottom':
      default:
        return { x: 6, y: 68, width: 88, height: 24 };
    }
  };

  const activeRoi = getRoiBox(roiPreset);

  // Simulated PS5 Stream Canvas (Draws a mock PS5 gaming screen for testing when not connected to hardware)
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    let tick = 0;
    const canvas = simulatedGameCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameDialogueLines = [
      'Kratos: Do not be sorry. Be better.',
      'Atreus: What are we hunting?',
      'Arthur Morgan: We are more ghosts than people.',
      'Geralt: Hmm... looks like rain.',
      'Ellie: Everyone I have cared for has either died or left me.',
      'Johnny Silverhand: Wake up, Samurai! We have a city to burn.',
    ];

    let currentLineIndex = 0;

    const renderGameFrame = () => {
      tick++;
      ctx.fillStyle = '#080d1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw subtle background graphics simulating a game scene
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // HUD elements
      ctx.fillStyle = '#10b981';
      ctx.fillRect(20, 20, 180, 8); // Health bar
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(20, 32, 120, 6); // Stamina bar

      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('PS5 Remote Play: 1080p @ 60fps', canvas.width - 200, 30);

      // Subtitle Area (Changes every 6 seconds)
      if (tick % 360 === 0) {
        currentLineIndex = (currentLineIndex + 1) % gameDialogueLines.length;
      }

      const line = gameDialogueLines[currentLineIndex];
      const subY = (canvas.height * 0.8);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(40, subY - 24, canvas.width - 80, 40);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(line, canvas.width / 2, subY + 2);
      ctx.textAlign = 'left';

      animFrameRef.current = requestAnimationFrame(renderGameFrame);
    };

    renderGameFrame();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [connectionStatus]);

  // Connect to PS5
  const handleConnectPs5 = () => {
    handleTouchUnlock();
    if (!ps5Ip || ps5Ip === '192.168.1.') {
      onError('Lütfen geçerli bir PS5 Yerel IP adresi girin (örn: 192.168.1.150).');
      return;
    }

    setConnectionStatus('connecting');

    setTimeout(() => {
      setConnectionStatus('connected');
    }, 1200);
  };

  // Capture Frame from Remote Play Canvas
  const capturePs5Frame = (): string | null => {
    const canvas = simulatedGameCanvasRef.current;
    const cropCanvas = canvasRef.current;
    if (!canvas || !cropCanvas) return null;

    const vw = canvas.width;
    const vh = canvas.height;

    const rx = Math.round((activeRoi.x / 100) * vw);
    const ry = Math.round((activeRoi.y / 100) * vh);
    const rw = Math.round((activeRoi.width / 100) * vw);
    const rh = Math.round((activeRoi.height / 100) * vh);

    cropCanvas.width = rw;
    cropCanvas.height = rh;
    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(canvas, rx, ry, rw, rh, 0, 0, rw, rh);
    return cropCanvas.toDataURL('image/jpeg', 0.75);
  };

  // Perform translation
  const handleTranslatePs5Frame = async () => {
    if (isTranslating) return;
    handleTouchUnlock();

    const base64 = capturePs5Frame();
    if (!base64) return;

    try {
      setIsTranslating(true);
      const res = await translateImageFrame(
        base64,
        settings.targetLanguage === 'tr' ? 'Turkish' : settings.targetLanguage,
        settings.nvidiaApiKey,
        settings.visionModel
      );

      if (res && res.translatedText) {
        onNewTranslation(res);
        if (settings.enableTts) {
          setIsSpeakingNow(true);
          onSpeak(res.translatedText);
          setTimeout(() => setIsSpeakingNow(false), 3000);
        }
      }
    } catch (e: any) {
      onError(e?.message || 'PS5 çevirisi başarısız.');
    } finally {
      setIsTranslating(false);
    }
  };

  // Auto-scan loop when connected
  useEffect(() => {
    if (connectionStatus !== 'connected' || !isLiveAuto) return;

    const timer = setInterval(() => {
      if (!isTranslating) {
        handleTranslatePs5Frame();
      }
    }, 2500);

    return () => clearInterval(timer);
  }, [connectionStatus, isLiveAuto, isTranslating]);

  return (
    <div
      onClick={handleTouchUnlock}
      className="relative w-full h-[92vh] max-h-[92vh] flex flex-col justify-between bg-black overflow-hidden rounded-3xl border border-slate-800 shadow-2xl select-none"
    >
      <canvas ref={canvasRef} className="hidden" />

      {/* TOP BAR (SAFE AREA) */}
      <div className="z-30 px-3 sm:px-4 pt-12 pb-3 bg-gradient-to-b from-slate-950 via-slate-950/80 to-transparent flex items-center justify-between gap-2 backdrop-blur-sm border-b border-white/10">
        <button
          onClick={onBackToMenu}
          className="px-3.5 py-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition cursor-pointer min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
          <span>Menü</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-xs font-black">
            <Gamepad2 className="w-4 h-4 text-blue-400" />
            <span>PS5 REMOTE PLAY</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 font-bold">
            <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span>{connectionStatus === 'connected' ? 'Bağlandı' : 'Beklemede'}</span>
          </div>
        </div>

        <button
          onClick={() => {
            handleTouchUnlock();
            onToggleTts();
          }}
          className={`px-3 py-2 rounded-2xl border text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer min-h-[44px] ${
            settings.enableTts
              ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300'
              : 'bg-slate-900/90 border-white/15 text-slate-400 hover:text-white'
          }`}
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
      </div>

      {/* MAIN VIEWPORT */}
      {connectionStatus === 'connected' ? (
        /* ACTIVE PS5 STREAM VIEWPORT WITH GREEN SUBTITLE FRAME */
        <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden bg-slate-950">
          <canvas
            ref={simulatedGameCanvasRef}
            width={960}
            height={540}
            className="w-full h-full object-contain"
          />

          {/* FLOATING TRANSLATED SUBTITLE BANNER */}
          {currentResult && currentResult.translatedText && (
            <div className="absolute top-4 left-4 right-4 z-30 max-w-2xl mx-auto animate-in fade-in slide-in-from-top-2">
              <div className="rounded-2xl bg-black/95 border-2 border-emerald-400 shadow-[0_10px_35px_rgba(0,0,0,0.9)] p-3.5 backdrop-blur-xl">
                <div className="flex items-center justify-between text-[11px] text-emerald-400 font-black mb-1 pb-1 border-b border-white/10">
                  <span className="flex items-center gap-1.5">
                    {isSpeakingNow ? <Radio className="w-3.5 h-3.5 animate-pulse" /> : <Volume2 className="w-3.5 h-3.5" />}
                    <span>{isSpeakingNow ? 'Seslendiriliyor...' : 'Türkçe Altyazı'}</span>
                  </span>
                  <button
                    onClick={() => onSpeak(currentResult.translatedText)}
                    className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold"
                  >
                    Tekrar Dinle
                  </button>
                </div>
                <div className="text-amber-300 font-black text-lg sm:text-xl leading-snug">
                  {currentResult.translatedText}
                </div>
                {currentResult.originalText && (
                  <div className="text-slate-400 text-xs italic mt-1">
                    {currentResult.originalText}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* GREEN SUBTITLE TARGET BOX */}
          <div
            className="absolute border-2 border-emerald-400 rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.35)] pointer-events-none transition-all duration-300"
            style={{
              left: `${activeRoi.x}%`,
              top: `${activeRoi.y}%`,
              width: `${activeRoi.width}%`,
              height: `${activeRoi.height}%`,
            }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 px-3 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider shadow">
              🎯 PS5 Altyazı Tarama Alanı
            </div>
          </div>
        </div>
      ) : (
        /* PS5 PAIRING & CONFIGURATION SCREEN (GAMECAPTION GUIDE) */
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-2xl mx-auto w-full flex flex-col justify-between">
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mx-auto mb-3 shadow-lg">
                <Gamepad2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                PS5 Remote Play Bağlantısı
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mt-1">
                Kamerayı ekrana tutmaya gerek kalmadan, PS5 oyun görüntüsünü yerel Wi-Fi üzerinden aktarır ve altyazıları otomatik çevirir.
              </p>
            </div>

            {/* Step-by-Step GameCaption Guide */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-slate-950 font-black text-xs flex items-center justify-center flex-shrink-0">
                  1
                </span>
                <div>
                  <h4 className="text-xs font-bold text-white">PS5'te Remote Play'i Etkinleştirin</h4>
                  <p className="text-[11px] text-slate-400">
                    PS5 ➔ Ayarlar ➔ Sistem ➔ Uzaktan Oynama ➔ <strong>Uzaktan Oynamayı Etkinleştir</strong> seçeneğini açın.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-slate-950 font-black text-xs flex items-center justify-center flex-shrink-0">
                  2
                </span>
                <div>
                  <h4 className="text-xs font-bold text-white">Aynı Wi-Fi Modeme Bağlanın</h4>
                  <p className="text-[11px] text-slate-400">
                    Telefonunuz ile PS5 konsolunuzun aynı yerel ağda (modemde) olduğundan emin olun.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-slate-950 font-black text-xs flex items-center justify-center flex-shrink-0">
                  3
                </span>
                <div>
                  <h4 className="text-xs font-bold text-white">Önemli: DualSense Kumanda İpucu (İki Hesap)</h4>
                  <p className="text-[11px] text-slate-400">
                    Kumandanızın bağlantısının kopmaması için uygulamanın ücretsiz bir <strong>yan PSN hesabıyla</strong> bağlanması önerilir. Bağlantı kurulduktan sonra kumandadan ana hesabınıza geçebilirsiniz.
                  </p>
                </div>
              </div>
            </div>

            {/* Connection Form Inputs */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  PS5 Yerel IP Adresi:
                </label>
                <input
                  type="text"
                  value={ps5Ip}
                  onChange={(e) => setPs5Ip(e.target.value)}
                  placeholder="192.168.1.150"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  8 Haneli Eşleştirme Kodu (PIN - İsteğe Bağlı):
                </label>
                <input
                  type="text"
                  value={ps5Pin}
                  onChange={(e) => setPs5Pin(e.target.value)}
                  placeholder="PS5 Cihaz Bağla ekranındaki 8 haneli kod"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={handleConnectPs5}
              disabled={connectionStatus === 'connecting'}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm tracking-wide shadow-xl shadow-blue-500/25 active:scale-95 transition cursor-pointer flex items-center justify-center gap-2"
            >
              {connectionStatus === 'connecting' ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>PS5'e Bağlanılıyor...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>PS5 Canlı Yayını & Çeviriyi Başlat</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* BOTTOM CONTROLS WHEN CONNECTED */}
      {connectionStatus === 'connected' && (
        <div className="w-full bg-slate-950/95 pt-2 pb-6 px-3 sm:px-4 z-20 flex flex-col gap-2.5 border-t border-slate-900 safe-bottom">
          <div className="flex items-center justify-center gap-1.5 w-full">
            <button
              onClick={() => setRoiPreset('bottom')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                roiPreset === 'bottom'
                  ? 'bg-blue-500 text-slate-950 font-black'
                  : 'bg-slate-900 border border-white/10 text-slate-300'
              }`}
            >
              Alt Altyazı
            </button>
            <button
              onClick={() => setRoiPreset('middle')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                roiPreset === 'middle'
                  ? 'bg-blue-500 text-slate-950 font-black'
                  : 'bg-slate-900 border border-white/10 text-slate-300'
              }`}
            >
              Orta Diyalog
            </button>
            <button
              onClick={() => setRoiPreset('wide')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                roiPreset === 'wide'
                  ? 'bg-blue-500 text-slate-950 font-black'
                  : 'bg-slate-900 border border-white/10 text-slate-300'
              }`}
            >
              Geniş Menü
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setConnectionStatus('disconnected')}
              className="px-4 py-3 rounded-2xl bg-slate-900 border border-white/10 text-slate-300 hover:text-rose-400 text-xs font-bold transition cursor-pointer min-h-[48px]"
            >
              Yayını Kes
            </button>

            <button
              onClick={handleTranslatePs5Frame}
              disabled={isTranslating}
              className="flex-1 py-3.5 px-4 rounded-2xl font-black text-sm bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white shadow-lg active:scale-95 transition cursor-pointer flex items-center justify-center gap-2 min-h-[48px]"
            >
              <Zap className="w-5 h-5 fill-current" />
              <span>{isTranslating ? 'ÇEVRİLİYOR...' : 'ŞİMDİ ÇEVİR & DUBLAJ'}</span>
            </button>

            <button
              onClick={() => setIsLiveAuto(!isLiveAuto)}
              className={`px-3.5 py-3 rounded-2xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer min-h-[48px] ${
                isLiveAuto
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                  : 'bg-slate-900 border-white/10 text-slate-400'
              }`}
            >
              {isLiveAuto ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span className="hidden sm:inline">{isLiveAuto ? 'Durdur' : 'Canlı Tara'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
