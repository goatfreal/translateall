import { getDefaultApiKey } from './services/security';

export interface TranslationResult {
  id: string;
  timestamp: number;
  originalText: string;
  translatedText: string;
  context: 'Dialogue' | 'UI Menu' | 'Mission' | 'Subtitle' | 'Item' | 'General';
  sourceLanguage: string;
  targetLanguage: string;
  latencyMs: number;
  confidence?: number;
}

export type VideoSourceMode = 'camera' | 'screen' | 'file';

export interface AppSettings {
  nvidiaApiKey: string;
  visionModel: string;
  textModel: string;
  targetLanguage: string;
  sourceLanguage: string;
  autoIntervalSeconds: number;
  enableTts: boolean;
  ttsVoiceSpeed: number;
  turboGamingMode: boolean; // Ultra-fast gaming latency mode
  roiEnabled: boolean;
  roiBox: {
    x: number; // percentage 0-100
    y: number;
    width: number;
    height: number;
  };
  tvMode: boolean;
  highContrastSubtitles: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'huge';
}

export const DEFAULT_SETTINGS: AppSettings = {
  nvidiaApiKey: getDefaultApiKey(),
  visionModel: 'nvidia/nemotron-3.5-super-vl-120b-a12b',
  textModel: 'nvidia/riva-translate-4b-instruct-v2',
  targetLanguage: 'tr',
  sourceLanguage: 'auto',
  autoIntervalSeconds: 1.5,
  enableTts: true, // Auto dubbing / voice reading enabled by default for games!
  ttsVoiceSpeed: 1.1,
  turboGamingMode: true,
  roiEnabled: true, // Focused subtitle area for gaming speed
  roiBox: {
    x: 5,
    y: 68,
    width: 90,
    height: 28,
  },
  tvMode: false,
  highContrastSubtitles: true,
  fontSize: 'large',
};

export const AVAILABLE_VISION_MODELS = [
  { id: 'nvidia/nemotron-3.5-super-vl-120b-a12b', name: 'NVIDIA Nemotron Super VL 120B (Önerilen / ~800ms Oyun İçi)' },
  { id: 'meta/llama-3.2-11b-vision-instruct', name: 'Meta Llama 3.2 11B Vision Instruct' },
  { id: 'meta/llama-3.2-90b-vision-instruct', name: 'Meta Llama 3.2 90B Vision Instruct' },
];

export const AVAILABLE_TEXT_MODELS = [
  { id: 'nvidia/riva-translate-4b-instruct-v2', name: 'NVIDIA Riva Translate 4B v2 (Roket Hızında / ~350ms Çeviri)' },
  { id: 'meta/llama-3.3-70b-instruct', name: 'Meta Llama 3.3 70B Instruct' },
  { id: 'mistralai/mistral-large-2-instruct', name: 'Mistral Large 2 Instruct' },
];

export const LANGUAGES = [
  { code: 'tr', name: 'Türkçe (Turkish)' },
  { code: 'en', name: 'English (İngilizce)' },
  { code: 'de', name: 'Deutsch (Almanca)' },
  { code: 'fr', name: 'Français (Fransızca)' },
  { code: 'es', name: 'Español (İspanyolca)' },
  { code: 'it', name: 'Italiano (İtalyanca)' },
  { code: 'ja', name: '日本語 (Japonca)' },
  { code: 'ru', name: 'Русский (Rusça)' },
  { code: 'ko', name: '한국어 (Korece)' },
  { code: 'zh', name: '中文 (Çince)' },
  { code: 'ar', name: 'العربية (Arapça)' },
];
