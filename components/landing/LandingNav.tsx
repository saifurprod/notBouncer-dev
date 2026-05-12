// LandingNav — top navigation strip on the marketing landing page.
//
// Layout: container (1136px max, 32px gutters).
// Left:  NoteBouncer shield mark + wordmark.
// Right: "by" prefix + Sapience AI wordmark (the parent brand).
//
// The shield mark is inline SVG built from the brand sheet geometry
// (shield silhouette + bot face + diagonal "deny" stripe). When the
// official mark SVG is exported from the brand sheet source file,
// swap this inline SVG for an Image-loaded asset from /public/brand/.

import { SapienceLogo } from "./SapienceLogo";

export function LandingNav() {
  return (
    <header className="border-b border-stone-100/80">
      <div className="mx-auto flex max-w-[1136px] items-center justify-between px-6 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <NoteBouncerMark size={28} />
          <span className="text-[15px] font-medium tracking-tight text-ink-900">
            NoteBouncer
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-2.5">
          <span className="text-[11px] tracking-wide text-ink-500">by</span>
          <SapienceLogo height={30} />
        </div>
      </div>
    </header>
  );
}

/**
 * The NoteBouncer shield-bot-deny mark, inline SVG per the brand sheet.
 * Plum-filled shield, white bot face cutout (two eye dots + antenna),
 * single diagonal stripe across the whole mark.
 */
function NoteBouncerMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="NoteBouncer"
      role="img"
    >
      {/* Shield silhouette */}
      <path
        d="M32 4 L56 12 L56 32 C56 46 46 56 32 60 C18 56 8 46 8 32 L8 12 Z"
        fill="rgb(128,71,128)"
      />
      {/* Bot face cutout (rounded rect) */}
      <rect
        x="20"
        y="26"
        width="24"
        height="18"
        rx="5"
        fill="white"
      />
      {/* Two eye dots */}
      <circle cx="27" cy="35" r="2.2" fill="rgb(128,71,128)" />
      <circle cx="37" cy="35" r="2.2" fill="rgb(128,71,128)" />
      {/* Antenna: line + dot */}
      <line
        x1="32"
        y1="26"
        x2="42"
        y2="16"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="42" cy="16" r="2" fill="white" />
      {/* Diagonal deny stripe — full mark width */}
      <line
        x1="10"
        y1="52"
        x2="54"
        y2="14"
        stroke="white"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
