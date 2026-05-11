// Centralized UI copy and error message translation.
//
// Putting strings here makes it easier to review tone, fix typos, and
// translate later. Error map turns technical SDK errors into language
// a non-technical host can understand.

export const COPY = {
  // Landing
  landingTagline:
    "NoteBouncer watches your Zoom calls for Otter, Fireflies, Fathom, Read, tl;dv and friends — and removes them the instant they join. The host stays in control.",

  // Dashboard hero
  dashHeroSuffix: "bot stopped this month.",
  dashHeroSuffixPlural: "bots stopped this month.",
  dashHeroQuietSub:
    "No notetaker has crashed your meetings unannounced in the last 48 hours.",

  // Stats card
  statsTitle: "Bot lifecycle",
  statsSubtitle: "Detection and removal activity across your meetings",
  statDetected: "Detected",
  statRemoved: "Removed",
  statWaiting: "Waiting",
  statFailed: "Failed",

  // Hosts card
  hostsTitle: "Connected hosts",
  hostsSubtitle: "Zoom accounts authorised to NoteBouncer",

  // Activity card
  activityTitle: "Activity",
  activitySubtitleEvent: "Every bot caught in your meetings, newest first",
  activitySubtitleMeeting: "Bot activity grouped by meeting, newest first",

  // Filters
  filterButton: "Filter",
  exportButton: "Export",
  filterActionLabel: "Action",
  filterClear: "Clear",
  filterDone: "Done",

  // Toggle
  groupByEvent: "By event",
  groupByMeeting: "By meeting",

  // Empty states
  emptyActivityFirst: {
    title: "No bots caught yet.",
    body: "NoteBouncer is watching. The next time a notetaker joins one of your Zoom meetings, you'll see it here.",
    hint: "Want to test? Have someone join a meeting with the name \"Otter.ai Test\".",
  },
  emptyActivityFiltered: {
    title: "No activity matches these filters.",
    body: "Try clearing your filters to see all bot activity.",
  },
  emptyHosts: {
    title: "No hosts connected yet.",
    body: "Install NoteBouncer on a Zoom account to start watching its meetings.",
  },

  // Install confirmation
  installSuccess:
    "Installed. Open NoteBouncer from Zoom's Apps panel during your next meeting to enable removal.",

  // Sidebar
  sidebarVersion: "Sidebar · v0.2",
  sidebarWatching: "Watching",
  sidebarConnecting: "Connecting…",
  sidebarIdle: "Idle",
  sidebarOutsideZoom: "Outside Zoom",
  sidebarError: "Error",
  sidebarCurrentMeeting: "Current meeting",
  sidebarActionLabel: "When I click ‘Remove all’",
  sidebarActionRemove: "Remove",
  sidebarActionWaiting: "Waiting room",
  sidebarRecheck: "Recheck",
  sidebarDetectedHeader: "Caught bots",
  sidebarClearResolved: "Clear",
  sidebarParticipantsHeader: "In this meeting",
  sidebarActivityHeader: "Activity",
  sidebarEmptyWatching:
    "All clear. NoteBouncer will flag any notetaker the moment it joins.",
  sidebarEmptyOutside:
    "Open NoteBouncer from Zoom's Apps panel during a meeting.",
  sidebarEmptyMainClient:
    "Connected. Open during a meeting to catch and remove notetakers.",
  sidebarRemoveAll: (n: number) => `Remove all (${n})`,
  sidebarSendAll: (n: number) => `Send all to waiting room (${n})`,
  sidebarToastRemoved: (name: string) => `Removed ${name}`,
  sidebarToastWaiting: (name: string) => `Sent ${name} to waiting room`,
  sidebarToastFailed: (name: string) => `Couldn't act on ${name}`,
  sidebarWaitingRoomOff:
    "Waiting room is off in this meeting. Enable it in Zoom's Security menu or use Remove instead.",
} as const;

// Map technical SDK / API errors to human-readable messages.
// Match by substring (case-insensitive) — SDK error text varies.
const ERROR_RULES: Array<{ match: RegExp; human: string }> = [
  {
    match: /not\s*host/i,
    human:
      "You're not the host of this meeting — only hosts can remove participants. The bot has been logged for your records.",
  },
  {
    match: /app_not_support|80004/i,
    human:
      "This action isn't enabled for the app yet. The capability needs to be added in Zoom Marketplace settings.",
  },
  {
    match: /no\s*permission|permission.*denied/i,
    human:
      "Zoom didn't allow this action. You may not have the host privileges needed.",
  },
  {
    match: /participant.*not.*found|invalid.*participant/i,
    human: "That participant is no longer in the meeting.",
  },
  {
    match: /network|timeout|fetch|failed to fetch/i,
    human: "Couldn't reach Zoom. Check your connection and try again.",
  },
  {
    match: /waiting.*room.*disabled|wr_disabled/i,
    human:
      "Waiting room is disabled. Enable it from Zoom's Security menu, then click Recheck.",
  },
  {
    match: /rate.?limit/i,
    human: "Zoom is rate-limiting requests. Wait a moment and try again.",
  },
];

/**
 * Translate a technical error message to a human-readable one.
 * Falls back to the original if no rule matches.
 */
export function humanizeError(raw: string | null | undefined): string {
  if (!raw) return "Something went wrong.";
  for (const rule of ERROR_RULES) {
    if (rule.match.test(raw)) return rule.human;
  }
  // Final fallback: strip technical prefixes like "Error: " or "remove: "
  return raw.replace(/^[a-z_]+:\s*/i, "").replace(/^Error:\s*/i, "");
}

/**
 * Short version of humanized error, for tight UI spots (≤ ~60 chars).
 */
export function humanizeErrorShort(raw: string | null | undefined): string {
  const full = humanizeError(raw);
  if (full.length <= 60) return full;
  return full.slice(0, 57).trim() + "…";
}
