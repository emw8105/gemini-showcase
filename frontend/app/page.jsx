'use client';

import Hero from '../components/Hero';
import WhatWeBuilt from '../components/WhatWeBuilt';
import LiveDemo from '../components/LiveDemo';
import CTASection from '../components/CTASection';
import BackgroundEffects from '../components/BackgroundEffects';

export default function DelphiPage() {
  return (
    <div className="relative min-h-screen bg-black text-white overflow-x-hidden">
      <BackgroundEffects />
      
      <Hero />
      <WhatWeBuilt />
      <LiveDemo />
      <CTASection />
    </div>
  );
}