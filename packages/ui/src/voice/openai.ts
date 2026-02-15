import { VoiceProvider, VoiceSession, VoiceSessionConfig, VoiceSessionState } from './types';

export class OpenAIVoiceProvider implements VoiceProvider {
  name = 'openai';

  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private mediaStream: MediaStream | null = null;
  private config: VoiceSessionConfig | null = null;
  private idleTimeout: NodeJS.Timeout | null = null;

  async startSession(config: VoiceSessionConfig): Promise<VoiceSession> {
    this.config = config;
    this.setState(VoiceSessionState.CONNECTING);

    try {
      await this.connectWebRTC();
      this.setState(VoiceSessionState.ACTIVE);
      return { isActive: true, provider: this };
    } catch (error) {
      this.setState(VoiceSessionState.ERROR);
      this.config?.onError(error as Error);
      throw error;
    }
  }

  private async connectWebRTC(): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not set');
    }

    // Create a peer connection
    this.peerConnection = new RTCPeerConnection();

    // Add local audio track for microphone input in the browser
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    this.peerConnection.addTrack(this.mediaStream.getTracks()[0]);

    // Set up data channel for sending and receiving events
    this.dataChannel = this.peerConnection.createDataChannel('oai-events');

    // Start the session using the Session Description Protocol (SDP)
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    const baseUrl = 'https://api.openai.com/v1/realtime/calls';
    const sdpResponse = await fetch(`${baseUrl}`, {
      method: 'POST',
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        'Content-Type': 'application/sdp',
      },
    });

    if (!sdpResponse.ok) {
      throw new Error(`Failed to get SDP answer: ${sdpResponse.statusText}`);
    }

    const answer: RTCSessionDescriptionInit = {
      type: 'answer' as RTCSdpType,
      sdp: await sdpResponse.text(),
    };

    await this.peerConnection.setRemoteDescription(answer);

    this.dataChannel.addEventListener('open', (e) => {
      // eslint-disable-next-line no-console
      console.log('Data channel open', e);
    });

    // Listen for server events
    this.dataChannel.addEventListener('message', (e) => {
      try {
        const event = JSON.parse(e.data);

        if (event.type === 'conversation.item.input_audio_transcription.delta') {
          this.config?.onTranscription(event.delta);
        } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
          this.config?.onTranscription(' ');
        } else if (event.type === 'input_audio_buffer.speech_started') {
          if (this.idleTimeout) {
            clearTimeout(this.idleTimeout);
          }
        } else if (event.type === 'input_audio_buffer.speech_stopped') {
          if (this.idleTimeout) {
            clearTimeout(this.idleTimeout);
          }

          this.idleTimeout = setTimeout(() => {
            this.config?.onStopRecording?.();
          }, this.config?.idleTimeoutMs ?? 5000);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error parsing data channel message:', error);
      }
    });

    this.dataChannel.addEventListener('error', (e) => {
      // eslint-disable-next-line no-console
      console.error('Data channel error:', e);
      this.setState(VoiceSessionState.ERROR);
      this.config?.onError(new Error(`Data channel error: ${e}`));
    });

    this.peerConnection.addEventListener('connectionstatechange', () => {
      if (this.peerConnection?.connectionState === 'failed' || this.peerConnection?.connectionState === 'disconnected') {
        this.setState(VoiceSessionState.ERROR);
        this.config?.onError(new Error(`Peer connection ${this.peerConnection?.connectionState}`));
      }
    });
  }

  async stopSession(): Promise<void> {
    this.setState(VoiceSessionState.CLOSED);

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
  }

  private setState(newState: VoiceSessionState): void {
    this.config?.onSessionStateChange?.(newState);
  }
}

// Factory function
export const createOpenAIVoiceProvider = (): VoiceProvider => {
  return new OpenAIVoiceProvider();
};
