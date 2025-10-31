"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function LandingPage() {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden">
      {/* Golden Waves Background */}
      <div className="golden-waves-container">
        <div className="golden-wave golden-wave-1"></div>
        <div className="golden-wave golden-wave-2"></div>
        <div className="golden-wave golden-wave-3"></div>
        <div className="golden-wave golden-wave-4"></div>
        <div className="golden-wave golden-wave-5"></div>
        <div className="golden-wave-thin golden-wave-thin-1"></div>
        <div className="golden-wave-thin golden-wave-thin-2"></div>
        <div className="golden-wave-thin golden-wave-thin-3"></div>
      </div>
      
      <div className="relative z-10 max-w-5xl px-8 text-center fade-in-up">
        <h1 className="mb-8 text-6xl font-light tracking-tight text-[#2c2414] sm:text-7xl lg:text-8xl">
          Discover Live Streams
        </h1>
        <p className="mb-16 text-xl font-light text-[#6b5842] sm:text-2xl md:text-3xl">
          Browse through curated streams and generate music in real-time
        </p>
        <Link href="/discover">
          <Button
            size="lg"
            className="group h-16 px-12 text-base font-light tracking-wide bg-[#CBB994] text-white hover:bg-[#B4A582] transition-all duration-500 hover:scale-[1.02] border-0 shadow-lg shadow-[#CBB994]/20 hover:shadow-[#CBB994]/30"
          >
            <span className="relative">Start Browsing</span>
            <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1 relative" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
