"use client";

import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { type Stream } from "@/lib/mock-data";
import { extractYouTubeVideoId, getYouTubeThumbnail } from "@/lib/youtube-utils";

interface StreamCardProps {
  stream: Stream;
  featured?: boolean;
}

export function StreamCard({ stream, featured = false }: StreamCardProps) {
  // Get YouTube thumbnail if video ID can be extracted
  const videoId = extractYouTubeVideoId(stream.url);
  const thumbnailUrl = videoId ? getYouTubeThumbnail(videoId, 'maxres') : stream.thumbnail;

  return (
    <Link href={`/stream/${stream.id}`}>
      <Card className="group relative overflow-hidden border-purple-700/30 bg-white/95 transition-all duration-300 hover:scale-[1.02] hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/20 dark:bg-gray-900/95">
        {/* Thumbnail */}
        <div className="relative aspect-video w-full overflow-hidden bg-black">
          <Image
            src={thumbnailUrl}
            alt={stream.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-110"
            unoptimized
          />
          
          {/* Live Badge */}
          {stream.isLive && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-red-600 text-white text-xs px-2 py-0.5">
                <span className="relative mr-1 flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
                LIVE
              </Badge>
            </div>
          )}

          {/* Featured Badge */}
          {featured && (
            <div className="absolute top-2 right-2">
              <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs px-2 py-0.5">
                Featured
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <CardContent className="p-3">
          <h3 className="mb-2 line-clamp-2 text-sm font-semibold text-gray-900 dark:text-white">
            {stream.title}
          </h3>
          
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>{stream.author}</span>
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span>{stream.viewers.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
