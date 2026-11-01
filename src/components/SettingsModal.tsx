import React, { useState } from 'react';
import {
  X,
  Key,
  Cpu,
  Globe,
  Sliders,
  Volume2,
  Tv,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Zap,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import type { AppSettings } from '../types';
import {
  AVAILABLE_VISION_MODELS,
  AVAILABLE_TEXT_MODELS,
  LANGUAGES,
} from '../types';
import { getDefaultApiKey, maskApiKey } from '../services/security';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [formData, setFormData] = useState<AppSettings>({ ...settings });
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  if (!isOpen) return null;

  const handleTestApiKey = async () => {
    if (!formData.nvidiaApiKey.trim()) {
      setTestStatus('error');
      setTestMessage('Lütfen önce bir API anahtarı girin.');
      return;
    }

    setTestStatus('testing');
    setTestMessage('NVIDIA NIM API test ediliyor...');

    try {
      const response = await fetch('https://integrate.api.nvidia.com/v1/models', {
        headers: {
          Authorization: `Bearer ${formData.nvidiaApiKey.trim()}`,
        },
      });

      if (response.ok) {
        setTestStatus('success');
        setTestMessage('Bağlantı başarılı! NVIDIA NIM modelleri aktif.');
      } else {
        setTestStatus('error');
        setTestMessage(`API Hatası (${response.status}): Anahtarınızı kontrol edin.`);
      }
    } catch (e: any) {
      setTestStatus('error');
      setTestMessage(`Bağlantı kurulamadı: ${e?.message || e}`);
    }
  };

  const handleResetToDefaultKey = () => {
    const defaultKey = getDefaultApiKey();
    setFormData({ ...formData, nvidiaApiKey: defaultKey });
    setTestStatus('idle');
  };

  const handleSaveAndClose = () => {
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md pt-12">
      <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-black text-white">Ayarlar</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-white/10 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* NVIDIA API Key Section */}
          <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-lime-400" />
                <span>NVIDIA API Key (Şifreli & Korumalı)</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 font-semibold">
                  <ShieldCheck className="w-3 h-3" /> .ipa / .apk Korumalı
                </span>
                <button
                  type="button"
                  onClick={handleResetToDefaultKey}
                  title="Kayıtlı Anahtara Sıfırla"
                  className="text-xs text-slate-400 hover:text-lime-400 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">Sıfırla</span>
                </button>
              </div>
            </div>

            <div className="relative mb-3">
              <input
                type={showKey ? 'text' : 'password'}
                value={formData.nvidiaApiKey}
                onChange={(e) => {
                  setFormData({ ...formData, nvidiaApiKey: e.target.value });
                  setTestStatus('idle');
                }}
                placeholder="nvapi-..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-lime-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-3 text-slate-400 hover:text-white"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleTestApiKey}
                disabled={testStatus === 'testing'}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>{testStatus === 'testing' ? 'Test Ediliyor...' : 'Bağlantıyı Test Et'}</span>
              </button>

              {testStatus === 'success' && (
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                  <Check className="w-3.5 h-3.5" /> {testMessage}
                </span>
              )}
              {testStatus === 'error' && (
                <span className="text-xs text-rose-400 flex items-center gap-1 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" /> {testMessage}
                </span>
              )}
              {testStatus === 'idle' && formData.nvidiaApiKey && (
                <span className="text-[11px] text-slate-400 font-mono">
                  Aktif: {maskApiKey(formData.nvidiaApiKey)}
                </span>
              )}
            </div>
          </div>

          {/* Model Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-lime-400" />
                <span>Kamera Vision Modeli</span>
              </label>
              <select
                value={formData.visionModel}
                onChange={(e) => setFormData({ ...formData, visionModel: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 text-white text-xs rounded-xl p-2.5 focus:border-lime-500 outline-none font-semibold"
              >
                {AVAILABLE_VISION_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-lime-400" />
                <span>Ses & Metin Çeviri Modeli (Ultra Hızlı)</span>
              </label>
              <select
                value={formData.textModel}
                onChange={(e) => setFormData({ ...formData, textModel: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 text-white text-xs rounded-xl p-2.5 focus:border-lime-500 outline-none font-semibold"
              >
                {AVAILABLE_TEXT_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Target Language & Scan Interval */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Hedef Çeviri Dili</label>
              <select
                value={formData.targetLanguage}
                onChange={(e) => setFormData({ ...formData, targetLanguage: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 text-white text-xs rounded-xl p-2.5 focus:border-lime-500 outline-none"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Kamera Oto-Tarama Hızı (Oyun Akışı)
              </label>
              <select
                value={formData.autoIntervalSeconds}
                onChange={(e) =>
                  setFormData({ ...formData, autoIntervalSeconds: Number(e.target.value) })
                }
                className="w-full bg-slate-900 border border-slate-800 text-white text-xs rounded-xl p-2.5 focus:border-lime-500 outline-none"
              >
                <option value={1.2}>1.2 saniye (Işık Hızında / Turbo Oyun Modu)</option>
                <option value={1.5}>1.5 saniye (Tavsiye Edilen - Oyun Altyazıları İçin)</option>
                <option value={2.5}>2.5 saniye (Dengeli)</option>
                <option value={4}>4 saniye (Yavaş Hikaye / Düşük Kota)</option>
              </select>
            </div>
          </div>

          {/* Subtitle Font Size & Dubbing Speed */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Altyazı Boyutu (TV İçin)</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['small', 'medium', 'large', 'huge'] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setFormData({ ...formData, fontSize: size })}
                    className={`py-2 text-xs font-bold rounded-xl border capitalize transition-all ${
                      formData.fontSize === size
                        ? 'bg-lime-500/20 border-lime-500 text-lime-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {size === 'huge' ? 'Devasa' : size === 'large' ? 'Büyük' : size === 'medium' ? 'Orta' : 'Küçük'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Ses Hızı (Dublaj)</label>
              <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
                <Volume2 className="w-4 h-4 text-slate-400" />
                <input
                  type="range"
                  min="0.8"
                  max="1.5"
                  step="0.05"
                  value={formData.ttsVoiceSpeed}
                  onChange={(e) =>
                    setFormData({ ...formData, ttsVoiceSpeed: parseFloat(e.target.value) })
                  }
                  className="flex-1 accent-lime-500 cursor-pointer"
                />
                <span className="text-xs font-mono text-white w-10 text-right">
                  {formData.ttsVoiceSpeed}x
                </span>
              </div>
            </div>
          </div>

          {/* TV & Remote Control Shortcuts Box */}
          <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-white">
              <Tv className="w-4 h-4 text-lime-400" />
              <span>TV Kumandası & PC Kısayol Tuşları</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-400">
              <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono">SPACE / OK</kbd> : Şimdi Çevir</div>
              <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono">M</kbd> : Sesli Çeviri Modu</div>
              <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono">C</kbd> : Kamera / Ekran Değiştir</div>
              <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono">F / F11</kbd> : Tam Ekran</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-950">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
          >
            İptal
          </button>
          <button
            onClick={handleSaveAndClose}
            className="px-6 py-2.5 bg-lime-500 hover:bg-lime-400 text-slate-950 font-black rounded-xl text-xs tracking-wide shadow-lg shadow-lime-500/20"
          >
            Kaydet ve Başla
          </button>
        </div>
      </div>
    </div>
  );
};
