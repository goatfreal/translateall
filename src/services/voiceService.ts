// Voice recognition and Text-To-Speech service

export interface VoiceRecognitionHandlers {
  onResult: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onStateChange: (listening: boolean) => void;
}

class VoiceManager {
  private recognition: any = null;
  private isListening = false;
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
    const voices = window.speechSynthesis.getVoices();
    this.synthesisVoice =
      voices.find((v) => v.lang.startsWith('tr') || v.name.toLowerCase().includes('turkish')) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      null;
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
        // 'no-speech' is common and harmless during quiet periods
        if (event.error !== 'no-speech') {
          handlers.onError(`Mikrofon/Ses hatası: ${event.error}`);
        }
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          // Restart if still supposed to be listening (for continuous gaming session)
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

  public speak(text: string, speed: number = 1.05, lang: string = 'tr-TR') {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (!text || text.trim() === '') return;

    // Stop current speech so it stays synced with real-time video/audio
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = Math.max(0.5, Math.min(2.0, speed));
    utterance.pitch = 1.0;
    utterance.lang = lang;

    if (!this.synthesisVoice) {
      this.selectTurkishVoice();
    }
    if (this.synthesisVoice) {
      utterance.voice = this.synthesisVoice;
    }

    window.speechSynthesis.speak(utterance);
  }

  public stopSpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const voiceManager = new VoiceManager();
