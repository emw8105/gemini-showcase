'use client';
import { useEffect, useRef } from 'react';

export default function BackgroundEffects() {
  const particlesRef = useRef(null);

  useEffect(() => {
    if (!particlesRef.current) return;

    const particles = [];
    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div');
      particle.className = 'absolute w-0.5 h-0.5 bg-cyan-500/60 rounded-full';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 20 + 's';
      particle.style.animationDuration = (15 + Math.random() * 10) + 's';
      particle.style.animation = `float ${15 + Math.random() * 10}s infinite`;
      particlesRef.current.appendChild(particle);
      particles.push(particle);
    }

    return () => {
      particles.forEach(p => p.remove());
    };
  }, []);

  return (
    <>
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) translateX(50px);
            opacity: 0;
          }
        }

        @keyframes gradientPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }

        .bg-gradient {
          animation: gradientPulse 8s ease-in-out infinite;
        }

        .particle {
          animation: float 20s infinite;
        }
      `}</style>

      <div 
        className="fixed top-0 left-0 w-full h-full z-0 pointer-events-none bg-gradient"
        style={{
          background: `radial-gradient(circle at 20% 20%, rgba(6, 182, 212, 0.15), transparent 50%), 
                       radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.15), transparent 50%), 
                       radial-gradient(circle at 50% 50%, rgba(236, 72, 153, 0.1), transparent 70%)`
        }}
      />
      <div ref={particlesRef} className="fixed top-0 left-0 w-full h-full z-0 pointer-events-none" />
    </>
  );
}