'use client';

import FeatureCard from './FeatureCard';

export default function WhatWeBuilt() {
  const features = [
    {
      icon: '🎬',
      title: 'Video Integration',
      description: 'Seamlessly connects Lyria to YouTube videos, enabling dynamic soundtrack generation that responds to visual content in real-time'
    },
    {
      icon: '⚡',
      title: 'Smart Optimization',
      description: 'Minimizes API calls by detecting meaningful prompt changes, ensuring efficient resource usage without sacrificing musical quality'
    },
    {
      icon: '🎵',
      title: 'Seamless Streaming',
      description: 'Buffers and streams PCM audio chunks for uninterrupted playback, creating a smooth listening experience without gaps or latency'
    }
  ];

  return (
    <section className="relative z-10 py-25 px-10 md:px-40">
      <div className="max-w-7xl mx-auto">
        <h2 className="font-cinzel text-4xl md:text-5xl font-bold text-center mb-5 tracking-wide">
          What We Built
        </h2>
        
        <p className="text-center text-xl text-white/60 mb-16 max-w-3xl mx-auto leading-relaxed">
          Delphi makes Gemini Lyria practical for real-world video applications by solving key challenges in streaming and optimization
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {features.map((feature, index) => (
            <FeatureCard key={index} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}