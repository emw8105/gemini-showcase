"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";

export default function LandingPage() {
  useEffect(() => {
    // Prevent scrolling on the landing page
    document.body.style.overflow = "hidden";
    
    // Cleanup: restore scrolling when component unmounts
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  return (
    <div className="relative flex h-screen items-center justify-center bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-950 p-4 text-center overflow-hidden">
      <div className="z-10 max-w-4xl">
        <div className="mb-6 flex items-center justify-center gap-4">
          <Sparkles className="h-12 w-12 text-purple-400 md:h-16 md:w-16" />
          <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
            Discover Live Streams
          </h1>
        </div>
        <p className="mb-10 text-xl text-purple-200 sm:text-2xl md:text-3xl">
          Browse through curated streams and generate music in real-time
        </p>
        <Link href="/discover">
          <Button
            size="lg"
            className="group h-14 px-8 text-lg font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all hover:scale-105"
          >
            Start Browsing
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </Link>
      </div>
      
      {/* Background animation blobs */}
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute -left-20 -top-20 h-64 w-64 animate-pulse rounded-full bg-purple-500 blur-3xl filter md:h-96 md:w-96"></div>
        <div className="absolute -bottom-20 -right-20 h-72 w-72 animate-pulse rounded-full bg-indigo-500 blur-3xl filter md:h-[32rem] md:w-[32rem] animation-delay-2000"></div>
      </div>
    </div>
  );
}
