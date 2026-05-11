// Status pill — a small rounded label with optional colored dot.
// Used across landing, dashboard, and sidebar to indicate state.

import * as React from "react";

export type StatusPillTone = "emerald" | "amber" | "rose" | "slate" | "indigo" | "plum";

const TONES: Record<
  StatusPillTone,
  { bg: string; fg: string; dot: string }
> = {
  emerald: {
    bg: "var(--emerald-50)",
    fg: "var(--emerald-600)",
    dot: "var(--emerald-500)",
  },
  amber: {
    bg: "var(--amber-50)",
    fg: "#B45309",
    dot: "var(--amber-500)",
  },
  rose: {
    bg: "var(--rose-100)",
    fg: "#9F1239",
    dot: "var(--rose-500)",
  },
  slate: {
    bg: "var(--slate-100)",
    fg: "var(--slate-700)",
    dot: "var(--slate-500)",
  },
  indigo: {
    bg: "var(--indigo-50)",
    fg: "var(--indigo-600)",
    dot: "var(--indigo-500)",
  },
  plum: {
    bg: "var(--sage-plum-50)",
    fg: "var(--sage-plum)",
    dot: "var(--sage-plum)",
  },
};

export interface StatusPillProps {
  tone?: StatusPillTone;
  children: React.ReactNode;
  showDot?: boolean;
}

export function StatusPill({
  tone = "emerald",
  children,
  showDot = true,
}: StatusPillProps) {
  const t = TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-[3px] rounded-full"
      style={{ background: t.bg, color: t.fg }}
    >
      {showDot && (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: t.dot }}
        />
      )}
      {children}
    </span>
  );
}

// Maps a backend `audit_log.action` value to a UI tone + label.
// Lives here because it's a constant *for* StatusPill.
export const TONE_FOR_ACTION: Record<
  string,
  { tone: StatusPillTone; label: string }
> = {
  detected: { tone: "amber", label: "Detected" },
  removed: { tone: "emerald", label: "Removed" },
  moved_to_waiting_room: { tone: "indigo", label: "Waiting room" },
  remove_failed: { tone: "rose", label: "Failed" },
  dry_run: { tone: "slate", label: "Dry run" },
};
