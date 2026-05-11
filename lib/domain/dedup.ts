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
  // Counts of each action type observed for this incident. Used to surface
  // "this bot has been bouncing in and out" patterns (e.g. sent to waiting
  // room 5 times) without inflating the incident count itself.
  cycles: {
    detected: number;
    waiting: number;
    removed: number;
    failed: number;
  };
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
 * Normalize a name for matching: lowercase, trim, collapse spaces,
 * strip "(reconnected)" / "(2)" suffixes.
 */
function normalizeName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Reduce raw audit rows to one BotIncident per (meeting, bot).
 *
 * The webhook and the sidebar SDK use different identifiers for the same
 * participant — webhooks give a Zoom participant ID (numeric), the SDK
 * gives a participantUUID (base64). So we can't just key on the ID column.
 *
 * Strategy: build a union-find over rows. Two rows merge if, in the same
 * meeting, they share ANY of: participantZoomId, normalized name, or email.
 * This catches webhook+sidebar pairs even when their IDs disagree.
 *
 * Input may be in any order; output is sorted newest-first by earliestAt.
 */
export function dedupIncidents(rows: RawAuditRow[]): BotIncident[] {
  if (rows.length === 0) return [];

  // Index rows by their position so union-find works on indices
  const n = rows.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]; // path compression
      i = parent[i];
    }
    return i;
  }

  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  }

  // Index rows within each meeting by id / name / email for fast matching.
  // For name matching we keep a LIST of (timestamp, index) pairs because
  // we only want to merge by name when entries are close together in time.
  const byMeetingId = new Map<string, Map<string, number>>();
  const byMeetingName = new Map<
    string,
    Map<string, Array<{ idx: number; ts: number }>>
  >();
  const byMeetingEmail = new Map<string, Map<string, number>>();

  // 30-second window for name-based dedup. Webhook + sidebar pairs always
  // arrive within a few seconds. Beyond 30s, same-name rows are treated as
  // separate incidents (e.g. a bot that rejoined after being kicked).
  const NAME_MATCH_WINDOW_MS = 30_000;

  for (let i = 0; i < n; i++) {
    const row = rows[i];
    const meeting = row.meetingId;

    // ID match — exact, no time window
    if (row.participantZoomId) {
      const m = byMeetingId.get(meeting) ?? new Map();
      const seen = m.get(row.participantZoomId);
      if (seen !== undefined) union(seen, i);
      else m.set(row.participantZoomId, i);
      byMeetingId.set(meeting, m);
    }

    // Name match — only union if within the time window of an existing row.
    // This prevents merging "Otter kicked at 2:00" with "Otter rejoined at 2:08"
    // while still merging webhook+sidebar pairs that arrive seconds apart.
    const norm = normalizeName(row.participantName);
    if (norm) {
      const m = byMeetingName.get(meeting) ?? new Map();
      const seen = m.get(norm) ?? [];
      const ts = row.createdAt.getTime();
      for (const entry of seen) {
        if (Math.abs(entry.ts - ts) <= NAME_MATCH_WINDOW_MS) {
          union(entry.idx, i);
          break;
        }
      }
      seen.push({ idx: i, ts });
      m.set(norm, seen);
      byMeetingName.set(meeting, m);
    }

    // Email match — exact, no time window (emails are stable identifiers)
    if (row.participantEmail) {
      const email = row.participantEmail.toLowerCase();
      const m = byMeetingEmail.get(meeting) ?? new Map();
      const seen = m.get(email);
      if (seen !== undefined) union(seen, i);
      else m.set(email, i);
      byMeetingEmail.set(meeting, m);
    }
  }

  // Collect rows per group representative
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const list = groups.get(root);
    if (list) list.push(i);
    else groups.set(root, [i]);
  }

  // Reduce each group to a single BotIncident
  const incidents: BotIncident[] = [];
  for (const [, indices] of groups) {
    // Use the EARLIEST row's identifiers as the canonical representation,
    // then promote to higher action / fill in nulls from other rows.
    const groupRows = indices
      .map((i) => rows[i])
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const first = groupRows[0];
    const incident: BotIncident = {
      id: `${first.meetingId}::${first.participantZoomId ?? normalizeName(first.participantName) ?? String(first.id)}`,
      earliestAt: first.createdAt,
      meetingId: first.meetingId,
      participantName: first.participantName,
      participantEmail: first.participantEmail,
      participantZoomId: first.participantZoomId,
      matchReason: first.matchReason,
      action: (first.action as BotIncident["action"]) ?? "detected",
      latencyMs: first.latencyMs,
      errorMessage: first.errorMessage,
      cycles: { detected: 0, waiting: 0, removed: 0, failed: 0 },
    };

    // Count action occurrences across ALL rows in the group (including the first).
    // This is the "cycles" data — independent of action-rank promotion above.
    for (const row of groupRows) {
      switch (row.action) {
        case "detected":
          incident.cycles.detected++;
          break;
        case "moved_to_waiting_room":
          incident.cycles.waiting++;
          break;
        case "removed":
          incident.cycles.removed++;
          break;
        case "remove_failed":
          incident.cycles.failed++;
          break;
      }
    }

    for (let k = 1; k < groupRows.length; k++) {
      const row = groupRows[k];
      // Fill in details from any row that has them
      incident.participantEmail ||= row.participantEmail;
      incident.participantZoomId ||= row.participantZoomId;
      incident.participantName ||= row.participantName;

      const incomingRank = ACTION_RANK[row.action] ?? 0;
      const existingRank = ACTION_RANK[incident.action] ?? 0;
      if (incomingRank > existingRank) {
        incident.action = row.action as BotIncident["action"];
        incident.latencyMs = row.latencyMs ?? incident.latencyMs;
        incident.errorMessage = row.errorMessage ?? incident.errorMessage;
      } else if (incomingRank === existingRank) {
        incident.latencyMs = incident.latencyMs ?? row.latencyMs;
        incident.errorMessage = incident.errorMessage ?? row.errorMessage;
      }
    }

    incidents.push(incident);
  }

  return incidents.sort(
    (a, b) => b.earliestAt.getTime() - a.earliestAt.getTime()
  );
}

/**
 * Count actions across incidents. Returns the raw count of audit log
 * rows for each action type (by summing each incident's cycle counts).
 *
 * This is the "how many times did the host do each thing" view, which
 * is the right semantics for dashboard tiles. A bot that was sent to
 * waiting room twice and then removed contributes: waiting=2, removed=1.
 *
 * `total` here is the number of incidents (unique bot+meeting pairs),
 * not the sum of cycles. `detected` is also incident-count, since every
 * incident was detected at least once and treating it as "all detection
 * audit rows" would inflate the number with re-detection noise that the
 * other tiles don't have.
 */
export function countByAction(incidents: BotIncident[]) {
  let removed = 0;
  let waiting = 0;
  let failed = 0;
  for (const inc of incidents) {
    removed += inc.cycles.removed;
    waiting += inc.cycles.waiting;
    failed += inc.cycles.failed;
  }
  return {
    total: incidents.length,
    detected: incidents.length,
    removed,
    waiting,
    failed,
    // Kept for backward-compat with anything reading `detectedOnly`
    // (it now means "incidents whose final state is still 'detected'").
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
    detected: number;
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
