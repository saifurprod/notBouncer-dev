import Link from "next/link";
import { prisma } from "@/lib/db";
import { Icon } from "@/lib/ui/icons";
import { StatusPill, BrandMark } from "@/lib/ui/components";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const error = searchParams.error;

  // Dashboard link is only meaningful for users who have installed.
  // For MVP without auth, we approximate "logged-in" by checking
  // whether any host has installed at all.
  const installedCount = await prisma.user.count({
    where: { deauthorizedAt: null },
  });
  const showDashboardLink = installedCount > 0;

  return (
    <main className="min-h-screen" style={{ background: "var(--canvas-lavender)" }}>
      <div className="max-w-[1200px] mx-auto px-12 pt-14 pb-24">
        <TopBar showDashboard={showDashboardLink} />

        <section className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-16 items-center mt-2">
          <Hero error={error} />
          <SidebarPreview />
        </section>

        <HowItWorks />
        <DetectionShowcase />
        <Footer />
      </div>
    </main>
  );
}

function TopBar({ showDashboard }: { showDashboard: boolean }) {
  return (
    <div className="flex justify-between items-center mb-22" style={{ marginBottom: 88 }}>
      <div className="flex items-center gap-3">
        <BrandMark size={36} iconSize={18} />
        <span
          className="text-base font-semibold tracking-tight"
          style={{ color: "var(--sage-plum)" }}
        >
          notebouncer
        </span>
      </div>
      <nav className="flex gap-7 text-[13px]" style={{ color: "var(--ink-700)" }}>
        <a href="#how-it-works" className="hover:opacity-80">How it works</a>
        <a href="#what-we-detect" className="hover:opacity-80">What we detect</a>
        {showDashboard ? (
          <Link href="/dashboard" className="hover:opacity-80">Dashboard</Link>
        ) : (
          <span className="opacity-40 cursor-not-allowed" title="Install NoteBouncer to access the dashboard">Dashboard</span>
        )}
        <span className="opacity-40 cursor-not-allowed" title="Coming soon">Docs</span>
      </nav>
    </div>
  );
}

function Hero({ error }: { error?: string }) {
  return (
    <div>
      <div
        className="text-sm font-medium uppercase mb-4"
        style={{ letterSpacing: "0.18em", color: "var(--sage-plum)" }}
      >
        v0.2 · private beta
      </div>
      <h1
        className="m-0 font-light"
        style={{
          fontSize: 80,
          lineHeight: 0.92,
          letterSpacing: "-0.03em",
          color: "var(--ink-900)",
        }}
      >
        Keep notetaker bots
        <br />
        out of your{" "}
        <em
          className="italic"
          style={{ color: "var(--sage-plum)" }}
        >
          meetings
        </em>
        .
      </h1>
      <p
        className="mt-7 max-w-[520px]"
        style={{
          fontSize: 17,
          lineHeight: 1.6,
          color: "var(--ink-700)",
        }}
      >
        NoteBouncer watches your Zoom calls for Otter, Fireflies, Fathom,
        Read, tl;dv and friends — and removes them the instant they join.
        The host stays in control.
      </p>

      {error && (
        <div
          className="mt-6 rounded-xl px-4 py-3 text-sm"
          style={{
            background: "var(--rose-100)",
            color: "#9F1239",
            border: "1px solid #fecdd3",
          }}
        >
          Install failed: <code className="font-mono">{error}</code>
        </div>
      )}

      <div className="mt-9 flex gap-3 items-center flex-wrap">
        <Link
          href="/install"
          prefetch={false}
          className="inline-flex items-center gap-2.5 px-[22px] py-[14px] rounded-full text-sm font-medium text-white transition"
          style={{
            background: "var(--sage-plum)",
            boxShadow: "var(--shadow-glow-indigo)",
          }}
        >
          Install on Zoom
          <Icon name="arrow" size={16} color="#fff" />
        </Link>
        <a
          href="#how-it-works"
          className="inline-flex items-center gap-2 px-5 py-[13px] rounded-full bg-white text-sm font-medium transition"
          style={{
            color: "var(--ink-800)",
            border: "1px solid var(--gray-200)",
          }}
        >
          View the dashboard demo
        </a>
      </div>

      <div
        className="mt-7 flex gap-[18px] items-center text-xs flex-wrap"
        style={{ color: "var(--ink-500)" }}
      >
        <span className="inline-flex items-center gap-1.5">
          <Icon name="check" size={12} color="var(--emerald-600)" />
          Sub-500ms removal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="check" size={12} color="var(--emerald-600)" />
          Works from Zoom's Apps panel
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="check" size={12} color="var(--emerald-600)" />
          Host-only, no recording access
        </span>
      </div>
    </div>
  );
}

function SidebarPreview() {
  const bots = [
    {
      name: "Otter.ai Notetaker",
      reason: "name:otter",
      state: "pending",
    },
    {
      name: "Fireflies.ai",
      reason: "email:fireflies",
      state: "pending",
    },
    {
      name: "Fathom Notetaker",
      reason: "name:fathom",
      state: "removed",
    },
  ];
  return (
    <div className="glass-card p-6 relative">
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="tiny-label">Sidebar preview</div>
          <div
            className="font-bold mt-1"
            style={{ fontSize: 15, color: "var(--ink-900)" }}
          >
            Q2 Founder Sync
          </div>
        </div>
        <StatusPill tone="emerald">Watching</StatusPill>
      </div>
      <div className="tiny-label mb-2.5">Detected bots · 2 pending</div>
      <div className="flex flex-col gap-2.5">
        {bots.map((b) => (
          <div
            key={b.name}
            className="white-card p-3 flex justify-between items-center"
          >
            <div>
              <div
                className="font-medium"
                style={{ fontSize: 13, color: "var(--ink-900)" }}
              >
                {b.name}
              </div>
              <div
                className="font-mono mt-[2px]"
                style={{ fontSize: 11, color: "var(--ink-500)" }}
              >
                {b.reason}
              </div>
            </div>
            {b.state === "removed" ? (
              <span
                className="font-mono"
                style={{ fontSize: 11, color: "var(--emerald-600)" }}
              >
                ✓ removed
              </span>
            ) : (
              <button
                className="text-white border-none cursor-pointer rounded-full"
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: "5px 12px",
                  background: "var(--ink-900)",
                }}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        className="w-full mt-3.5 text-white border-none cursor-pointer rounded-xl"
        style={{
          padding: "11px 14px",
          background: "var(--sage-plum)",
          boxShadow: "var(--shadow-glow-indigo)",
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        Remove all bots (2)
      </button>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: "shield-check" as const,
      title: "Install once",
      body: "OAuth into Zoom. Takes 30 seconds. Bots are logged passively for every meeting.",
      tone: { bg: "var(--sage-plum-50)", fg: "var(--sage-plum)" },
    },
    {
      icon: "video" as const,
      title: "Open the sidebar",
      body: "During any meeting, open NoteBouncer from Zoom's Apps panel. It quietly watches every participant join.",
      tone: { bg: "var(--indigo-50)", fg: "var(--indigo-600)" },
    },
    {
      icon: "zap" as const,
      title: "Bots removed in <500ms",
      body: "When a notetaker joins, NoteBouncer kicks it or sends it to the waiting room. Real people are never touched.",
      tone: { bg: "var(--emerald-50)", fg: "var(--emerald-600)" },
    },
  ];
  return (
    <div className="mt-24" id="how-it-works">
      <div className="section-label mb-4">How it works</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px]">
        {steps.map((s, i) => (
          <div key={s.title} className="glass-card p-7">
            <div
              className="rounded-xl mb-5"
              style={{
                width: 44,
                height: 44,
                background: s.tone.bg,
                color: s.tone.fg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={s.icon} size={22} color={s.tone.fg} />
            </div>
            <div
              className="font-mono mb-1.5"
              style={{ fontSize: 11, color: "var(--ink-500)" }}
            >
              0{i + 1}
            </div>
            <div
              className="mb-2 font-semibold"
              style={{
                fontSize: 18,
                color: "var(--ink-900)",
                letterSpacing: "-0.01em",
              }}
            >
              {s.title}
            </div>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                color: "var(--ink-600)",
              }}
            >
              {s.body}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetectionShowcase() {
  const bots = [
    "Otter.ai",
    "Fireflies.ai",
    "Fathom",
    "tl;dv",
    "Read AI",
    "Granola",
    "Krisp",
    "Fellow.app",
    "Avoma",
    "Sembly",
    "Spinach",
    "MeetGeek",
  ];
  return (
    <div className="mt-16" id="what-we-detect">
      <div className="section-label mb-4">What we detect</div>
      <div className="glass-card p-8">
        <div className="flex flex-wrap gap-2.5">
          {bots.map((b) => (
            <span
              key={b}
              className="inline-flex items-center gap-2 rounded-full bg-white"
              style={{
                padding: "8px 14px",
                border: "1px solid var(--gray-200)",
                fontSize: 13,
                color: "var(--ink-800)",
              }}
            >
              <Icon name="bot" size={13} color="var(--sage-plum)" />
              {b}
            </span>
          ))}
          <span
            className="inline-flex items-center rounded-full"
            style={{
              padding: "8px 14px",
              background: "var(--sage-plum-50)",
              color: "var(--sage-plum)",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            + regex rules you define
          </span>
        </div>
        <div
          className="mt-5"
          style={{
            fontSize: 13,
            color: "var(--ink-600)",
            lineHeight: 1.6,
          }}
        >
          Detection runs on display name and email — guests are scrutinised
          harder than signed-in users. Add custom rules in{" "}
          <span className="font-mono">lib/detection.ts</span>.
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div
      className="mt-24 pt-8 flex justify-between items-center flex-wrap gap-4"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.6)",
        color: "var(--ink-500)",
        fontSize: 12,
      }}
    >
      <span>© 2026 NoteBouncer · v0.2</span>
      <div className="flex gap-6">
        <span>Privacy</span>
        <span>Security</span>
        <span>Status</span>
        <span>support@notebouncer.app</span>
      </div>
    </div>
  );
}
