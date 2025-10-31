"use client";

import { useState } from "react";
import { StreamCard } from "@/components/stream-card";
import { mockStreams } from "@/lib/mock-data";
import { TrendingUp, Flame } from "lucide-react";

export default function TrendingPage() {
  // Sort by viewers (trending = most viewers)
  const trendingStreams = [...mockStreams]
    .sort((a, b) => b.viewers - a.viewers)
    .slice(0, 8);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <Flame className="h-10 w-10 text-orange-500" />
            <TrendingUp className="h-8 w-8 text-purple-400" />
            <h1 className="text-4xl font-bold text-white md:text-5xl">
              Trending Streams
            </h1>
          </div>
          <p className="mx-auto max-w-2xl text-lg text-purple-200 md:text-xl">
            Most popular streams generating music right now
          </p>
        </div>

        {/* Trending Streams Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {trendingStreams.map((stream, index) => (
            <div key={stream.id} className="relative">
              {index < 3 && (
                <div className="absolute -top-2 -left-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-white font-bold shadow-lg">
                  {index + 1}
                </div>
              )}
              <StreamCard stream={stream} />
            </div>
          ))}
        </div>

        {trendingStreams.length === 0 && (
          <div className="rounded-lg bg-white/5 p-12 text-center backdrop-blur-sm">
            <p className="text-lg text-gray-400">No trending streams at the moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}

