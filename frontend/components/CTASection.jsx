'use client';

export default function CTASection() {
  return (
    <section className="relative z-10 text-center py-25 px-10 md:px-40 bg-gradient-to-b from-transparent to-cyan-500/5">
      <div className="max-w-7xl mx-auto">
        <h2 className="font-cinzel text-4xl md:text-5xl font-bold mb-5 tracking-wide">
          Help Shape the Future
        </h2>

        <p className="text-xl text-white/70 mb-10 max-w-2xl mx-auto">
          Built to explore Lyria's capabilities and identify opportunities for improvement. We're excited to share our learnings and hear how the Gemini team can enhance Lyria and the developer experience.
        </p>

        <div className="inline-block px-8 py-4 bg-white/5 backdrop-blur-xl border border-white/20 rounded-full text-base text-white/90 tracking-widest font-medium">
          Built for Google Gemini Team
        </div>
      </div>
    </section>
  );
}