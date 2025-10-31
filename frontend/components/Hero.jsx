'use client';

export default function Hero() {
  return (
    <>
      <style jsx>{`
        @keyframes glowPulse {
          0%, 100% { 
            filter: brightness(1) drop-shadow(0 0 20px rgba(6, 182, 212, 0.6)); 
          }
          50% { 
            filter: brightness(1.2) drop-shadow(0 0 40px rgba(168, 85, 247, 0.8)); 
          }
        }

        @keyframes bounce {
          0%, 100% { 
            transform: translateX(-50%) translateY(0); 
          }
          50% { 
            transform: translateX(-50%) translateY(10px); 
          }
        }

        .glow-pulse {
          animation: glowPulse 3s ease-in-out infinite;
        }

        .bounce-slow {
          animation: bounce 2s infinite;
        }
      `}</style>

      <div className="relative z-10 min-h-screen flex flex-col justify-center items-center text-center px-10 md:px-40 py-24 md:py-0">
        <div className="max-w-7xl mx-auto">
          <h1 
            className="font-cinzel text-5xl md:text-[80px] font-black bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-5 tracking-[0.5em] uppercase glow-pulse"
            style={{
              letterSpacing: '8px'
            }}
          >
            DELPHI
          </h1>
          
          <div 
            className="font-cinzel text-lg text-white/50 mb-12 uppercase"
            style={{
              letterSpacing: '6px'
            }}
          >
            Oracle of Apollo
          </div>
          
          <h2 className="text-4xl md:text-7xl font-bold mb-8 leading-tight max-w-4xl" style={{ letterSpacing: '-2px' }}>
            Real-Time Soundtrack Generation
          </h2>
          
          <p className="text-lg md:text-2xl text-white/70 mb-12 max-w-3xl mx-auto leading-relaxed font-light">
            Bringing Gemini Lyria to life for video content with intelligent optimization and seamless streaming
          </p>
          
          <div className="flex flex-wrap gap-5 justify-center mb-16">
            <div className="px-7 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full text-sm font-medium text-white/90 tracking-wide transition-all duration-300 hover:bg-cyan-500/15 hover:border-cyan-500/40 hover:-translate-y-0.5 cursor-default"
              style={{ letterSpacing: '0.5px' }}
            >
              🎵 Powered by Gemini Lyria
            </div>
            <div className="px-7 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full text-sm font-medium text-white/90 tracking-wide transition-all duration-300 hover:bg-cyan-500/15 hover:border-cyan-500/40 hover:-translate-y-0.5 cursor-default"
              style={{ letterSpacing: '0.5px' }}
            >
              ⚡ Real-Time Streaming
            </div>
            <div className="px-7 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full text-sm font-medium text-white/90 tracking-wide transition-all duration-300 hover:bg-cyan-500/15 hover:border-cyan-500/40 hover:-translate-y-0.5 cursor-default"
              style={{ letterSpacing: '0.5px' }}
            >
              🎯 Smart API Optimization
            </div>
          </div>
        </div>
        
        <div className="absolute bottom-10 left-1/2 text-sm text-white/50 bounce-slow">
          ↓ Scroll to explore
        </div>
      </div>
    </>
  );
}