import { useEffect, useRef } from 'react';

type Props = {
  stream: MediaStream | null;
  barCount?: number;
  width?: number;
};

export const AudioAnalyzer = ({ stream, barCount = 16, width = 48 }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const audioContextRef = useRef<AudioContext | undefined>(undefined);

  useEffect(() => {
    if (!stream || !canvasRef.current) {
      return;
    }

    const audioContext = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    audioContextRef.current = audioContext;

    const analyser = audioContext.createAnalyser();
    // fftSize must be a power of 2 between 32 and 32768
    // The number of frequency bins is fftSize / 2
    // So we need fftSize to be approximately barCount * 2
    const desiredFftSize = barCount * 2;
    // Find the nearest power of 2
    const fftSize = Math.pow(2, Math.ceil(Math.log2(desiredFftSize)));
    // Clamp to valid range
    analyser.fftSize = Math.max(32, Math.min(32768, fftSize));

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) {
      return;
    }

    const draw = () => {
      if (!canvasRef.current) {
        return;
      }
      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const barWidth = (width / bufferLength) * 0.8;
      const gap = (width / bufferLength) * 0.2;
      let x = 0;

      // Try to match the theme color
      // We can use the computed style of the canvas element itself or body
      const style = getComputedStyle(document.body);
      canvasCtx.fillStyle = style.getPropertyValue('--color-accent-secondary').trim();

      for (let i = 0; i < bufferLength; i++) {
        // Scale the height
        const value = dataArray[i];
        const percent = value / 255;
        const barHeight = percent * height;

        // Draw bar
        canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight);

        x += barWidth + gap;
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContext.state !== 'closed') {
        void audioContext.close();
      }
    };
  }, [stream, barCount]);

  if (!stream) {
    return null;
  }

  return <canvas ref={canvasRef} className="h-6 opacity-80" style={{ width }} width={width} height={24} />;
};
