import React from 'react';
import type { TranslationResult } from '../types';
import { X, Trash2, Volume2, Clock, Zap } from 'lucide-react';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: TranslationResult[];
  onClear: () => void;
  onSpeak: (text: string) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onClear,
  onSpeak,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-md h-full bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col pt-12 pb-6">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">Çeviri Geçmişi</h3>
            <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full text-slate-300 font-bold">
              {history.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={onClear}
                title="Geçmişi Temizle"
                className="p-2 text-slate-400 hover:text-rose-400 bg-slate-900 border border-white/10 rounded-xl transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-white/10 rounded-xl transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">
              Henüz kaydedilmiş diyalog veya çeviri yok.
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl hover:border-slate-700 transition-all"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-lime-400 font-semibold uppercase tracking-wider">
                    {item.context}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-0.5">
                      <Zap className="w-3 h-3 text-amber-400" />
                      {item.latencyMs}ms
                    </span>
                    <span>
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {item.originalText && (
                  <p className="text-xs text-slate-400 italic mb-1.5 line-clamp-3">
                    &ldquo;{item.originalText}&rdquo;
                  </p>
                )}

                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-white flex-1">{item.translatedText}</p>
                  <button
                    onClick={() => onSpeak(item.translatedText)}
                    className="p-1 text-slate-400 hover:text-lime-400 transition-colors"
                    title="Sesli Oku"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
