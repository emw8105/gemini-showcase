"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Music2, Home, Library, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/discover", label: "Discover", icon: Home },
    { href: "/trending", label: "Trending", icon: TrendingUp },
    { href: "/library", label: "Library", icon: Library },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-purple-800/50 bg-gradient-to-br from-purple-950/95 via-purple-900/95 to-indigo-950/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-white hover:opacity-80 transition-opacity">
            <Music2 className="h-6 w-6 text-purple-400" />
            <span className="text-xl font-bold">Lyria Showcase</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || 
                (link.href === "/discover" && pathname.startsWith("/stream"));
              return (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={cn(
                      "gap-2 text-white",
                      isActive 
                        ? "bg-purple-600 hover:bg-purple-700" 
                        : "hover:bg-white/10"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{link.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

