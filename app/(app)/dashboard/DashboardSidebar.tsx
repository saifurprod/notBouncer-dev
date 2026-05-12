"use client";

// DashboardSidebar — the persistent navigation chrome of the dashboard.
//
// Two responsive modes:
//   Desktop (lg+): a 72px-wide icon-only column on the left, sticky to
//     the viewport. Items highlight as you scroll past their sections
//     (scrollspy via IntersectionObserver).
//   Mobile (<lg): hidden by default. A hamburger button in the topbar
//     (rendered by us at the start of the sidebar) opens a left-side
//     drawer overlay with full text labels.
//
// Scrollspy: we observe each section element by ID. When a section is the
// "most intersecting" one in the viewport, its sidebar item is marked
// active. Smooth-scrolling on click is handled by native anchor behavior.

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";

interface NavItem {
  /** DOM id of the section this item links to. */
  id: string;
  /** Visible label (used in tooltips and mobile drawer). */
  label: string;
  /** Lucide-style outline icon as an inline SVG component. */
  icon: React.ComponentType<{ size?: number }>;
  /** Visually de-emphasized — used for "coming soon" items. */
  muted?: boolean;
  /** Pinned to the bottom of the sidebar (e.g. Rules / Settings). */
  bottom?: boolean;
}

export interface DashboardSidebarProps {
  /** User display name for the mobile drawer's user chip. */
  userName: string;
  /** User email for the mobile drawer's user chip. */
  userEmail?: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: "overview", label: "Overview", icon: IconHome },
  { id: "connected-hosts", label: "Connected hosts", icon: IconUsers },
  { id: "insight", label: "Insight", icon: IconZap },
  { id: "system-intelligence", label: "System intelligence", icon: IconActivity },
  { id: "activity-log", label: "Activity log", icon: IconList },
  { id: "rules", label: "Rules · soon", icon: IconShield, muted: true, bottom: true },
];

export function DashboardSidebar({ userName, userEmail }: DashboardSidebarProps) {
  const [activeId, setActiveId] = useState<string>(NAV_ITEMS[0].id);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Scrollspy: observe all section elements and mark the most-visible one
  // as active. Threshold tuned so a section becomes "active" once roughly
  // its top edge crosses the topbar zone.
  useEffect(() => {
    const sections = NAV_ITEMS.map((n) =>
      document.getElementById(n.id),
    ).filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry with the largest intersection ratio that's
        // currently intersecting. This handles the case where two
        // sections are partially visible (small ones at top + middle).
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        // Top margin pulls the trigger line down past the sticky topbar
        // (~60px tall). Bottom margin shrinks the "active zone" so a
        // section becomes active when its body is in the middle of view.
        rootMargin: "-80px 0px -50% 0px",
        threshold: [0, 0.1, 0.25, 0.5],
      },
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Body scroll lock while drawer is open (mobile).
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (drawerOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [drawerOpen]);

  // ESC closes the drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const topItems = NAV_ITEMS.filter((n) => !n.bottom);
  const bottomItems = NAV_ITEMS.filter((n) => n.bottom);

  return (
    <>
      {/* Mobile hamburger button — fixed top-left, visible only when the
          sidebar is hidden (below lg breakpoint). It piggybacks the topbar
          area visually; positioned absolute over the topbar's left padding. */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-30 inline-flex items-center justify-center rounded-lg"
        style={{
          width: 36,
          height: 36,
          background: "rgba(255, 255, 255, 0.6)",
          border: "1px solid rgba(168, 162, 158, 0.25)",
          color: "var(--ink-700)",
        }}
        aria-label="Open navigation"
      >
        <IconMenu size={18} />
      </button>

      {/* DESKTOP SIDEBAR — sticky icon-only column */}
      <aside
        className="hidden lg:flex flex-col items-center gap-1 border-r sticky"
        style={{
          width: 72,
          top: 60,
          height: "calc(100vh - 60px)",
          padding: "18px 12px",
          borderColor: "rgba(168, 162, 158, 0.18)",
          background: "rgba(242, 240, 234, 0.6)",
        }}
      >
        {topItems.map((item) => (
          <DesktopNavItem
            key={item.id}
            item={item}
            active={activeId === item.id}
          />
        ))}
        <div className="mt-auto flex flex-col gap-1 items-center">
          {bottomItems.map((item) => (
            <DesktopNavItem
              key={item.id}
              item={item}
              active={activeId === item.id}
            />
          ))}
        </div>
      </aside>

      {/* MOBILE DRAWER */}
      {drawerOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40"
            style={{ background: "rgba(0, 0, 0, 0.45)" }}
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="lg:hidden fixed top-0 left-0 bottom-0 z-50 flex flex-col"
            style={{
              width: "78%",
              maxWidth: 320,
              background: "rgba(242, 240, 234, 0.98)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              boxShadow: "4px 0 16px rgba(0, 0, 0, 0.15)",
              padding: 14,
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <div
              className="flex items-center justify-between border-b pb-3 mb-3"
              style={{ borderColor: "rgba(168, 162, 158, 0.18)" }}
            >
              <div className="flex items-center gap-2 px-2">
                <DrawerBrandMark />
                <span className="text-[13px] font-medium">NoteBouncer</span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex items-center justify-center rounded-md"
                style={{
                  width: 28,
                  height: 28,
                  background: "transparent",
                  border: 0,
                  color: "var(--ink-600)",
                }}
                aria-label="Close navigation"
              >
                <IconX size={14} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto">
              {topItems.map((item) => (
                <DrawerNavItem
                  key={item.id}
                  item={item}
                  active={activeId === item.id}
                  onSelect={() => setDrawerOpen(false)}
                />
              ))}
              <div className="mt-3 pt-3 border-t" style={{ borderColor: "rgba(168, 162, 158, 0.18)" }}>
                {bottomItems.map((item) => (
                  <DrawerNavItem
                    key={item.id}
                    item={item}
                    active={activeId === item.id}
                    onSelect={() => setDrawerOpen(false)}
                  />
                ))}
              </div>
            </nav>

            <div
              className="flex items-center gap-2.5 mt-3 p-2.5 rounded-xl"
              style={{ background: "rgba(255, 255, 255, 0.5)" }}
            >
              <Avatar name={userName} size={30} />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-ink-900 truncate">
                  {userName}
                </div>
                {userEmail && (
                  <div className="text-[10px] text-ink-600 truncate">
                    {userEmail}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

function DesktopNavItem({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <a
      href={`#${item.id}`}
      className="relative group inline-flex items-center justify-center rounded-[11px] transition-colors"
      style={{
        width: 44,
        height: 44,
        background: active ? "var(--sage-plum-50)" : "transparent",
        color: active ? "var(--sage-plum)" : "var(--ink-700)",
        opacity: item.muted && !active ? 0.55 : 1,
      }}
      aria-label={item.label}
      aria-current={active ? "true" : undefined}
    >
      <Icon size={18} />
      <span
        className="pointer-events-none absolute left-[54px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity z-30"
        style={{
          background: "var(--ink-900)",
          color: "white",
        }}
        role="tooltip"
      >
        {item.label}
      </span>
    </a>
  );
}

function DrawerNavItem({
  item,
  active,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = item.icon;
  return (
    <a
      href={`#${item.id}`}
      onClick={onSelect}
      className="flex items-center gap-3 rounded-[9px] mb-0.5 transition-colors"
      style={{
        padding: "10px 12px",
        background: active ? "var(--sage-plum-50)" : "transparent",
        color: active ? "var(--sage-plum)" : "var(--ink-700)",
        fontWeight: active ? 500 : 400,
        opacity: item.muted && !active ? 0.55 : 1,
        textDecoration: "none",
        fontSize: 13,
      }}
      aria-current={active ? "true" : undefined}
    >
      <span style={{ width: 16, display: "inline-flex", color: "currentColor" }}>
        <Icon size={14} />
      </span>
      <span>{item.label}</span>
    </a>
  );
}

function DrawerBrandMark() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M32 4 L56 12 L56 32 C56 46 46 56 32 60 C18 56 8 46 8 32 L8 12 Z"
        fill="rgb(128,71,128)"
      />
      <rect x="20" y="26" width="24" height="18" rx="5" fill="white" />
      <circle cx="27" cy="35" r="2.2" fill="rgb(128,71,128)" />
      <circle cx="37" cy="35" r="2.2" fill="rgb(128,71,128)" />
      <line x1="32" y1="26" x2="42" y2="16" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="42" cy="16" r="2" fill="white" />
      <line x1="10" y1="52" x2="54" y2="14" stroke="white" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

// ---------- Inline outline icons (Lucide-style, 2px stroke) ----------

function IconHome({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconUsers({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconZap({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function IconActivity({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function IconList({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="3.5" cy="6" r="0.8" fill="currentColor" />
      <circle cx="3.5" cy="12" r="0.8" fill="currentColor" />
      <circle cx="3.5" cy="18" r="0.8" fill="currentColor" />
    </svg>
  );
}

function IconShield({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L4 6v6c0 5 3.5 9.7 8 11 4.5-1.3 8-6 8-11V6l-8-4z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconMenu({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconX({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
