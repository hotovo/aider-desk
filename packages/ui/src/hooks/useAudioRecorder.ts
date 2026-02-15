import { useCallback, useRef, useState } from 'react';

import { useApi } from '@/contexts/ApiContext';
import { useModelProviders } from '@/contexts/ModelProviderContext';
import { createGeminiVoiceProvider, createOpenAIVoiceProvider } from '@/voice';
import { VoiceProvider, VoiceSession, VoiceSessionState } from '@/voice/types';

export interface UseAudioRecorderType {
  isRecording: boolean;
  isProcessing: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  transcription: string;
  error: string | null;
  resetTranscription: () => void;
  voiceAvailable: boolean;
  mediaStream: MediaStream | null;
}

export const useAudioRecorder = (): UseAudioRecorderType => {
  const api = useApi();
  const { providers } = useModelProviders();

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const voiceProviderRef = useRef<VoiceProvider | null>(null);
  const sessionRef = useRef<VoiceSession | null>(null);

  const getVoiceProvider = useCallback(() => {
    return providers.find((p) => p.provider.voiceEnabled);
  }, [providers]);

  const voiceAvailable = !!getVoiceProvider();

  const createVoiceProvider = useCallback((providerName: string): VoiceProvider => {
    switch (providerName) {
      case 'gemini':
        return createGeminiVoiceProvider();
      case 'openai':
        return createOpenAIVoiceProvider();
      // Future providers can be added here
      default:
        throw new Error(`Unsupported voice provider: ${providerName}`);
    }
  }, []);

  const handleTranscription = useCallback((text: string) => {
    setTranscription((prev) => prev + text);
  }, []);

  const handleError = useCallback((error: Error) => {
    setError(error.message);
  }, []);

  const handleSessionStateChange = useCallback((state: VoiceSessionState) => {
    setIsProcessing(state === VoiceSessionState.CONNECTING);
    if (state === VoiceSessionState.ERROR || state === VoiceSessionState.CLOSED) {
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (voiceProviderRef.current) {
      await voiceProviderRef.current.stopSession();
      voiceProviderRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setMediaStream(null);
    }

    setIsRecording(false);
    setIsProcessing(false);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscription('');
    const voiceProviderProfile = getVoiceProvider();

    if (!voiceProviderProfile) {
      setError('No voice-enabled provider found. Please configure one in the Model Library.');
      return;
    }

    try {
      // Create voice session first.
      // On macOS this is also where we trigger the OS-level microphone permission prompt.
      const session = await api.createVoiceSession(voiceProviderProfile);
      const inputDeviceId = localStorage.getItem('voice-microphone-device-id') || undefined;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: inputDeviceId && inputDeviceId !== 'undefined' ? { deviceId: { exact: inputDeviceId } } : true,
          video: false,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to get user media with input device id, falling back to default:', e);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      }
      streamRef.current = stream;
      setMediaStream(stream);

      // Create and configure voice provider
      const voiceProvider = createVoiceProvider(voiceProviderProfile.provider.name);
      voiceProviderRef.current = voiceProvider;

      // Start voice session
      sessionRef.current = await voiceProvider.startSession({
        token: session.ephemeralToken,
        model: session.model,
        mediaStream: stream,
        idleTimeoutMs: session.idleTimeoutMs,
        onTranscription: handleTranscription,
        onError: handleError,
        onSessionStateChange: handleSessionStateChange,
        onStopRecording: stopRecording,
      });

      setIsRecording(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to start recording:', err);
      setError((err as Error).message || 'Failed to access microphone');
      setIsRecording(false);
    }
  }, [api, getVoiceProvider, createVoiceProvider, handleTranscription, handleError, handleSessionStateChange, stopRecording]);

  const resetTranscription = useCallback(() => {
    setTranscription('');
  }, []);

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    transcription,
    error,
    resetTranscription,
    voiceAvailable,
    mediaStream,
  };
};
