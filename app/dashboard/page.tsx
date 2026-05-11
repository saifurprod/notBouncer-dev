import { prisma } from "@/lib/db";
import { Icon } from "@/lib/ui/icons";
import {
  StatusPill,
  SectionLabel,
  BrandMark,
  Avatar,
} from "@/lib/ui/components";
import { ActivityTable, ActivityRow } from "./activity-table";
import { generateInsight } from "@/lib/insights";
import { dedupIncidents, countByAction } from "@/lib/dedup";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { installed?: string };
}) {
  // Pull a wide window of raw audit rows so the dedup can group correctly.
  // We then derive stats and the activity list from the deduped incidents.
  const [users, allLogs, last48hLogs] = await Promise.all([
    prisma.user.findMany({
      where: { deauthorizedAt: null },
      orderBy: { installedAt: "desc" },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000, // wide window for dedup + insights
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
    }),
  ]);

  // Dedup all rows into one incident per (meeting, bot)
  const allIncidents = dedupIncidents(allLogs);

  // Stats — totals are over all incidents we have; "this week" is over the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weekIncidents = allIncidents.filter(
    (i) => i.earliestAt >= sevenDaysAgo
  );
  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  );
  const monthIncidents = allIncidents.filter(
    (i) => i.earliestAt >= monthStart
  );

  const total = countByAction(allIncidents);
  const week = countByAction(weekIncidents);

  // Last-48h is a separate count (raw rows are fine here since it's just
  // "did anything happen at all in the last 2 days")
  const last48hCount = last48hLogs.length;

  // AI insight runs on raw rows so its vendor counting works
  const insight = generateInsight(
    allLogs.map((l) => ({
      participantName: l.participantName,
      matchReason: l.matchReason,
      action: l.action,
      latencyMs: l.latencyMs,
      source: l.source,
      errorMessage: l.errorMessage,
      createdAt: l.createdAt,
    }))
  );

  const heroStat = `${monthIncidents.length} bot${monthIncidents.length === 1 ? "" : "s"} stopped this month.`;
  const heroSub =
    last48hCount === 0
      ? "No notetaker has crashed your meetings unannounced in the last 48 hours."
      : `${monthIncidents.length} bot incident${monthIncidents.length === 1 ? "" : "s"} caught this month across your meetings.`;

  const primaryHost = users[0];
  const hostFirstName = primaryHost?.displayName?.split(" ")[0] ?? "Host";

  // Convert deduped incidents to activity rows for the client component.
  // Keep raw ISO timestamp; client component formats it in the user's tz.
  const rows: ActivityRow[] = allIncidents.slice(0, 100).map((i) => ({
    id: i.id,
    whenISO: i.earliestAt.toISOString(),
    name: i.participantName,
    email: i.participantEmail,
    reason: i.matchReason,
    action: i.action,
    latency: i.latencyMs,
    error: i.errorMessage,
  }));

  return (
    <main className="min-h-screen" style={{ background: "var(--canvas-lavender)" }}>
      <div className="max-w-[1280px] mx-auto px-14 pt-12 pb-24">
        <NBHeader
          breadcrumb="Activity"
          stat={heroStat}
          statSub={heroSub}
          hostName={hostFirstName}
          fullHostName={primaryHost?.displayName ?? "—"}
        />

        {searchParams.installed === "1" && (
          <div
            className="mt-8 rounded-2xl px-5 py-4 flex items-center gap-3"
            style={{
              background: "var(--emerald-50)",
              border: "1px solid var(--emerald-100)",
              color: "var(--emerald-600)",
            }}
          >
            <Icon name="check" size={18} />
            <div style={{ fontSize: 13 }}>
              Installed successfully. Open NoteBouncer from Zoom's Apps panel
              during your next meeting to enable auto-removal.
            </div>
          </div>
        )}

        <div className="flex flex-col gap-10 mt-10">
          {insight && <InsightCard insight={insight} />}

          <div>
            <SectionLabel>System intelligence</SectionLabel>
            <StatsCard total={total} week={week} />
          </div>

          {users.length > 0 && (
            <div>
              <SectionLabel>Operations</SectionLabel>
              <HostsCard users={users} />
            </div>
          )}

          <div>
            <SectionLabel>Activity log</SectionLabel>
            <ActivityTable rows={rows} />
          </div>
        </div>
      </div>
    </main>
  );
}

function NBHeader({
  breadcrumb,
  stat,
  statSub,
  hostName,
  fullHostName,
}: {
  breadcrumb: string;
  stat: string;
  statSub: string;
  hostName: string;
  fullHostName: string;
}) {
  return (
    <div>
      <div className="mb-6" style={{ fontSize: 12, color: "var(--ink-500)" }}>
        <span style={{ color: "rgb(107,101,127)" }}>Home</span>
        <span style={{ color: "rgb(154,149,186)", margin: "0 8px" }}>›</span>
        <span style={{ color: "#000", fontWeight: 500 }}>{breadcrumb}</span>
      </div>

      <div className="flex items-start justify-between gap-8 flex-wrap">
        <div className="flex items-start gap-5">
          <div style={{ marginTop: 22 }}>
            <BrandMark size={48} iconSize={22} />
          </div>
          <div>
            <div
              className="mb-2"
              style={{
                fontSize: 16,
                fontWeight: 500,
                letterSpacing: "0.044em",
                color: "rgb(100,96,94)",
              }}
            >
              {hostName}'s Bouncer Control
            </div>
            <h1
              className="m-0 font-light"
              style={{
                fontSize: 48,
                lineHeight: 0.85,
                letterSpacing: "-0.02em",
                color: "var(--ink-900)",
                maxWidth: 720,
              }}
            >
              {stat}
            </h1>
            <div
              className="mt-3"
              style={{
                fontSize: 14,
                color: "var(--ink-600)",
                maxWidth: 540,
              }}
            >
              {statSub}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-5">
          <div
            style={{
              color: "var(--sage-plum)",
              fontWeight: 600,
              fontSize: 18,
              letterSpacing: "-0.02em",
            }}
          >
            notebouncer
          </div>
          <div className="flex items-center gap-3" style={{ color: "rgb(132,133,134)" }}>
            <Avatar name={fullHostName} size={32} />
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-700)" }}>
              {fullHostName}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightCard({
  insight,
}: {
  insight: { headline: string; body: string };
}) {
  return (
    <div
      className="glass-card flex items-start gap-[18px]"
      style={{ padding: 24 }}
    >
      <div
        className="rounded-xl flex-shrink-0"
        style={{
          width: 40,
          height: 40,
          background: "var(--indigo-50)",
          color: "var(--indigo-600)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="zap" size={20} color="var(--indigo-600)" />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="font-semibold mb-1"
          style={{ fontSize: 14, color: "var(--ink-900)" }}
        >
          {insight.headline}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--ink-600)",
            lineHeight: 1.6,
          }}
        >
          {insight.body}
        </div>
      </div>
    </div>
  );
}

const STAT_TONES = {
  slate: { bg: "var(--slate-100)", fg: "var(--slate-700)" },
  emerald: { bg: "var(--emerald-50)", fg: "var(--emerald-600)" },
  indigo: { bg: "var(--indigo-50)", fg: "var(--indigo-600)" },
  rose: { bg: "var(--rose-100)", fg: "#9F1239" },
};

function StatsCard({
  total,
  week,
}: {
  total: { total: number; removed: number; waiting: number; failed: number; detectedOnly: number };
  week: { total: number; removed: number; waiting: number; failed: number; detectedOnly: number };
}) {
  const stats = [
    {
      label: "Detected",
      tone: "slate" as const,
      value: total.total,
      delta: `${signed(week.total)} this week`,
      icon: "bot" as const,
    },
    {
      label: "Removed",
      tone: "emerald" as const,
      value: total.removed,
      delta: `${signed(week.removed)} this week`,
      icon: "trash" as const,
    },
    {
      label: "Waiting",
      tone: "indigo" as const,
      value: total.waiting,
      delta: `${signed(week.waiting)} this week`,
      icon: "door-open" as const,
    },
    {
      label: "Failed",
      tone: "rose" as const,
      value: total.failed,
      delta: `${signed(week.failed)} this week`,
      icon: "x" as const,
    },
  ];

  return (
    <div className="glass-card" style={{ padding: 28 }}>
      <div className="flex justify-between items-start mb-1.5">
        <div>
          <div
            className="font-bold"
            style={{ fontSize: 18, color: "var(--ink-900)" }}
          >
            Bot Lifecycle Intelligence
          </div>
          <div
            className="mt-1"
            style={{ fontSize: 13, color: "var(--ink-600)" }}
          >
            Detection + removal activity across all your hosts · last 7 days
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
        {stats.map((s) => {
          const p = STAT_TONES[s.tone];
          return (
            <div
              key={s.label}
              className="rounded-xl flex flex-col justify-between"
              style={{
                padding: 20,
                background: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.6)",
                boxShadow: "var(--shadow-xs)",
                minHeight: 140,
              }}
            >
              <div className="flex justify-between items-center">
                <span
                  className="rounded-full"
                  style={{
                    background: p.bg,
                    color: p.fg,
                    fontSize: 11,
                    fontWeight: 500,
                    padding: "3px 10px",
                  }}
                >
                  {s.label}
                </span>
                <Icon name={s.icon} size={14} color={p.fg} stroke={2.2} />
              </div>
              <div>
                <div
                  className="font-light"
                  style={{
                    fontSize: 42,
                    color: "var(--ink-900)",
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {s.value}
                </div>
                <div
                  className="mt-1.5"
                  style={{ fontSize: 11, color: "var(--ink-500)" }}
                >
                  {s.delta}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function signed(n: number): string {
  if (n === 0) return "0";
  if (n > 0) return `+${n}`;
  return String(n);
}

function HostsCard({
  users,
}: {
  users: Array<{
    displayName: string | null;
    email: string;
    installedAt: Date;
  }>;
}) {
  return (
    <div className="glass-card" style={{ padding: 28 }}>
      <div className="flex justify-between items-center mb-1">
        <div>
          <div
            className="font-bold"
            style={{ fontSize: 18, color: "var(--ink-900)" }}
          >
            Connected hosts
          </div>
          <div
            className="mt-1"
            style={{ fontSize: 13, color: "var(--ink-600)" }}
          >
            Zoom accounts authorised to NoteBouncer
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-5">
        {users.map((u) => (
          <div
            key={u.email}
            className="white-card flex items-center gap-3.5"
            style={{ padding: "14px 16px" }}
          >
            <Avatar name={u.displayName ?? u.email} size={36} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="font-medium truncate"
                  style={{ fontSize: 14, color: "var(--ink-900)" }}
                >
                  {u.displayName ?? "—"}
                </span>
                <StatusPill tone="emerald">Active</StatusPill>
              </div>
              <div
                className="font-mono mt-0.5 truncate"
                style={{ fontSize: 12, color: "var(--ink-500)" }}
              >
                {u.email}
              </div>
            </div>
            <div
              className="text-right"
              style={{ fontSize: 11, color: "var(--ink-500)" }}
            >
              <div>since {u.installedAt.toISOString().slice(0, 10)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
