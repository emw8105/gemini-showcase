'use client';

export default function FeatureCard({ icon, title, description }) {
  return (
    <div className="relative bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-3xl p-10 transition-all duration-[400ms] ease-out overflow-hidden group hover:bg-white/[0.06] hover:border-cyan-500/30 hover:-translate-y-2">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-[400ms] ease-out origin-left"></div>

      <span className="block text-5xl mb-5">
        {icon}
      </span>

      <h3 className="text-2xl font-semibold mb-4 text-white">
        {title}
      </h3>

      <p className="text-base text-white/70 leading-relaxed">
        {description}
      </p>
    </div>
  );
}