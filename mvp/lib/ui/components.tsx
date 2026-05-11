// Shared UI primitives ported from /tmp/ui_research/design.
// Used across landing, dashboard, and sidebar.

import * as React from "react";
import { Icon } from "./icons";

type Tone = "emerald" | "amber" | "rose" | "slate" | "indigo" | "plum";

const TONES: Record<
  Tone,
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

export function StatusPill({
  tone = "emerald",
  children,
  showDot = true,
}: {
  tone?: Tone;
  children: React.ReactNode;
  showDot?: boolean;
}) {
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

export function SectionLabel({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="text-xs font-medium uppercase tracking-[0.11em] text-ink-500">
        {children}
      </div>
      {action}
    </div>
  );
}

export function BrandMark({
  size = 36,
  iconSize = 18,
}: {
  size?: number;
  iconSize?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: "var(--sage-plum)",
        boxShadow: "var(--shadow-glow-indigo)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name="shield-check" size={iconSize} color="#fff" />
    </div>
  );
}

export function Avatar({
  name,
  size = 32,
}: {
  name: string;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const fontSize = Math.round(size * 0.4);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        background: "linear-gradient(135deg, #d1c5e7 0%, #b9a3d9 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

export const TONE_FOR_ACTION: Record<
  string,
  { tone: Tone; label: string }
> = {
  detected: { tone: "amber", label: "Detected" },
  removed: { tone: "emerald", label: "Removed" },
  moved_to_waiting_room: { tone: "indigo", label: "Waiting room" },
  remove_failed: { tone: "rose", label: "Failed" },
  dry_run: { tone: "slate", label: "Dry run" },
};
