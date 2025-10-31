import React from "react";

interface LyreIconProps extends React.SVGProps<SVGSVGElement> {}

export function LyreIcon({ className, ...props }: LyreIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Left arm of the lyre */}
      <path d="M7 2C7 2 5 4 5 9C5 14 7 18 7 18" />
      {/* Right arm of the lyre */}
      <path d="M17 2C17 2 19 4 19 9C19 14 17 18 17 18" />
      {/* Top crossbar */}
      <path d="M7 2L17 2" />
      {/* Bottom crossbar */}
      <path d="M7 18L17 18" />
      {/* Base/stand */}
      <path d="M9 18L9 20" />
      <path d="M15 18L15 20" />
      <path d="M9 20L15 20" />
      {/* Strings - more prominent */}
      <path d="M7 4L17 4" strokeWidth="1.5" />
      <path d="M7 6L17 6" strokeWidth="1.5" />
      <path d="M7 8L17 8" strokeWidth="1.5" />
      <path d="M7 10L17 10" strokeWidth="1.5" />
      <path d="M7 12L17 12" strokeWidth="1.5" />
      <path d="M7 14L17 14" strokeWidth="1.5" />
      {/* Decorative elements at top */}
      <circle cx="7" cy="2" r="1.5" fill="currentColor" />
      <circle cx="17" cy="2" r="1.5" fill="currentColor" />
    </svg>
  );
}

