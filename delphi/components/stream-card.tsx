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
  const videoId = extractYouTubeVideoId(stream.url);
  const thumbnailUrl = videoId ? getYouTubeThumbnail(videoId, 'maxres') : stream.thumbnail;

  return (
    <Link href={`/stream/${stream.id}`}>
      <Card className="group luxury-card h-full overflow-hidden transition-all duration-500">
        {/* Thumbnail */}
        <div className="relative aspect-video w-full overflow-hidden bg-[#f5f5f4]">
          <Image
            src={thumbnailUrl}
            alt={stream.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            unoptimized
          />
          
          {/* Live Badge */}
          {stream.isLive && (
            <div className="absolute top-4 left-4">
              <Badge className="bg-red-600 text-white text-xs font-light px-3 py-1 border-0">
                <span className="relative mr-1.5 flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
                LIVE
              </Badge>
            </div>
          )}

          {/* Featured Badge */}
          {featured && (
            <div className="absolute top-4 right-4">
              <Badge className="bg-[#CBB994] text-white text-xs font-light px-3 py-1 border-0 shadow-md">
                Featured
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <CardContent className="p-6">
          <h3 className="mb-3 line-clamp-2 text-base font-light leading-relaxed text-[#2c2414]">
            {stream.title}
          </h3>
          
          <div className="flex items-center justify-between text-sm font-light text-[#6b5842]">
            <span>{stream.author}</span>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span>{stream.viewers.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
