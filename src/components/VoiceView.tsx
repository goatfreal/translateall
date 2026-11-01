import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Globe,
  ArrowLeft,
  Zap,
} from 'lucide-react';
import type { AppSettings, TranslationResult } from '../types';
import { voiceManager } from '../services/voiceService';
import { translateText } from '../services/nvidiaApi';

interface VoiceViewProps {
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

export const VoiceView: React.FC<VoiceViewProps> = ({
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
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [inputLang, setInputLang] = useState('en-US');
  const [audioLevel, setAudioLevel] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const handleTouchUnlock = () => {
    voiceManager.unlockAudio();
  };

  // Audio level visualizer for mic input
  const setupAudioVisualizer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 64;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVisualizer = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 255) * 120)));
        animationFrameRef.current = requestAnimationFrame(updateVisualizer);
      };
      updateVisualizer();
    } catch {
      // Audio level visualizer optional
    }
  };

  const cleanupVisualizer = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
    }
  };

  // Toggle voice listening
  const toggleListening = () => {
    handleTouchUnlock();
    if (isListening) {
      voiceManager.stopListening();
      setIsListening(false);
      cleanupVisualizer();
    } else {
      if (!settings.nvidiaApiKey) {
        onError('NVIDIA API Anahtarınızı girmeden sesli çeviri başlatılamaz.');
        return;
      }

      const started = voiceManager.startListening(
        {
          onResult: async (detectedSpeech, isFinal) => {
            setInterimText(detectedSpeech);
            if (isFinal && detectedSpeech.trim().length > 1) {
              await handleTranslateSpeech(detectedSpeech);
            }
          },
          onError: (err) => {
            onError(err);
          },
          onStateChange: (state) => {
            setIsListening(state);
          },
        },
        inputLang
      );

      if (started) {
        setupAudioVisualizer();
      }
    }
  };

  // Process speech translation through NVIDIA NIM
  const handleTranslateSpeech = async (speech: string) => {
    try {
      setIsTranslating(true);
      const result = await translateText(
        speech,
        settings.targetLanguage === 'tr' ? 'Turkish' : settings.targetLanguage,
        settings.nvidiaApiKey,
        settings.textModel
      );

      onNewTranslation(result);

      if (settings.enableTts && result.translatedText) {
        onSpeak(result.translatedText);
      }
    } catch (e: any) {
      onError(e?.message || 'Ses çevirisi sırasında hata oluştu.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleTouchUnlock();
    await handleTranslateSpeech(manualInput.trim());
    setManualInput('');
  };

  useEffect(() => {
    return () => {
      voiceManager.stopListening();
      cleanupVisualizer();
    };
  }, []);

  return (
    <div
      onClick={handleTouchUnlock}
      className="w-full max-w-4xl mx-auto flex flex-col items-center justify-between p-4 sm:p-6 bg-slate-950/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl relative overflow-hidden select-none"
    >
      {/* Background glow */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Bar Navigation */}
      <div className="w-full flex items-center justify-between gap-3 mb-6 z-20 pb-3 border-b border-white/10">
        <button
          onClick={onBackToMenu}
          className="px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-cyan-400" />
          <span>Menü</span>
        </button>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-bold uppercase tracking-wider">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>CANLI SES ÇEVİRİSİ</span>
        </div>

        <button
          onClick={() => {
            handleTouchUnlock();
            onToggleTts();
          }}
          className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
            settings.enableTts
              ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300'
              : 'bg-slate-900/80 border-white/10 text-slate-400 hover:text-white'
          }`}
        >
          {settings.enableTts ? (
            <>
              <Volume2 className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span className="hidden sm:inline">Dublaj: AÇIK</span>
            </>
          ) : (
            <>
              <VolumeX className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">Dublaj: KAPALI</span>
            </>
          )}
        </button>
      </div>

      {/* Mic Animation & Visualizer Sphere */}
      <div className="relative my-4 flex flex-col items-center justify-center z-10">
        {isListening && (
          <>
            <div
              className="absolute rounded-full border border-cyan-500/30 transition-all duration-300 pointer-events-none"
              style={{
                width: `${140 + audioLevel * 1.5}px`,
                height: `${140 + audioLevel * 1.5}px`,
                opacity: Math.max(0.2, audioLevel / 100),
              }}
            ></div>
            <div
              className="absolute rounded-full border border-cyan-400/20 transition-all duration-200 pointer-events-none animate-ping"
              style={{
                width: '180px',
                height: '180px',
              }}
            ></div>
          </>
        )}

        <button
          onClick={toggleListening}
          className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl relative z-10 cursor-pointer ${
            isListening
              ? 'bg-gradient-to-tr from-cyan-500 to-emerald-400 text-slate-950 shadow-cyan-500/40 scale-105'
              : 'bg-slate-900 border-2 border-slate-700 text-slate-400 hover:text-white hover:border-cyan-500 hover:scale-105 shadow-black/80'
          }`}
        >
          {isListening ? (
            <>
              <Mic className="w-10 h-10 sm:w-12 sm:h-12 animate-pulse" />
              <span className="text-[11px] font-black tracking-wider uppercase mt-1">
                Dinleniyor...
              </span>
            </>
          ) : (
            <>
              <MicOff className="w-10 h-10 sm:w-12 sm:h-12" />
              <span className="text-[11px] font-bold tracking-wider uppercase mt-1">
                Dinlemeyi Başlat
              </span>
            </>
          )}
        </button>

        {isListening && (
          <div className="flex items-center gap-1.5 mt-4 h-8">
            {[...Array(12)].map((_, i) => {
              const height = Math.max(4, (audioLevel / 100) * 32 * (1 - Math.abs(i - 6) * 0.12));
              return (
                <div
                  key={i}
                  className="w-1.5 bg-gradient-to-t from-cyan-500 to-emerald-300 rounded-full transition-all duration-75"
                  style={{ height: `${height}px` }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Input Language Select */}
      <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 text-xs my-2 z-10">
        <Globe className="w-4 h-4 text-slate-400" />
        <span className="text-slate-400">Giriş Dili:</span>
        <select
          value={inputLang}
          onChange={(e) => setInputLang(e.target.value)}
          disabled={isListening}
          className="bg-transparent text-white font-semibold outline-none cursor-pointer"
        >
          <option value="en-US" className="bg-slate-900">İngilizce (English)</option>
          <option value="ja-JP" className="bg-slate-900">Japonca (日本語)</option>
          <option value="de-DE" className="bg-slate-900">Almanca (Deutsch)</option>
          <option value="fr-FR" className="bg-slate-900">Fransızca (Français)</option>
          <option value="es-ES" className="bg-slate-900">İspanyolca (Español)</option>
          <option value="ko-KR" className="bg-slate-900">Korece (한국어)</option>
          <option value="ru-RU" className="bg-slate-900">Rusça (Русский)</option>
        </select>
      </div>

      {/* Speech transcription buffer */}
      {interimText && (
        <div className="w-full max-w-lg mx-auto bg-slate-900/70 border border-cyan-500/30 rounded-xl p-3 my-2 text-center text-xs text-slate-300 italic animate-pulse z-10">
          &quot;{interimText}&quot;
        </div>
      )}

      {/* Live Result Display */}
      {currentResult && currentResult.translatedText && (
        <div className="w-full max-w-2xl mx-auto my-3 z-10 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-slate-900/90 border-2 border-cyan-500/40 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between text-xs text-cyan-400 font-bold mb-1 pb-1 border-b border-white/10">
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-4 h-4" /> Türkçe Çeviri:
              </span>
              <button
                onClick={() => onSpeak(currentResult.translatedText)}
                className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold text-[10px]"
              >
                🔊 Tekrar Oku
              </button>
            </div>
            <div className="text-white text-lg sm:text-xl font-black">
              {currentResult.translatedText}
            </div>
            {currentResult.originalText && (
              <div className="text-slate-400 text-xs mt-1 italic">
                {currentResult.originalText}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Input Fallback */}
      <form onSubmit={handleManualSubmit} className="w-full max-w-lg mt-3 z-10 flex gap-2">
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="Veya yazarak çevirip seslendirin..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500 transition"
        />
        <button
          type="submit"
          disabled={isTranslating || !manualInput.trim()}
          className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5 fill-current" /> Çevir & Oku
        </button>
      </form>
    </div>
  );
};
