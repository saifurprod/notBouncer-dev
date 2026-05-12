// AI insight generator for the dashboard.
//
// Today this is rule-based — picks the most common bot, computes basic
// stats, returns a sentence. The shape mirrors what an LLM-backed version
// would return, so the dashboard component never has to change when we
// swap the implementation.

export type Insight = {
  headline: string;
  body: string;
  // Optional structured signals so the AI version can produce richer text
  topBot?: string;
  topBotPct?: number;
  medianLatencyMs?: number | null;
  failedNotHostCount?: number;
};

type LogShape = {
  participantName: string | null;
  matchReason: string;
  action: string;
  latencyMs: number | null;
  source: string;
  errorMessage: string | null;
  createdAt: Date;
};

export function generateInsight(logs: LogShape[]): Insight | null {
  if (logs.length === 0) return null;

  // Look at the last 7 days only
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = logs.filter((l) => l.createdAt.getTime() >= sevenDaysAgo);
  if (recent.length === 0) {
    return {
      headline: "No bot activity in the last 7 days.",
      body:
        "Either no notetakers tried to crash your meetings, or you haven't hosted any. NoteBouncer is watching whenever you host.",
    };
  }

  // Most common bot vendor (from matchReason like "name:otter")
  const vendorCounts: Record<string, number> = {};
  for (const l of recent) {
    const m = /^(name|email|domain):([a-z0-9.\-]+)/i.exec(l.matchReason);
    const vendor = m ? m[2].split(".")[0] : "unknown";
    vendorCounts[vendor] = (vendorCounts[vendor] ?? 0) + 1;
  }
  const sorted = Object.entries(vendorCounts).sort((a, b) => b[1] - a[1]);
  const topVendor = sorted[0]?.[0] ?? null;
  const topCount = sorted[0]?.[1] ?? 0;
  const topPct = Math.round((topCount / recent.length) * 100);
  const topLabel = topVendor
    ? topVendor.charAt(0).toUpperCase() + topVendor.slice(1)
    : null;

  // Median latency on removed/waiting actions
  const latencies = recent
    .map((l) => l.latencyMs)
    .filter((n): n is number => typeof n === "number" && n > 0)
    .sort((a, b) => a - b);
  const median =
    latencies.length > 0
      ? latencies[Math.floor(latencies.length / 2)]
      : null;

  // Failed "not host" events
  const failedNotHost = recent.filter(
    (l) =>
      l.action === "remove_failed" &&
      (l.errorMessage?.toLowerCase().includes("not host") ?? false)
  ).length;

  // Build headline + body
  const headline =
    topLabel && topPct > 0
      ? `${topLabel} appeared in ${topPct}% of your detections this week, the most of any bot.`
      : `${recent.length} bot${recent.length === 1 ? "" : "s"} detected this week.`;

  const bodyParts: string[] = [];
  if (median !== null) {
    bodyParts.push(
      `Median removal time was ${median}ms across all actions.`
    );
  }
  if (failedNotHost > 0) {
    bodyParts.push(
      `${failedNotHost} remove_failed event${failedNotHost === 1 ? "" : "s"} came from meetings where you weren't the host — consider asking those organisers to install NoteBouncer too.`
    );
  }
  if (bodyParts.length === 0) {
    bodyParts.push(
      "All detections logged from passive webhooks. Open the sidebar in your next meeting to enable active removal."
    );
  }

  return {
    headline,
    body: bodyParts.join(" "),
    topBot: topLabel ?? undefined,
    topBotPct: topPct,
    medianLatencyMs: median,
    failedNotHostCount: failedNotHost,
  };
}
