import { useState, useEffect, useCallback, useRef } from 'react';
import { MainMenu } from './components/MainMenu';
import { CameraView } from './components/CameraView';
import { VoiceView } from './components/VoiceView';
import { SettingsModal } from './components/SettingsModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { DEFAULT_SETTINGS } from './types';
import type { AppSettings, TranslationResult } from './types';
import { voiceManager } from './services/voiceService';
import { X, AlertCircle } from 'lucide-react';

const SETTINGS_STORAGE_KEY = 'translateall_settings_v2';
const HISTORY_STORAGE_KEY = 'translateall_history_v2';

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
          enableTts: parsed.enableTts !== undefined ? parsed.enableTts : true,
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

  // App navigation state: 'menu' | 'camera' | 'voice'
  const [activeTab, setActiveTab] = useState<'menu' | 'camera' | 'voice'>('menu');
  const [currentResult, setCurrentResult] = useState<TranslationResult | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [tvMode, setTvMode] = useState(settings.tvMode);

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

  // Toggle TTS dubbing helper
  const handleToggleTts = useCallback(() => {
    voiceManager.unlockAudio();
    setSettings((prev) => {
      const updated = { ...prev, enableTts: !prev.enableTts };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

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
      voiceManager.unlockAudio();
      voiceManager.speak(text, settings.ttsVoiceSpeed);
    },
    [settings.ttsVoiceSpeed]
  );

  // Screen share on PC
  const handleScreenShare = async () => {
    try {
      voiceManager.unlockAudio();
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
    } else {
      document.exitFullscreen().catch(() => {});
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
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        if (activeTab !== 'menu') {
          setActiveTab('menu');
        }
      } else if (e.key === 't' || e.key === 'T') {
        setTvMode((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  return (
    <div
      ref={appContainerRef}
      className={`min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none overflow-x-hidden ${
        tvMode ? 'tv-interface' : ''
      }`}
    >
      {/* Error Toast Notification */}
      {errorMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="bg-rose-500/95 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 backdrop-blur-md border border-rose-400/40">
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

      {/* Main View Router */}
      <main className="flex-1 flex flex-col w-full h-full">
        {activeTab === 'menu' && (
          <MainMenu
            onStartCamera={() => {
              voiceManager.unlockAudio();
              setActiveTab('camera');
            }}
            onStartVoice={() => {
              voiceManager.unlockAudio();
              setActiveTab('voice');
            }}
            onStartScreenShare={handleScreenShare}
            openSettings={() => setIsSettingsOpen(true)}
            openHistory={() => setIsHistoryOpen(true)}
            settings={settings}
            onToggleTts={handleToggleTts}
            historyCount={history.length}
            lastTranslation={currentResult}
            onSpeak={handleSpeak}
          />
        )}

        {activeTab === 'camera' && (
          <div className="flex-1 flex flex-col w-full h-full p-0 sm:p-4 max-w-6xl mx-auto">
            <CameraView
              settings={settings}
              onNewTranslation={handleNewTranslation}
              isTranslating={isTranslating}
              setIsTranslating={setIsTranslating}
              onError={showError}
              screenStream={screenStream}
              onClearScreenStream={handleClearScreenStream}
              onSpeak={handleSpeak}
              onBackToMenu={() => setActiveTab('menu')}
              onToggleTts={handleToggleTts}
              currentResult={currentResult}
            />
          </div>
        )}

        {activeTab === 'voice' && (
          <div className="flex-1 flex flex-col w-full h-full p-3 sm:p-4 max-w-4xl mx-auto safe-header safe-bottom">
            <VoiceView
              settings={settings}
              onNewTranslation={handleNewTranslation}
              isTranslating={isTranslating}
              setIsTranslating={setIsTranslating}
              onError={showError}
              onSpeak={handleSpeak}
              onBackToMenu={() => setActiveTab('menu')}
              onToggleTts={handleToggleTts}
              currentResult={currentResult}
            />
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
