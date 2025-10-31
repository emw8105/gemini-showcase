"use client";

import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock } from "lucide-react";
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
              <Badge className="bg-red-600 text-white text-[10px] px-1.5 py-0.5">
                <span className="relative mr-1 flex h-1 w-1">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-1 w-1 rounded-full bg-red-500" />
                </span>
                LIVE
              </Badge>
            </div>
          )}

          {/* Featured Badge */}
          {featured && (
            <div className="absolute top-2 right-2">
              <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] px-2 py-0.5">
                Featured
              </Badge>
            </div>
          )}

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/20" />
        </div>

        {/* Content */}
        <CardContent className="p-3">
          <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-gray-900 dark:text-white">
            {stream.title}
          </h3>
          
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <span className="font-medium">{stream.author}</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{stream.viewers.toLocaleString()}</span>
              </div>
              {!stream.isLive && stream.duration && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{stream.duration}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          {stream.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {stream.tags.slice(0, 2).map((tag, idx) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
