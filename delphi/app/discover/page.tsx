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

    // Filter by category
    if (selectedCategory !== "All") {
      filtered = filtered.filter((stream) => stream.category === selectedCategory);
    }

    // Filter by search query
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

  // Featured streams (first 3)
  const featuredStreams = mockStreams.slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative mx-auto max-w-2xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search streams by title, author, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-14 pl-12 text-lg bg-white/10 border-purple-700/50 text-white placeholder:text-gray-400 focus:bg-white/20 backdrop-blur-sm"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5 text-purple-300" />
            <h2 className="text-lg font-semibold text-white">Categories</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`cursor-pointer px-4 py-2 text-sm font-medium transition-all ${
                  selectedCategory === category
                    ? "bg-purple-600 text-white hover:bg-purple-700"
                    : "bg-white/10 text-purple-200 hover:bg-white/20 border border-purple-700/50"
                }`}
              >
                {category}
              </Badge>
            ))}
          </div>
        </div>

        {/* Featured Streams */}
        {selectedCategory === "All" && searchQuery === "" && (
          <div className="mb-12">
            <h2 className="mb-6 text-2xl font-bold text-white">Featured Streams</h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredStreams.map((stream) => (
                <StreamCard key={stream.id} stream={stream} featured />
              ))}
            </div>
          </div>
        )}

        {/* All Streams */}
        <div>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">
              {searchQuery ? `Search Results (${filteredStreams.length})` : "All Streams"}
            </h2>
            <span className="text-purple-300">{filteredStreams.length} streams</span>
          </div>

          {filteredStreams.length === 0 ? (
            <div className="rounded-lg bg-white/5 p-12 text-center backdrop-blur-sm">
              <p className="text-lg text-gray-400">No streams found matching your criteria.</p>
              <p className="mt-2 text-sm text-gray-500">Try adjusting your filters or search query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredStreams.map((stream) => (
                <StreamCard key={stream.id} stream={stream} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

