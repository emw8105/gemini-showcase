'use client';

import { useEffect, useState, useRef } from 'react';

export default function LogDisplay({ logs }) {
  const [mounted, setMounted] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (type) => {
    switch (type) {
      case 'success':
        return 'text-green-500/90 font-semibold';
      case 'error':
        return 'text-rose-500/90 font-semibold';
      case 'audio':
        return 'text-purple-500/90';
      default:
        return 'text-cyan-500/90';
    }
  };

  return (
    <div
      ref={logRef}
      className="bg-black/40 border border-white/10 rounded-2xl p-5 max-h-60 overflow-y-auto font-mono text-xs mb-6 backdrop-blur-xl [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
      {logs.map((log, index) => (
        <div
          key={index}
          className={`mb-1.5 px-2.5 py-1.5 rounded-lg animate-slide-in leading-relaxed ${getLogColor(log.type)}`}>
          [{mounted ? log.time.toLocaleTimeString() : '--:--:--'}] {log.message}
        </div>
      ))}
    </div>
  );
}