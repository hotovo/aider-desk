export interface VoiceProvider {
  name: string;
  startSession(config: VoiceSessionConfig): Promise<VoiceSession>;
  stopSession(): Promise<void>;
  onTranscription?: (text: string) => void;
  onError?: (error: Error) => void;
  onSessionStateChange?: (state: VoiceSessionState) => void;
}

export interface VoiceSessionConfig {
  token: string;
  model: string;
  mediaStream: MediaStream;
  idleTimeoutMs: number;
  onTranscription: (text: string) => void;
  onError: (error: Error) => void;
  onSessionStateChange?: (state: VoiceSessionState) => void;
  onStopRecording?: () => void;
}

export interface VoiceSession {
  isActive: boolean;
  provider: VoiceProvider;
}

export enum VoiceSessionState {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  ACTIVE = 'active',
  ERROR = 'error',
  CLOSED = 'closed',
}
