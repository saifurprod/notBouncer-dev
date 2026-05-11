// Dedup module — groups raw audit_log rows into "bot incidents."
//
// Background: a single bot joining a single meeting can trigger multiple
// audit rows (webhook detects, sidebar detects, sidebar removes). To users
// the dashboard should show ONE row per incident with the final state.
// This module is pure (no I/O) so it can be unit-tested.

export type RawAuditRow = {
  id: bigint;
  createdAt: Date;
  meetingId: string;
  participantName: string | null;
  participantEmail: string | null;
  participantZoomId: string | null;
  matchReason: string;
  action: string;
  latencyMs: number | null;
  errorMessage: string | null;
  source: string;
};

export type BotIncident = {
  // Stable id for React keys — based on grouping key
  id: string;
  earliestAt: Date;
  meetingId: string;
  participantName: string | null;
  participantEmail: string | null;
  participantZoomId: string | null;
  matchReason: string;
  // The "highest" action observed for this incident
  action: "removed" | "moved_to_waiting_room" | "remove_failed" | "detected" | "dry_run";
  latencyMs: number | null;
  errorMessage: string | null;
};

// Higher number = "more advanced" action. When grouping we pick the highest.
const ACTION_RANK: Record<string, number> = {
  detected: 1,
  dry_run: 2,
  remove_failed: 3,
  moved_to_waiting_room: 4,
  removed: 5,
};

/**
 * Builds a stable grouping key for a row.
 * Prefer participantZoomId (most stable) but fall back to a normalized name
 * + meeting so webhook events without zoomId still dedup against sidebar.
 */
function groupKey(row: RawAuditRow): string {
  const id =
    row.participantZoomId ||
    (row.participantName ? row.participantName.toLowerCase().trim() : "unknown");
  return `${row.meetingId}::${id}`;
}

/**
 * Reduce raw audit rows to one BotIncident per (meeting, bot).
 * Input may be in any order; output is sorted newest-first by earliestAt.
 */
export function dedupIncidents(rows: RawAuditRow[]): BotIncident[] {
  const map = new Map<string, BotIncident>();

  for (const row of rows) {
    const key = groupKey(row);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        id: key,
        earliestAt: row.createdAt,
        meetingId: row.meetingId,
        participantName: row.participantName,
        participantEmail: row.participantEmail,
        participantZoomId: row.participantZoomId,
        matchReason: row.matchReason,
        action: (row.action as BotIncident["action"]) ?? "detected",
        latencyMs: row.latencyMs,
        errorMessage: row.errorMessage,
      });
      continue;
    }

    // Earliest timestamp wins
    if (row.createdAt < existing.earliestAt) {
      existing.earliestAt = row.createdAt;
    }

    // Fill in details from any row that has them
    existing.participantEmail ||= row.participantEmail;
    existing.participantZoomId ||= row.participantZoomId;

    const incomingRank = ACTION_RANK[row.action] ?? 0;
    const existingRank = ACTION_RANK[existing.action] ?? 0;

    if (incomingRank > existingRank) {
      // Promote to higher action; carry latency / error from the winning row
      existing.action = row.action as BotIncident["action"];
      existing.latencyMs = row.latencyMs ?? existing.latencyMs;
      existing.errorMessage = row.errorMessage ?? existing.errorMessage;
    } else if (incomingRank === existingRank) {
      // Same action — prefer non-null details
      existing.latencyMs = existing.latencyMs ?? row.latencyMs;
      existing.errorMessage = existing.errorMessage ?? row.errorMessage;
    }
    // (incomingRank < existingRank: keep existing as the representative)
  }

  return Array.from(map.values()).sort(
    (a, b) => b.earliestAt.getTime() - a.earliestAt.getTime()
  );
}

/**
 * Count incidents by action category. Used for dashboard stat tiles.
 * `detected` here is the count of incidents that were caught but never
 * acted on (i.e. final state is still "detected").
 */
export function countByAction(incidents: BotIncident[]) {
  return {
    total: incidents.length,
    removed: incidents.filter((i) => i.action === "removed").length,
    waiting: incidents.filter((i) => i.action === "moved_to_waiting_room").length,
    failed: incidents.filter((i) => i.action === "remove_failed").length,
    detectedOnly: incidents.filter((i) => i.action === "detected").length,
  };
}

/**
 * A meeting summary — multiple bot incidents that all occurred in
 * the same Zoom meeting. Used for the "By meeting" view on the dashboard.
 */
export type MeetingSummary = {
  meetingId: string;
  earliestAt: Date;
  latestAt: Date;
  incidents: BotIncident[];
  counts: {
    total: number;
    removed: number;
    waiting: number;
    failed: number;
    detectedOnly: number;
  };
};

/**
 * Group bot incidents by meetingId. Sorted newest-meeting-first by latest activity.
 */
export function groupByMeeting(incidents: BotIncident[]): MeetingSummary[] {
  const map = new Map<string, BotIncident[]>();
  for (const inc of incidents) {
    const list = map.get(inc.meetingId);
    if (list) list.push(inc);
    else map.set(inc.meetingId, [inc]);
  }

  const summaries: MeetingSummary[] = [];
  for (const [meetingId, list] of map.entries()) {
    const times = list.map((i) => i.earliestAt.getTime());
    summaries.push({
      meetingId,
      earliestAt: new Date(Math.min(...times)),
      latestAt: new Date(Math.max(...times)),
      incidents: list.sort(
        (a, b) => b.earliestAt.getTime() - a.earliestAt.getTime()
      ),
      counts: countByAction(list),
    });
  }

  return summaries.sort(
    (a, b) => b.latestAt.getTime() - a.latestAt.getTime()
  );
}
