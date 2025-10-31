'use client';

import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

const AudioVisualizer = forwardRef((props, ref) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }, []);

  useImperativeHandle(ref, () => ({
    visualize: (audioBuffer) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const data = audioBuffer.getChannelData(0);
      const step = Math.ceil(data.length / canvas.width);
      const amp = canvas.height / 2;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#06b6d4');
      gradient.addColorStop(0.5, '#a855f7');
      gradient.addColorStop(1, '#ec4899');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      for (let i = 0; i < canvas.width; i++) {
        const slice = data.slice(i * step, (i + 1) * step);
        const min = Math.min(...slice);
        const max = Math.max(...slice);
        ctx.moveTo(i, (1 + min) * amp);
        ctx.lineTo(i, (1 + max) * amp);
      }

      ctx.stroke();
    }
  }));

  return (
    <div className="bg-black/40 border border-white/10 rounded-[20px] h-[140px] mb-6 relative overflow-hidden backdrop-blur-xl">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
});

AudioVisualizer.displayName = 'AudioVisualizer';

export default AudioVisualizer;