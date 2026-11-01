import { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { CameraView } from './components/CameraView';
import { VoiceView } from './components/VoiceView';
import { SubtitleOverlay } from './components/SubtitleOverlay';
import { SettingsModal } from './components/SettingsModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { DEFAULT_SETTINGS } from './types';
import type { AppSettings, TranslationResult } from './types';
import { voiceManager } from './services/voiceService';
import { X, AlertCircle } from 'lucide-react';

const SETTINGS_STORAGE_KEY = 'translateall_settings_v1';
const HISTORY_STORAGE_KEY = 'translateall_history_v1';

export function App() {
  // Load settings from localStorage
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          nvidiaApiKey: parsed.nvidiaApiKey && parsed.nvidiaApiKey.trim() ? parsed.nvidiaApiKey : DEFAULT_SETTINGS.nvidiaApiKey,
        };
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Load history
  const [history, setHistory] = useState<TranslationResult[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState<'camera' | 'voice'>('camera');
  const [currentResult, setCurrentResult] = useState<TranslationResult | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [tvMode, setTvMode] = useState(settings.tvMode);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const appContainerRef = useRef<HTMLDivElement | null>(null);

  // Save settings on update
  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.warn('Could not save settings:', e);
    }
  };

  // Add new translation
  const handleNewTranslation = useCallback(
    (res: TranslationResult) => {
      setCurrentResult(res);
      setHistory((prev) => {
        const updated = [res, ...prev.slice(0, 49)];
        try {
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    },
    []
  );

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {}
  };

  // Error toast helper
  const showError = useCallback((msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => {
      setErrorMessage((curr) => (curr === msg ? null : curr));
    }, 5000);
  }, []);

  // Text to speech helper
  const handleSpeak = useCallback(
    (text: string) => {
      voiceManager.speak(text, settings.ttsVoiceSpeed);
    },
    [settings.ttsVoiceSpeed]
  );

  // Screen share on PC
  const handleScreenShare = async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        showError('Bu platformda ekran yakalama desteklenmiyor.');
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: false,
      });

      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
      };

      setScreenStream(stream);
      setActiveTab('camera');
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        showError('Ekran paylaşımı başlatılamadı.');
      }
    }
  };

  const handleClearScreenStream = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // TV Remote & Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        setActiveTab((prev) => (prev === 'camera' ? 'voice' : 'camera'));
      } else if (e.key === 't' || e.key === 'T') {
        setTvMode((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      ref={appContainerRef}
      className={`min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none ${
        tvMode ? 'tv-interface' : ''
      }`}
    >
      {/* Header bar */}
      {!tvMode && (
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tvMode={tvMode}
          setTvMode={setTvMode}
          openSettings={() => setIsSettingsOpen(true)}
          toggleHistory={() => setIsHistoryOpen(true)}
          historyCount={history.length}
          isFullscreen={isFullscreen}
          toggleFullscreen={toggleFullscreen}
          apiKeyConfigured={!!settings.nvidiaApiKey.trim()}
          onSelectScreenShare={handleScreenShare}
        />
      )}

      {/* Error Toast Notification */}
      {errorMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="bg-rose-500/90 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 backdrop-blur-md border border-rose-400/40">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-semibold">{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* TV Mode Minimal Exit Button */}
      {tvMode && (
        <div className="fixed top-3 right-4 z-40 flex items-center gap-2">
          <button
            onClick={() => setTvMode(false)}
            className="px-3 py-1.5 bg-black/70 hover:bg-black text-xs font-bold text-slate-300 rounded-full border border-white/20 backdrop-blur-md"
          >
            TV Modundan Çık (T)
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 bg-black/70 hover:bg-black rounded-full border border-white/20 text-slate-300 backdrop-blur-md"
          >
            Ayarlar
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 flex flex-col gap-4">
        {activeTab === 'camera' ? (
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex-1 min-h-[360px]">
              <CameraView
                settings={settings}
                onNewTranslation={handleNewTranslation}
                isTranslating={isTranslating}
                setIsTranslating={setIsTranslating}
                onError={showError}
                screenStream={screenStream}
                onClearScreenStream={handleClearScreenStream}
                onSpeak={handleSpeak}
              />
            </div>

            <div className="w-full">
              <SubtitleOverlay
                currentResult={currentResult}
                settings={settings}
                onSpeak={handleSpeak}
                isTranslating={isTranslating}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            <VoiceView
              settings={settings}
              onNewTranslation={handleNewTranslation}
              isTranslating={isTranslating}
              setIsTranslating={setIsTranslating}
              onError={showError}
              onSpeak={handleSpeak}
            />

            <div className="w-full">
              <SubtitleOverlay
                currentResult={currentResult}
                settings={settings}
                onSpeak={handleSpeak}
                isTranslating={isTranslating}
              />
            </div>
          </div>
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      {/* History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onClear={handleClearHistory}
        onSpeak={handleSpeak}
      />
    </div>
  );
}

export default App;
