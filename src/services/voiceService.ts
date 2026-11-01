// Voice recognition and Dual-Engine Text-To-Speech service (GameCaption Style)

export interface VoiceRecognitionHandlers {
  onResult: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onStateChange: (listening: boolean) => void;
}

class VoiceManager {
  private recognition: any = null;
  private isListening = false;
  private currentAudio: HTMLAudioElement | null = null;
  private isAudioUnlocked = false;
  private synthesisVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.initVoices();
  }

  private initVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.selectTurkishVoice();
      };
      this.selectTurkishVoice();
    }
  }

  private selectTurkishVoice() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;
      this.synthesisVoice =
        voices.find((v) => v.lang.startsWith('tr') || v.lang.startsWith('TR') || v.name.toLowerCase().includes('turkish')) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        voices[0] ||
        null;
    } catch (e) {
      console.warn('Voice select error:', e);
    }
  }

  // Pre-unlocks audio context on iOS Safari / WKWebView on touch
  public unlockAudio() {
    if (typeof window === 'undefined') return;
    if (this.isAudioUnlocked) return;

    try {
      // 1. Unlock Web Audio Context / Speech
      if ('speechSynthesis' in window) {
        const dummy = new SpeechSynthesisUtterance(' ');
        dummy.volume = 0.01;
        dummy.rate = 2.0;
        window.speechSynthesis.speak(dummy);
      }

      // 2. Unlock HTML5 Audio
      const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      silentAudio.play().then(() => {
        silentAudio.pause();
        this.isAudioUnlocked = true;
      }).catch(() => {
        this.isAudioUnlocked = true;
      });

      this.selectTurkishVoice();
    } catch (e) {
      console.warn('Could not unlock audio:', e);
    }
  }

  public isSpeechSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }

  public startListening(
    handlers: VoiceRecognitionHandlers,
    lang: string = 'en-US'
  ): boolean {
    this.unlockAudio();

    if (!this.isSpeechSupported()) {
      handlers.onError('Tarayıcınız veya cihazınız Web Speech API ses tanımayı desteklemiyor.');
      return false;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (this.recognition) {
        this.recognition.abort();
      }

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = lang;

      this.recognition.onstart = () => {
        this.isListening = true;
        handlers.onStateChange(true);
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript.trim()) {
          handlers.onResult(finalTranscript.trim(), true);
        } else if (interimTranscript.trim()) {
          handlers.onResult(interimTranscript.trim(), false);
        }
      };

      this.recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          handlers.onError(`Mikrofon hatası: ${event.error}`);
        }
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          try {
            this.recognition.start();
          } catch {
            this.isListening = false;
            handlers.onStateChange(false);
          }
        } else {
          handlers.onStateChange(false);
        }
      };

      this.recognition.start();
      return true;
    } catch (e: any) {
      handlers.onError(`Ses tanıma başlatılamadı: ${e?.message || e}`);
      return false;
    }
  }

  public stopListening() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
  }

  // Dual-Engine Spoken Subtitles (GameCaption style: Natural Turkish Audio with instant fallback)
  public async speak(
    text: string,
    speed: number = 1.1,
    voiceType: 'natural' | 'device' = 'natural'
  ): Promise<void> {
    if (!text || text.trim() === '') return;
    this.stopSpeaking();

    // 1. PRIMARY ENGINE: Natural Human-Sounding Turkish TTS (bypasses iOS SpeechSynthesis silence bugs)
    if (voiceType === 'natural') {
      try {
        const clean = text.replace(/[*_#`~]/g, '').trim();
        // Keep under 180 chars per audio chunk for instant playback
        const snippet = clean.substring(0, 180);
        const encoded = encodeURIComponent(snippet);
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=tr&client=tw-ob&q=${encoded}`;

        const audio = new Audio(ttsUrl);
        audio.playbackRate = Math.max(0.85, Math.min(1.6, speed));
        this.currentAudio = audio;

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
          return;
        }
      } catch (err) {
        console.warn('Natural Turkish audio playback error, falling back to Web Speech:', err);
      }
    }

    // 2. FALLBACK ENGINE: Apple iOS Native SpeechSynthesis
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        this.unlockAudio();
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = Math.max(0.7, Math.min(1.8, speed));
        utterance.pitch = 1.0;
        utterance.lang = 'tr-TR';

        if (!this.synthesisVoice) {
          this.selectTurkishVoice();
        }
        if (this.synthesisVoice) {
          utterance.voice = this.synthesisVoice;
        }

        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.warn('Web Speech fallback error:', e);
    }
  }

  public stopSpeaking() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.currentAudio = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }
}

export const voiceManager = new VoiceManager();
