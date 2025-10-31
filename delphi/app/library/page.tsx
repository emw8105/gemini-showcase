"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Library, Music, Download, Play, Trash2, Calendar } from "lucide-react";

const savedTracks = [
  {
    id: "1",
    title: "Mountain Adventure - Epic Journey",
    streamTitle: "Epic Mountain Adventure - 4K Nature Documentary",
    duration: "3:45",
    date: "2024-01-15",
    category: "Nature",
    size: "2.4 MB",
  },
  {
    id: "2",
    title: "Cyberpunk Night Drive",
    streamTitle: "Cyberpunk Cityscape - Night Driving",
    duration: "5:12",
    date: "2024-01-14",
    category: "Gaming",
    size: "3.1 MB",
  },
  {
    id: "3",
    title: "Ocean Waves Meditation",
    streamTitle: "Peaceful Ocean Waves - Meditation Sounds",
    duration: "8:30",
    date: "2024-01-13",
    category: "Nature",
    size: "4.2 MB",
  },
];

export default function LibraryPage() {
  const [tracks, setTracks] = useState(savedTracks);

  const handleDelete = (id: string) => {
    setTracks(tracks.filter((track) => track.id !== id));
  };

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
            <Library className="h-8 w-8 text-[#CBB994]" />
            <h1 className="text-5xl font-light tracking-tight text-[#2c2414] md:text-6xl">
              My Library
            </h1>
          </div>
          <p className="mx-auto max-w-2xl text-lg font-light text-[#6b5842] md:text-xl">
            Your saved music tracks generated from streams
          </p>
        </div>

        {/* Stats */}
        <div className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Card className="luxury-card">
            <CardHeader className="pb-3">
              <CardDescription className="text-sm font-light text-[#6b5842]">Total Tracks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-light text-[#2c2414]">
                {tracks.length}
              </div>
            </CardContent>
          </Card>
          <Card className="luxury-card">
            <CardHeader className="pb-3">
              <CardDescription className="text-sm font-light text-[#6b5842]">Total Duration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-light text-[#2c2414]">
                {tracks.reduce((acc, t) => {
                  const [min, sec] = t.duration.split(":").map(Number);
                  return acc + min * 60 + sec;
                }, 0) > 60
                  ? `${Math.floor(
                      tracks.reduce((acc, t) => {
                        const [min, sec] = t.duration.split(":").map(Number);
                        return acc + min * 60 + sec;
                      }, 0) / 60
                    )}:${(
                      tracks.reduce((acc, t) => {
                        const [min, sec] = t.duration.split(":").map(Number);
                        return acc + min * 60 + sec;
                      }, 0) % 60
                    )
                      .toString()
                      .padStart(2, "0")}`
                  : "0:" +
                    tracks
                      .reduce((acc, t) => {
                        const [min, sec] = t.duration.split(":").map(Number);
                        return acc + min * 60 + sec;
                      }, 0)
                      .toString()
                      .padStart(2, "0")}
              </div>
            </CardContent>
          </Card>
          <Card className="luxury-card">
            <CardHeader className="pb-3">
              <CardDescription className="text-sm font-light text-[#6b5842]">Total Size</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-light text-[#2c2414]">
                {tracks.reduce((acc, t) => {
                  return acc + parseFloat(t.size);
                }, 0).toFixed(1)} MB
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tracks List */}
        {tracks.length === 0 ? (
          <div className="luxury-card rounded-lg p-16 text-center">
            <Music className="mx-auto mb-6 h-16 w-16 text-[#CBB994]" />
            <p className="text-lg font-light text-[#2c2414]">Your library is empty.</p>
            <p className="mt-3 text-sm font-light text-[#6b5842]">
              Start generating music from streams to save tracks here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {tracks.map((track) => (
              <Card
                key={track.id}
                className="luxury-card"
              >
                <CardContent className="p-8">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="mb-3 flex items-center gap-4">
                        <Music className="h-5 w-5 text-[#CBB994]" />
                        <h3 className="text-xl font-light text-[#2c2414]">
                          {track.title}
                        </h3>
                      </div>
                      <p className="mb-4 text-sm font-light text-[#6b5842]">
                        From: {track.streamTitle}
                      </p>
                      <div className="flex flex-wrap items-center gap-4">
                        <Badge variant="secondary" className="bg-[#fafaf9] text-[#6b5842] border border-[#e7e5e4] font-light">
                          {track.category}
                        </Badge>
                        <span className="text-sm font-light text-[#6b5842]">
                          <Calendar className="mr-1.5 inline h-3.5 w-3.5" />
                          {track.date}
                        </span>
                        <span className="text-sm font-light text-[#6b5842]">{track.duration}</span>
                        <span className="text-sm font-light text-[#6b5842]">{track.size}</span>
                      </div>
                    </div>
                    <div className="ml-6 flex gap-3">
                      <Button variant="ghost" size="icon" className="text-[#6b5842] hover:text-[#CBB994] hover:bg-transparent">
                        <Play className="h-5 w-5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-[#6b5842] hover:text-[#CBB994] hover:bg-transparent">
                        <Download className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(track.id)}
                        className="text-[#a8a29e] hover:text-red-600 hover:bg-transparent"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
