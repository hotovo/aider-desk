import { GoogleGenAI, LiveServerMessage, Session } from '@google/genai';

import { VoiceProvider, VoiceSession, VoiceSessionConfig, VoiceSessionState } from './types';

export class GeminiVoiceProvider implements VoiceProvider {
  name = 'gemini';

  private session: Session | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private config: VoiceSessionConfig | null = null;
  private lastAudioTimeRef: number = 0;

  // Silence detection refs
  private silenceTimeoutRef: NodeJS.Timeout | null = null;
  private stopRecordingCallback: (() => void) | null = null;

  // Session management refs
  private sessionTimerRef: NodeJS.Timeout | null = null;
  private audioQueue: string[] = [];
  private sessionRestartInProgress: boolean = false;
  private isSessionActive: boolean = false;
  private audioProcessingActive: boolean = false;

  async startSession(config: VoiceSessionConfig): Promise<VoiceSession> {
    this.config = config;
    this.stopRecordingCallback = config.onStopRecording || null;
    this.setState(VoiceSessionState.CONNECTING);

    // Setup audio processing once and keep it alive
    if (!this.audioProcessingActive) {
      await this.setupAudioProcessing(config.mediaStream);
      this.audioProcessingActive = true;
    }

    return this.createGeminiSession(config);
  }

  private async createGeminiSession(config: VoiceSessionConfig): Promise<VoiceSession> {
    try {
      const client = new GoogleGenAI({
        apiKey: config.token,
        httpOptions: {
          apiVersion: 'v1alpha',
        },
      });

      const session = await client.live.connect({
        model: config.model,
        callbacks: {
          onopen: () => {
            this.setState(VoiceSessionState.ACTIVE);
            this.startSessionTimer();
            this.isSessionActive = true;
          },
          onmessage: (message: LiveServerMessage) => {
            // eslint-disable-next-line no-console
            console.log(message);
            this.handleMessage(message);
          },
          onclose: (e) => {
            // eslint-disable-next-line no-console
            console.log('Session closed:', e);
            if (!this.sessionRestartInProgress) {
              this.setState(VoiceSessionState.CLOSED);
            }
          },
          onerror: (e) => {
            this.setState(VoiceSessionState.ERROR);
            config.onError(new Error(e.message));
          },
        },
      });

      this.session = session;

      // Initialize silence detection
      this.lastAudioTimeRef = Date.now();

      session.sendRealtimeInput({ activityStart: {} });

      this.flushAudioQueue();

      return { isActive: true, provider: this };
    } catch (error) {
      this.setState(VoiceSessionState.ERROR);
      config.onError(error as Error);
      throw error;
    }
  }

  async stopSession(): Promise<void> {
    this.isSessionActive = false;
    this.setState(VoiceSessionState.CLOSED);

    // Clear session timer
    if (this.sessionTimerRef) {
      clearTimeout(this.sessionTimerRef);
      this.sessionTimerRef = null;
    }

    // Clear silence detection timeout
    if (this.silenceTimeoutRef) {
      clearTimeout(this.silenceTimeoutRef);
      this.silenceTimeoutRef = null;
    }

    // Close Gemini session
    await this.closeGeminiSession();

    // Cleanup audio processing
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    this.audioProcessingActive = false;

    // Clear audio queue
    this.audioQueue = [];
  }

  private async closeGeminiSession(): Promise<void> {
    if (this.session) {
      try {
        this.session.close();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error closing Gemini session:', error);
      }
      this.session = null;
    }
  }

  private async setupAudioProcessing(stream: MediaStream): Promise<void> {
    const audioContext = new AudioContext({ sampleRate: 16000 });
    this.audioContext = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    this.source = source;

    const processor = audioContext.createScriptProcessor(8192, 1, 1);
    this.processor = processor;

    processor.addEventListener('audioprocess', (e) => {
      const inputData = e.inputBuffer.getChannelData(0);

      // Calculate RMS to detect audio level
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);

      // Check if audio level is above threshold (adjust as needed)
      const audioThreshold = 0.01; // Threshold for detecting audio input
      const hasAudioInput = rms > audioThreshold;

      if (hasAudioInput) {
        // Reset the silence timer when audio is detected
        this.lastAudioTimeRef = Date.now();

        // Clear existing timeout
        if (this.silenceTimeoutRef) {
          clearTimeout(this.silenceTimeoutRef);
        }
      } else {
        // Check for silence
        const timeSinceLastAudio = Date.now() - this.lastAudioTimeRef;
        const idleTimeoutMs = this.config?.idleTimeoutMs ?? 5000;
        if (timeSinceLastAudio > idleTimeoutMs && !this.silenceTimeoutRef) {
          this.silenceTimeoutRef = setTimeout(() => {
            this.stopRecordingCallback?.();
          }, 100);
        }
      }

      const pcmData = this.convertFloat32ToInt16(inputData);
      const base64Audio = this.arrayBufferToBase64(pcmData.buffer as ArrayBuffer);

      if (this.session && this.isSessionActive) {
        // Send directly to active session
        this.session.sendRealtimeInput({
          media: {
            data: base64Audio,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      } else if (this.audioProcessingActive) {
        // Queue audio when session is inactive but audio processing is active
        this.queueAudioData(base64Audio);
      }
    });

    source.connect(processor);
    processor.connect(audioContext.destination);
  }

  private handleMessage(message: LiveServerMessage): void {
    if (message.serverContent?.inputTranscription) {
      const textChunk = message.serverContent.inputTranscription.text;
      if (textChunk) {
        this.config?.onTranscription(textChunk);
      }
    }
  }

  private convertFloat32ToInt16(float32Array: Float32Array): Int16Array {
    const pcmData = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcmData;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  private setState(newState: VoiceSessionState): void {
    this.config?.onSessionStateChange?.(newState);
  }

  private startSessionTimer(): void {
    if (this.sessionTimerRef) {
      clearTimeout(this.sessionTimerRef);
    }

    // Restart session every 30 seconds
    this.sessionTimerRef = setTimeout(() => {
      this.restartSession();
    }, 10000);
  }

  private async restartSession(): Promise<void> {
    if (this.sessionRestartInProgress || !this.config || !this.audioProcessingActive) {
      return;
    }

    this.sessionRestartInProgress = true;
    this.isSessionActive = false;
    // Don't set external state to INACTIVE - keep it as ACTIVE from user perspective

    try {
      // eslint-disable-next-line no-console
      console.log('Restarting session...');
      // Close current session but keep audio processing
      await this.closeGeminiSession();

      // Start new session without tearing down audio processing
      await this.createGeminiSession(this.config);
    } catch (error) {
      this.setState(VoiceSessionState.ERROR);
      this.config?.onError(error as Error);
    } finally {
      this.sessionRestartInProgress = false;
    }
  }

  private queueAudioData(base64Audio: string): void {
    this.audioQueue.push(base64Audio);

    // Limit queue size to prevent memory issues
    if (this.audioQueue.length > 100) {
      this.audioQueue.shift(); // Remove oldest
    }
  }

  private flushAudioQueue(): void {
    if (!this.session || !this.isSessionActive || this.audioQueue.length === 0) {
      return;
    }

    this.audioQueue.forEach((audioData) => {
      this.session!.sendRealtimeInput({
        media: {
          data: audioData,
          mimeType: 'audio/pcm;rate=16000',
        },
      });
    });

    this.audioQueue = [];
  }
}

// Factory function
export const createGeminiVoiceProvider = (): VoiceProvider => {
  return new GeminiVoiceProvider();
};
