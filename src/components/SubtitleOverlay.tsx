import React from 'react';
import type { TranslationResult, AppSettings } from '../types';
import { Volume2, Zap, Copy, Check, Subtitles, Layers } from 'lucide-react';

interface SubtitleOverlayProps {
  currentResult: TranslationResult | null;
  settings: AppSettings;
  onSpeak: (text: string) => void;
  isTranslating: boolean;
  minimal?: boolean;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  currentResult,
  settings,
  onSpeak,
  isTranslating,
  minimal = false,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (!currentResult?.translatedText) return;
    navigator.clipboard.writeText(currentResult.translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFontSizeClass = () => {
    switch (settings.fontSize) {
      case 'small':
        return 'text-lg sm:text-xl';
      case 'medium':
        return 'text-xl sm:text-2xl';
      case 'huge':
        return 'text-3xl sm:text-4xl md:text-5xl';
      case 'large':
      default:
        return 'text-2xl sm:text-3xl md:text-4xl';
    }
  };

  if (!currentResult && !isTranslating) {
    if (minimal) return null;
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-3 bg-slate-950/85 backdrop-blur-md rounded-2xl border border-slate-800/80 text-center text-slate-400 flex items-center justify-center gap-3">
        <Subtitles className="w-5 h-5 text-lime-400/80 animate-pulse" />
        <span className="text-sm">
          Kamera veya ekranı TV&apos;ye tutun. Çeviri anlık olarak burada belirecek.
        </span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto transition-all duration-300">
      <div
        className={`relative overflow-hidden rounded-2xl border transition-all ${
          settings.highContrastSubtitles
            ? 'bg-black/92 border-lime-500/30 shadow-2xl shadow-black/80'
            : 'bg-slate-950/80 backdrop-blur-md border-slate-800'
        } p-4 sm:p-6`}
      >
        {/* Top Info Bar */}
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-lime-500/15 text-lime-400 border border-lime-500/30 flex items-center gap-1.5">
              <Layers className="w-3 h-3" />
              {currentResult?.context || 'Altyazı'}
            </span>

            {currentResult?.sourceLanguage && (
              <span className="text-slate-400 hidden sm:inline">
                {currentResult.sourceLanguage} ➔ {currentResult.targetLanguage}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isTranslating && (
              <span className="flex items-center gap-1.5 text-lime-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-lime-400 animate-ping"></span>
                <span>İşleniyor...</span>
              </span>
            )}

            {currentResult?.latencyMs && (
              <span className="text-slate-400 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>{currentResult.latencyMs}ms</span>
              </span>
            )}

            {currentResult && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onSpeak(currentResult.translatedText)}
                  title="Sesli Oku"
                  className="p-1 rounded-md hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCopy}
                  title="Kopyala"
                  className="p-1 rounded-md hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-lime-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Original Text (If available) */}
        {currentResult?.originalText && (
          <p className="text-xs sm:text-sm text-slate-400 italic mb-2 line-clamp-2">
            &ldquo;{currentResult.originalText}&rdquo;
          </p>
        )}

        {/* Big Translated Text */}
        <div className="min-h-[2.5rem] flex items-center">
          <p
            className={`font-black tracking-wide text-white leading-tight ${getFontSizeClass()} ${
              settings.highContrastSubtitles ? 'drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]' : ''
            }`}
            style={{
              textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)',
            }}
          >
            {currentResult?.translatedText || (
              <span className="text-slate-500 italic text-lg font-normal">
                Görüntü taranıyor...
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
