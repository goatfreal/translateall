import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Globe,
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
}

export const VoiceView: React.FC<VoiceViewProps> = ({
  settings,
  onNewTranslation,
  isTranslating,
  setIsTranslating,
  onError,
  onSpeak,
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

  // Manual test submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleTranslateSpeech(manualInput);
    setManualInput('');
  };

  useEffect(() => {
    return () => {
      voiceManager.stopListening();
      cleanupVisualizer();
    };
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-lime-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header Info */}
      <div className="text-center mb-6 z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/20 text-xs font-bold uppercase tracking-wider mb-2">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>CANLI SES VE OYUN KONUŞMASI ÇEVİRİSİ</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white">
          Sesli Dublaj & Canlı Altyazı
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-lg mx-auto">
          TV veya oyun sesini mikrofondan dinler, NVIDIA NIM ile anında Türkçe&apos;ye çevirir ve
          isteğe göre seslendirir.
        </p>
      </div>

      {/* Mic Animation & Visualizer Sphere */}
      <div className="relative my-6 flex flex-col items-center justify-center z-10">
        {isListening && (
          <>
            <div
              className="absolute rounded-full border border-lime-500/30 transition-all duration-300 pointer-events-none"
              style={{
                width: `${140 + audioLevel * 1.5}px`,
                height: `${140 + audioLevel * 1.5}px`,
                opacity: Math.max(0.2, audioLevel / 100),
              }}
            ></div>
            <div
              className="absolute rounded-full border border-lime-400/20 transition-all duration-200 pointer-events-none animate-ping"
              style={{
                width: '180px',
                height: '180px',
              }}
            ></div>
          </>
        )}

        <button
          onClick={toggleListening}
          className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl relative z-10 ${
            isListening
              ? 'bg-gradient-to-tr from-lime-500 to-emerald-400 text-slate-950 shadow-lime-500/40 scale-105'
              : 'bg-slate-900 border-2 border-slate-700 text-slate-400 hover:text-white hover:border-lime-500 hover:scale-105 shadow-black/80'
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
                Mikrofonu Başlat
              </span>
            </>
          )}
        </button>

        {isListening && (
          <div className="flex items-center gap-1.5 mt-6 h-8">
            {[...Array(12)].map((_, i) => {
              const height = Math.max(4, (audioLevel / 100) * 32 * (1 - Math.abs(i - 6) * 0.12));
              return (
                <div
                  key={i}
                  className="w-1.5 bg-gradient-to-t from-lime-500 to-emerald-300 rounded-full transition-all duration-75"
                  style={{ height: `${height}px` }}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 my-4 z-10 w-full max-w-md">
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
          <Globe className="w-4 h-4 text-slate-400" />
          <span className="text-slate-400">Giriş Dili:</span>
          <select
            value={inputLang}
            onChange={(e) => setInputLang(e.target.value)}
            disabled={isListening}
            className="bg-transparent text-white font-semibold outline-none cursor-pointer"
          >
            <option value="en-US" className="bg-slate-900">İngilizce (English)</option>
            <option value="ja-JP" className="bg-slate-900">Japonca (Japanese)</option>
            <option value="de-DE" className="bg-slate-900">Almanca (Deutsch)</option>
            <option value="fr-FR" className="bg-slate-900">Fransızca (Français)</option>
            <option value="ru-RU" className="bg-slate-900">Rusça (Russian)</option>
            <option value="tr-TR" className="bg-slate-900">Türkçe (Turkish)</option>
          </select>
        </div>

        <button
          onClick={() => {
            settings.enableTts = !settings.enableTts;
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
            settings.enableTts
              ? 'bg-lime-500/20 border-lime-500 text-lime-400'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          {settings.enableTts ? (
            <>
              <Volume2 className="w-4 h-4" />
              <span>Sesli Dublaj Aktif</span>
            </>
          ) : (
            <>
              <VolumeX className="w-4 h-4" />
              <span>Sadece Altyazı</span>
            </>
          )}
        </button>
      </div>

      {interimText && (
        <div className="w-full max-w-xl bg-slate-900/90 border border-lime-500/30 rounded-2xl p-4 my-2 text-center z-10 shadow-lg">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
            Algılanan Ses:
          </span>
          <p className="text-sm font-semibold text-white italic">&ldquo;{interimText}&rdquo;</p>
        </div>
      )}

      <form onSubmit={handleManualSubmit} className="w-full max-w-lg mt-4 z-10 flex gap-2">
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="Veya çevrilecek bir oyun diyaloğu yazıp Enter'a basın..."
          className="flex-1 bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-lime-500"
        />
        <button
          type="submit"
          disabled={!manualInput.trim() || isTranslating}
          className="px-4 py-2.5 bg-lime-500 hover:bg-lime-400 disabled:bg-slate-800 text-slate-950 font-bold rounded-xl text-sm transition-all"
        >
          Çevir
        </button>
      </form>
    </div>
  );
};
