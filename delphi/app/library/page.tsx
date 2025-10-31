"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Library, Music, Download, Play, Trash2, Calendar } from "lucide-react";

// Mock saved tracks
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
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <Library className="h-8 w-8 text-purple-400" />
            <h1 className="text-4xl font-bold text-white md:text-5xl">
              My Library
            </h1>
          </div>
          <p className="mx-auto max-w-2xl text-lg text-purple-200 md:text-xl">
            Your saved music tracks generated from streams
          </p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border-purple-700/50 bg-white/95 dark:bg-gray-900/95">
            <CardHeader className="pb-2">
              <CardDescription>Total Tracks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {tracks.length}
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-700/50 bg-white/95 dark:bg-gray-900/95">
            <CardHeader className="pb-2">
              <CardDescription>Total Duration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
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
          <Card className="border-purple-700/50 bg-white/95 dark:bg-gray-900/95">
            <CardHeader className="pb-2">
              <CardDescription>Total Size</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {tracks.reduce((acc, t) => {
                  return acc + parseFloat(t.size);
                }, 0).toFixed(1)} MB
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tracks List */}
        {tracks.length === 0 ? (
          <div className="rounded-lg bg-white/5 p-12 text-center backdrop-blur-sm">
            <Music className="mx-auto mb-4 h-16 w-16 text-gray-500" />
            <p className="text-lg text-gray-400">Your library is empty.</p>
            <p className="mt-2 text-sm text-gray-500">
              Start generating music from streams to save tracks here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {tracks.map((track) => (
              <Card
                key={track.id}
                className="border-purple-700/50 bg-white/95 transition-all hover:border-purple-500/50 hover:shadow-lg dark:bg-gray-900/95"
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <Music className="h-5 w-5 text-purple-500" />
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                          {track.title}
                        </h3>
                      </div>
                      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                        From: {track.streamTitle}
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          {track.category}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          <Calendar className="mr-1 inline h-3 w-3" />
                          {track.date}
                        </span>
                        <span className="text-sm text-gray-500">{track.duration}</span>
                        <span className="text-sm text-gray-500">{track.size}</span>
                      </div>
                    </div>
                    <div className="ml-4 flex gap-2">
                      <Button variant="secondary" size="icon" className="border-gray-300 dark:border-gray-700">
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button variant="secondary" size="icon" className="border-gray-300 dark:border-gray-700">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(track.id)}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
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

