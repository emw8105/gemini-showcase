"use client";

import { useState } from "react";
import { StreamCard } from "@/components/stream-card";
import { mockStreams } from "@/lib/mock-data";
import { TrendingUp } from "lucide-react";

export default function TrendingPage() {
  const trendingStreams = [...mockStreams]
    .sort((a, b) => b.viewers - a.viewers)
    .slice(0, 8);

  return (
    <div className="relative min-h-screen">
      {/* Golden Waves Background */}
      <div className="golden-waves-container">
        <div className="golden-wave golden-wave-1"></div>
        <div className="golden-wave golden-wave-2"></div>
        <div className="golden-wave golden-wave-3"></div>
        <div className="golden-wave-thin golden-wave-thin-1"></div>
        <div className="golden-wave-thin golden-wave-thin-2"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-8 pt-24 pb-16 sm:px-12 lg:px-16">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="mb-6 flex items-center justify-center gap-4">
            <TrendingUp className="h-8 w-8 text-[#CBB994]" />
            <h1 className="text-5xl font-light tracking-tight text-[#2c2414] md:text-6xl">
              Trending Streams
            </h1>
          </div>
          <p className="mx-auto max-w-2xl text-lg font-light text-[#6b5842] md:text-xl">
            Most popular streams generating music right now
          </p>
        </div>

        {/* Trending Streams Grid */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {trendingStreams.map((stream, index) => (
            <div key={stream.id} className="relative">
              {index < 3 && (
                <div className="absolute -top-3 -left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#CBB994] text-white font-light text-sm shadow-lg">
                  {index + 1}
                </div>
              )}
              <StreamCard stream={stream} />
            </div>
          ))}
        </div>

        {trendingStreams.length === 0 && (
          <div className="luxury-card rounded-lg p-16 text-center">
            <p className="text-lg font-light text-[#2c2414]">No trending streams at the moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
