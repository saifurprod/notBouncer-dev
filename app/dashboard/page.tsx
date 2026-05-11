import { prisma } from "@/lib/db";
import { Icon } from "@/lib/ui/icons";
import {
  StatusPill,
  SectionLabel,
  BrandMark,
  Avatar,
} from "@/lib/ui/components";
import { ActivityCard, ActivityRow } from "./activity-table";
import { generateInsight } from "@/lib/insights";
import {
  dedupIncidents,
  countByAction,
  groupByMeeting,
  type MeetingSummary,
} from "@/lib/dedup";
import { COPY } from "@/lib/copy";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { installed?: string };
}) {
  const [users, allLogs, last48hLogs] = await Promise.all([
    prisma.user.findMany({
      where: { deauthorizedAt: null },
      orderBy: { installedAt: "desc" },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
    }),
  ]);

  const allIncidents = dedupIncidents(allLogs);
  const meetingSummaries = groupByMeeting(allIncidents);

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
  const last48hCount = last48hLogs.length;

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

  const heroNum = monthIncidents.length;
  const heroStat = `${heroNum} ${
    heroNum === 1 ? COPY.dashHeroSuffix : COPY.dashHeroSuffixPlural
  }`;
  const heroSub =
    last48hCount === 0
      ? COPY.dashHeroQuietSub
      : `${heroNum} bot incident${heroNum === 1 ? "" : "s"} caught this month.`;

  const primaryHost = users[0];
  const hostFirstName = primaryHost?.displayName?.split(" ")[0] ?? "Host";

  // Convert deduped incidents to rows for the activity card
  const rows: ActivityRow[] = allIncidents.slice(0, 200).map((i) => ({
    id: i.id,
    meetingId: i.meetingId,
    whenISO: i.earliestAt.toISOString(),
    name: i.participantName,
    email: i.participantEmail,
    reason: i.matchReason,
    action: i.action,
    latency: i.latencyMs,
    error: i.errorMessage,
  }));

  // Serializable meeting summary for the client component
  const meetingsForClient = meetingSummaries.slice(0, 100).map((m) => ({
    meetingId: m.meetingId,
    earliestISO: m.earliestAt.toISOString(),
    latestISO: m.latestAt.toISOString(),
    counts: m.counts,
    incidents: m.incidents.map((i) => ({
      id: i.id,
      whenISO: i.earliestAt.toISOString(),
      name: i.participantName,
      reason: i.matchReason,
      action: i.action,
      latency: i.latencyMs,
    })),
  }));

  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--canvas-lavender)" }}
    >
      <div className="max-w-[1280px] mx-auto px-6 sm:px-10 lg:px-14 pt-8 sm:pt-12 pb-24">
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
            <div style={{ fontSize: 13 }}>{COPY.installSuccess}</div>
          </div>
        )}

        <div className="flex flex-col gap-8 sm:gap-10 mt-8 sm:mt-10">
          {insight && <InsightCard insight={insight} />}

          <div>
            <SectionLabel>System intelligence</SectionLabel>
            <StatsCard total={total} week={week} />
          </div>

          {users.length > 0 ? (
            <div>
              <SectionLabel>Operations</SectionLabel>
              <HostsCard users={users} />
            </div>
          ) : (
            <div>
              <SectionLabel>Operations</SectionLabel>
              <EmptyHostsCard />
            </div>
          )}

          <div>
            <SectionLabel>Activity log</SectionLabel>
            <ActivityCard rows={rows} meetings={meetingsForClient} />
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
        <div className="flex items-start gap-4 sm:gap-5 min-w-0 flex-1">
          <div className="mt-4 sm:mt-[22px] shrink-0">
            <BrandMark size={40} iconSize={20} />
          </div>
          <div className="min-w-0">
            <div
              className="mb-2"
              style={{
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: "0.044em",
                color: "rgb(100,96,94)",
              }}
            >
              {hostName}'s Bouncer Control
            </div>
            <h1
              className="m-0 font-light text-3xl sm:text-4xl md:text-5xl"
              style={{
                lineHeight: 0.9,
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

        <div className="hidden md:flex flex-col items-end gap-5 shrink-0">
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
      className="glass-card flex items-start gap-4 sm:gap-[18px]"
      style={{ padding: 20 }}
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
      label: COPY.statDetected,
      tone: "slate" as const,
      value: total.total,
      delta: `${signed(week.total)} this week`,
      icon: "bot" as const,
    },
    {
      label: COPY.statRemoved,
      tone: "emerald" as const,
      value: total.removed,
      delta: `${signed(week.removed)} this week`,
      icon: "trash" as const,
    },
    {
      label: COPY.statWaiting,
      tone: "indigo" as const,
      value: total.waiting,
      delta: `${signed(week.waiting)} this week`,
      icon: "door-open" as const,
    },
    {
      label: COPY.statFailed,
      tone: "rose" as const,
      value: total.failed,
      delta: `${signed(week.failed)} this week`,
      icon: "x" as const,
    },
  ];

  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0 mb-1.5">
        <div>
          <div
            className="font-bold"
            style={{ fontSize: 18, color: "var(--ink-900)" }}
          >
            {COPY.statsTitle}
          </div>
          <div className="mt-1" style={{ fontSize: 13, color: "var(--ink-600)" }}>
            {COPY.statsSubtitle}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-5">
        {stats.map((s) => {
          const p = STAT_TONES[s.tone];
          return (
            <div
              key={s.label}
              className="rounded-xl flex flex-col justify-between"
              style={{
                padding: 18,
                background: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.6)",
                boxShadow: "var(--shadow-xs)",
                minHeight: 130,
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
                    fontSize: 36,
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
    <div className="glass-card" style={{ padding: 24 }}>
      <div className="mb-4">
        <div
          className="font-bold"
          style={{ fontSize: 18, color: "var(--ink-900)" }}
        >
          {COPY.hostsTitle}
        </div>
        <div className="mt-1" style={{ fontSize: 13, color: "var(--ink-600)" }}>
          {COPY.hostsSubtitle}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5">
        {users.map((u) => (
          <div
            key={u.email}
            className="white-card flex items-center gap-3.5"
            style={{ padding: "14px 16px" }}
          >
            <Avatar name={u.displayName ?? u.email} size={36} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
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
              className="text-right hidden sm:block"
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

function EmptyHostsCard() {
  return (
    <div className="glass-card text-center" style={{ padding: 36 }}>
      <div
        className="mx-auto mb-3 rounded-xl flex items-center justify-center"
        style={{
          width: 44,
          height: 44,
          background: "var(--sage-plum-50)",
          color: "var(--sage-plum)",
        }}
      >
        <Icon name="users" size={22} color="var(--sage-plum)" />
      </div>
      <div
        className="font-semibold mb-1"
        style={{ fontSize: 15, color: "var(--ink-900)" }}
      >
        {COPY.emptyHosts.title}
      </div>
      <div style={{ fontSize: 13, color: "var(--ink-600)" }}>
        {COPY.emptyHosts.body}
      </div>
    </div>
  );
}
