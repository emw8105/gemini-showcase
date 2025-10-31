"use client";

import { useState, useMemo } from "react";
import { StreamCard } from "@/components/stream-card";
import { mockStreams, categories, type Stream } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter } from "lucide-react";

export default function DiscoverPage() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStreams = useMemo(() => {
    let filtered = mockStreams;

    if (selectedCategory !== "All") {
      filtered = filtered.filter((stream) => stream.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (stream) =>
          stream.title.toLowerCase().includes(query) ||
          stream.author.toLowerCase().includes(query) ||
          stream.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [selectedCategory, searchQuery]);

  const featuredStreams = mockStreams.slice(0, 3);
  const featuredStreamIds = new Set(featuredStreams.map(s => s.id));

  const displayStreams = useMemo(() => {
    let streams = filteredStreams;
    
    if (selectedCategory === "All" && !searchQuery) {
      streams = streams.filter(stream => !featuredStreamIds.has(stream.id));
    }
    
    return streams;
  }, [filteredStreams, selectedCategory, searchQuery, featuredStreamIds]);

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
        {/* Search Bar */}
        <div className="mb-16 mt-12">
          <div className="relative mx-auto max-w-2xl">
            <Search className="absolute left-6 top-1/2 h-5 w-5 -translate-y-1/2 text-[#a8a29e] z-10" />
            <Input
              type="text"
              placeholder="Search streams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-16 pl-14 pr-6 text-base font-light rounded-xl bg-white/20 backdrop-blur-2xl border border-white/30 text-[#2c2414] placeholder:text-[#a8a29e]/70 shadow-lg shadow-black/30 focus:bg-white/30 focus:border-white/50 focus:ring-2 focus:ring-white/20 focus:outline-none"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-16">
          <div className="mb-6 flex items-center gap-3">
            <Filter className="h-5 w-5 text-[#CBB994]" />
            <h2 className="text-lg font-light text-[#2c2414] tracking-wide">Categories</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <Badge
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`cursor-pointer px-5 py-2.5 text-sm font-light tracking-wide transition-all duration-300 ${
                  selectedCategory === category
                    ? "bg-[#CBB994] text-white hover:bg-[#B4A582] shadow-sm border-0"
                    : "glass text-[#6b5842] hover:bg-white/20 relative z-10"
                }`}
              >
                {category}
              </Badge>
            ))}
          </div>
        </div>

        {/* Featured Streams */}
        {selectedCategory === "All" && searchQuery === "" && (
          <div className="mb-20">
            <h2 className="mb-10 text-3xl font-light tracking-tight text-[#2c2414]">Featured Streams</h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {featuredStreams.map((stream) => (
                <StreamCard key={stream.id} stream={stream} featured />
              ))}
            </div>
          </div>
        )}

        {/* All Streams */}
        <div>
          <div className="mb-10 flex items-center justify-between">
            <h2 className="text-3xl font-light tracking-tight text-[#2c2414]">
              {searchQuery ? `Search Results (${displayStreams.length})` : "All Streams"}
            </h2>
            <span className="text-sm font-light text-[#6b5842]">{displayStreams.length} streams</span>
          </div>

          {displayStreams.length === 0 ? (
            <div className="luxury-card rounded-lg p-16 text-center">
              <p className="text-lg font-light text-[#2c2414]">No streams found matching your criteria.</p>
              <p className="mt-3 text-sm font-light text-[#6b5842]">Try adjusting your filters or search query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayStreams.map((stream) => (
                <StreamCard key={stream.id} stream={stream} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
