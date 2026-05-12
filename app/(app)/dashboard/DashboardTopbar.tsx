// DashboardTopbar — the sticky top strip of the dashboard shell.
//
// Layout:
//   Left:  NoteBouncer mark + wordmark
//   Right: "by sapience ai" + vertical divider + user chip
//
// This is a server component — purely presentational. The user chip
// shows an avatar + name + chevron but the dropdown menu (logout etc)
// is left as a future enhancement.

import { SapienceLogo } from "@/components/landing/SapienceLogo";
import { Avatar } from "@/components/ui/Avatar";

export interface DashboardTopbarProps {
  /** Display name of the signed-in user (for the user chip). */
  userName: string;
}

export function DashboardTopbar({ userName }: DashboardTopbarProps) {
  return (
    <header
      className="sticky top-0 z-20 border-b"
      style={{
        height: 60,
        borderColor: "rgba(168, 162, 158, 0.18)",
        background: "rgba(242, 240, 234, 0.92)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <div className="flex items-center justify-between h-full pl-14 pr-4 sm:pr-6 lg:pl-6">
        <div className="flex items-center gap-2.5">
          <NoteBouncerMark size={26} />
          <span className="text-[15px] font-medium tracking-tight text-ink-900">
            NoteBouncer
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-3.5">
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[11px] text-ink-600 tracking-wide">by</span>
            <SapienceLogo height={26} />
          </div>
          <div
            className="hidden sm:block"
            style={{
              width: 1,
              height: 20,
              background: "rgba(168, 162, 158, 0.3)",
            }}
            aria-hidden="true"
          />
          <button
            type="button"
            className="flex items-center gap-2 rounded-full border pr-2.5 pl-1.5 py-1 transition-colors hover:bg-white/70"
            style={{
              borderColor: "rgba(168, 162, 158, 0.25)",
              background: "rgba(255, 255, 255, 0.55)",
            }}
            aria-label="Account menu"
          >
            <Avatar name={userName} size={26} />
            <span className="hidden sm:inline text-[12px] text-ink-900">
              {userName}
            </span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--ink-600)" }}
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

/**
 * Inline-SVG NoteBouncer shield mark. Built from the brand sheet geometry:
 * plum shield silhouette, white bot face with two eye dots, antenna stem,
 * and a diagonal "deny" stripe across the full mark.
 *
 * Replace with `<Image src="/brand/notebouncer-mark.svg" />` once the
 * official mark is exported from the brand sheet source.
 */
function NoteBouncerMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="NoteBouncer"
      role="img"
    >
      <path
        d="M32 4 L56 12 L56 32 C56 46 46 56 32 60 C18 56 8 46 8 32 L8 12 Z"
        fill="rgb(128,71,128)"
      />
      <rect x="20" y="26" width="24" height="18" rx="5" fill="white" />
      <circle cx="27" cy="35" r="2.2" fill="rgb(128,71,128)" />
      <circle cx="37" cy="35" r="2.2" fill="rgb(128,71,128)" />
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
