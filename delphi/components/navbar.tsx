"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LyreIcon } from "@/components/lyre-icon";

export function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/discover", label: "Discover", icon: Home },
    { href: "/trending", label: "Trending", icon: TrendingUp },
    { href: "/library", label: "Library", icon: Library },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 w-full px-4 sm:px-6 lg:px-8 pt-4 pb-2">
      <div className="mx-auto max-w-7xl">
        <div className="glass flex h-16 items-center justify-between px-6 sm:px-8 lg:px-10 relative z-10">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 text-[#2c2414] hover:text-[#CBB994] transition-colors duration-300 group relative z-10 font-medium">
            <LyreIcon className="h-7 w-7 text-[#CBB994] transition-transform group-hover:scale-110 drop-shadow-md" />
            <span className="text-xl font-medium tracking-wide drop-shadow-sm">Apollo</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-2 relative z-10">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || 
                (link.href === "/discover" && pathname.startsWith("/stream"));
              return (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={cn(
                      "gap-2 text-sm font-light tracking-wide transition-all duration-300",
                      isActive 
                        ? "bg-[#CBB994] text-white hover:bg-[#B4A582] shadow-lg shadow-[#CBB994]/30" 
                        : "text-[#2c2414] bg-white/40 hover:bg-white/60 hover:text-[#CBB994] backdrop-blur-sm border border-white/50 shadow-sm"
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
