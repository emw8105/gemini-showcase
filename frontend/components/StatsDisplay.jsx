'use client';

export default function StatsDisplay({ chunkCount, totalBytes }) {
  return (
    <div className="grid grid-cols-2 gap-4 mt-6">
      <div className="bg-white/5 backdrop-blur-xl px-6 py-6 rounded-2xl text-center border border-white/10 transition-all duration-300 hover:bg-white/8 hover:-translate-y-0.5">
        <div className="text-xs text-white/60 mb-2 font-medium tracking-widest uppercase">
          Audio Chunks
        </div>
        <div className="text-3xl font-bold bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent tracking-tight">
          {chunkCount}
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-xl px-6 py-6 rounded-2xl text-center border border-white/10 transition-all duration-300 hover:bg-white/8 hover:-translate-y-0.5">
        <div className="text-xs text-white/60 mb-2 font-medium tracking-widest uppercase">
          Data Received
        </div>
        <div className="text-3xl font-bold bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent tracking-tight">
          {(totalBytes / 1024).toFixed(1)} KB
        </div>
      </div>
    </div>
  );
}