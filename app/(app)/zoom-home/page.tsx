"use client";

import { useEffect, useRef, useState } from "react";
import { detect, DetectionConfig, DEFAULT_CONFIG } from "@/lib/domain/detection";
import { Icon } from "@/components/ui/Icon";
import { StatusPill } from "@/components/ui/StatusPill";
import { COPY, humanizeError, humanizeErrorShort } from "@/lib/copy";

type Status =
  | { kind: "loading" }
  | { kind: "outside_zoom"; message: string }
  | { kind: "main_client" }
  | { kind: "in_meeting"; meetingTopic?: string }
  | { kind: "error"; message: string };

type LogEntry = {
  ts: number;
  level: "info" | "warn" | "error" | "success";
  text: string;
};

type ActionMode = "remove" | "waiting_room";

type DetectedBot = {
  participantUUID: string;
  name: string;
  email: string | null;
  reason: string;
  detectedAt: number;
  status: "pending" | "acting" | "removed" | "waiting" | "failed";
  errorMessage?: string;
};

// Error-only toast. Success and info toasts were removed — the bot card
// colour state inside "Caught bots" is the visible feedback for happy-path
// actions, and the Zoom system notification handles new-bot alerts. We only
// surface a toast when something actually fails and the host needs to know.
type Toast = {
  id: number;
  text: string;
  expiresAt: number;
};

type BlocklistEntry = {
  /** Stable ID for React keys and removal targeting. */
  id: string;
  /** Normalized display name. Empty string if unknown. */
  name: string;
  /** Original casing for display. */
  displayName: string;
  /** Domain extracted from the email at remove time. Null if no email. */
  domain: string | null;
  /** Original email (display). Null if no email at remove time. */
  email: string | null;
  /** ms epoch of when this entry was added. Used for newest-first sort. */
  addedAt: number;
  /** ms epoch of the most recent auto-kick triggered by this entry.
   *  Used for the 5s "just kicked" row highlight. */
  lastKickedAt: number | null;
};

export default function ZoomSidebarApp() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [participants, setParticipants] = useState<any[]>([]);
  const [detectedBots, setDetectedBots] = useState<DetectedBot[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode>("remove");
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState<boolean | null>(null);
  const [config] = useState<DetectionConfig>(DEFAULT_CONFIG);
  const userIdRef = useRef<string | null>(null);
  const sdkRef = useRef<any>(null);
  const meetingIdRef = useRef<string>("");
  const meetingUuidRef = useRef<string>("");
  const meetingTopicRef = useRef<string>("");
  const meetingStartRef = useRef<number>(Date.now());
  const detectedUUIDsRef = useRef<Set<string>>(new Set());
  // Blocklist entries — each represents one person who was removed. The
  // sidebar's auto-kick logic checks incoming participants against the name
  // and domain of every entry. State (not ref) so the UI can render and the
  // host can manage entries.
  const [blocklist, setBlocklist] = useState<BlocklistEntry[]>([]);
  // We mirror the latest blocklist in a ref so synchronous lookups
  // (isBlocklisted called during participant-join event handlers) see the
  // current state without depending on closure capture.
  const blocklistRef = useRef<BlocklistEntry[]>([]);
  useEffect(() => {
    blocklistRef.current = blocklist;
  }, [blocklist]);
  const toastIdRef = useRef(0);
  // Queue of bot names detected mid-meeting, waiting to be coalesced into
  // a single Zoom system notification. Pattern: every new bot resets a
  // 2-second timer; when the timer fires, we send one summary notification.
  const pendingBotNamesRef = useRef<string[]>([]);
  const notifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Whether the activity log section is visible. Default: hidden — it's
  // developer-flavored output (raw event lines, latency numbers). Hosts
  // running real meetings shouldn't see this by default. Toggle exposed at
  // the bottom of the sidebar.
  const [showActivityLog, setShowActivityLog] = useState(false);

  function normalizeName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s*\([^)]*\)\s*$/g, "")
      .replace(/\s+/g, " ");
  }

  function isBlocklisted(name: string, email: string | null): boolean {
    const norm = normalizeName(name);
    const domain = email?.toLowerCase().split("@")[1] ?? null;
    for (const entry of blocklistRef.current) {
      if (norm && entry.name && entry.name === norm) return true;
      if (domain && entry.domain && entry.domain === domain) return true;
    }
    return false;
  }

  function addToBlocklist(name: string, email: string | null) {
    const norm = normalizeName(name);
    const domain = email?.toLowerCase().split("@")[1] ?? null;
    // Don't add a duplicate if an identical entry already exists.
    const exists = blocklistRef.current.some(
      (e) => e.name === norm && e.domain === domain,
    );
    if (exists) return;
    const entry: BlocklistEntry = {
      id: `bl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: norm,
      displayName: name.trim() || norm || "(no name)",
      domain,
      email,
      addedAt: Date.now(),
      lastKickedAt: null,
    };
    setBlocklist((prev) => [entry, ...prev]);
  }

  function removeFromBlocklist(id: string) {
    setBlocklist((prev) => prev.filter((e) => e.id !== id));
  }

  function markEntryKicked(name: string, email: string | null) {
    const norm = normalizeName(name);
    const domain = email?.toLowerCase().split("@")[1] ?? null;
    setBlocklist((prev) =>
      prev.map((e) => {
        const nameMatch = !!norm && !!e.name && e.name === norm;
        const domainMatch = !!domain && !!e.domain && e.domain === domain;
        return nameMatch || domainMatch
          ? { ...e, lastKickedAt: Date.now() }
          : e;
      }),
    );
    // Trigger a re-render after the highlight window so the "just kicked"
    // tag fades. We use a small grace buffer (200ms) past the 5s window
    // so the row truly looks settled when the highlight is removed.
    setTimeout(() => {
      setBlocklist((prev) =>
        prev.map((e) => {
          if (!e.lastKickedAt) return e;
          if (Date.now() - e.lastKickedAt < 5000) return e;
          return { ...e, lastKickedAt: null };
        }),
      );
    }, 5200);
  }

  function appendLog(level: LogEntry["level"], text: string) {
    setLogs((prev) => [{ ts: Date.now(), level, text }, ...prev].slice(0, 100));
  }

  function showToast(text: string, durationMs = 3500) {
    const id = ++toastIdRef.current;
    const expiresAt = Date.now() + durationMs;
    setToasts((prev) => [...prev, { id, text, expiresAt }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, durationMs);
  }

  /**
   * Queue a bot detection for Zoom's system notification.
   *
   * Pattern A debounce: every new bot resets a 2-second timer. When the
   * timer fires, all queued bot names are coalesced into a single Zoom
   * `showNotification` so a flood of joins (e.g., 3 notetakers at once)
   * produces ONE notification, not three.
   *
   * Truncation: at most 3 names appear; any beyond that are summarised
   * as "+ N more" to stay within the small notification space.
   */
  function queueBotNotification(name: string) {
    pendingBotNamesRef.current.push(name);

    if (notifyTimerRef.current) clearTimeout(notifyTimerRef.current);
    notifyTimerRef.current = setTimeout(() => {
      const names = pendingBotNamesRef.current;
      pendingBotNamesRef.current = [];
      notifyTimerRef.current = null;

      if (names.length === 0) return;
      const sdk = sdkRef.current;
      if (!sdk) return;

      let title: string;
      let message: string;
      if (names.length === 1) {
        title = "Bot detected";
        message = `${names[0]} joined your meeting`;
      } else {
        const shown = names.slice(0, 3);
        const remaining = names.length - shown.length;
        const namesText =
          remaining > 0
            ? `${shown.join(", ")} + ${remaining} more`
            : shown.slice(0, -1).join(", ") + " and " + shown[shown.length - 1];
        title = `${names.length} bots detected`;
        message = `${namesText} joined your meeting`;
      }

      try {
        sdk
          .showNotification({ type: "warning", title, message })
          .catch((err: any) => {
            appendLog(
              "warn",
              `Notification failed: ${err?.message ?? String(err)}`
            );
          });
      } catch (err: any) {
        appendLog("warn", `Notification threw: ${err?.message ?? String(err)}`);
      }
    }, 2000);
  }

  async function syncEvent(payload: {
    participantName: string;
    participantEmail?: string;
    participantZoomId?: string;
    matchReason: string;
    action: "detected" | "removed" | "moved_to_waiting_room" | "remove_failed";
    errorMessage?: string;
    latencyMs?: number;
  }) {
    if (!meetingIdRef.current) return;
    try {
      const res = await fetch("/api/sidebar/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zoomUserId: userIdRef.current,
          meetingId: meetingIdRef.current,
          meetingUuid: meetingUuidRef.current || undefined,
          ...payload,
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        appendLog("warn", `Sync HTTP ${res.status}: ${errText.slice(0, 100)}`);
      }
    } catch (err) {
      appendLog("warn", `Sync failed: ${(err as Error).message}`);
    }
  }

  async function autoKickBlocklisted(p: any, reason: string) {
    const sdk = sdkRef.current;
    if (!sdk) return;
    const name = p.screenName ?? p.userName ?? p.displayName ?? "";
    const email = p.email ?? null;
    const uuid = p.participantUUID ?? p.userId;
    if (!uuid) return;

    appendLog("warn", `Auto-kicking blocklisted rejoin: ${name}`);
    // Mark the matching blocklist entry so the Blocked UI shows a brief
    // "just kicked" amber highlight (visible for 5 seconds).
    markEntryKicked(name, email);
    const startedAt = Date.now();
    try {
      await sdk.removeParticipant({ participantUUID: uuid });
      const latencyMs = Date.now() - startedAt;
      appendLog("success", `Auto-removed: ${name} (${latencyMs}ms)`);
      await syncEvent({
        participantName: name,
        participantEmail: email ?? undefined,
        participantZoomId: uuid,
        matchReason: `blocklist:${reason}`,
        action: "removed",
        latencyMs,
      });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      appendLog("error", `Auto-kick failed for ${name}: ${humanizeErrorShort(msg)}`);
      await syncEvent({
        participantName: name,
        participantEmail: email ?? undefined,
        participantZoomId: uuid,
        matchReason: `blocklist:${reason}`,
        action: "remove_failed",
        errorMessage: `auto: ${msg}`,
      });
    }
  }

  async function detectParticipant(p: any, isNewJoin = false) {
    const name = p.screenName ?? p.userName ?? p.displayName ?? "";
    const email = p.email ?? null;
    const uuid = p.participantUUID ?? p.userId;
    if (!name || !uuid) return;
    if (detectedUUIDsRef.current.has(uuid)) return;

    if (isBlocklisted(name, email)) {
      detectedUUIDsRef.current.add(uuid);
      await autoKickBlocklisted(p, "rejoin");
      return;
    }

    const result = detect(
      { name, email, zoomUserId: uuid, isGuest: !email },
      config
    );
    if (!result.match) return;

    detectedUUIDsRef.current.add(uuid);
    appendLog("warn", `Bot detected: ${name} (${result.reason})`);

    // Only fire a Zoom system notification for bots that join mid-meeting
    // while the host is already in the meeting. Bots discovered during the
    // sidebar's initial participant enumeration (i.e. they were already in
    // the meeting when the sidebar opened) are surfaced via the sidebar UI
    // instead — no system notification needed.
    if (isNewJoin) {
      queueBotNotification(name);
    }

    setDetectedBots((prev) => [
      ...prev,
      {
        participantUUID: uuid,
        name,
        email,
        reason: result.reason,
        detectedAt: Date.now(),
        status: "pending" as const,
      },
    ]);

    await syncEvent({
      participantName: name,
      participantEmail: email ?? undefined,
      participantZoomId: uuid,
      matchReason: result.reason,
      action: "detected",
    });
  }

  async function actOnBot(bot: DetectedBot, mode: ActionMode) {
    const sdk = sdkRef.current;
    if (!sdk) {
      appendLog("error", "SDK not available");
      showToast("Zoom SDK not ready");
      return;
    }
    if (bot.status !== "pending" && bot.status !== "failed") return;

    setDetectedBots((prev) =>
      prev.map((b) =>
        b.participantUUID === bot.participantUUID
          ? { ...b, status: "acting" as const, errorMessage: undefined }
          : b
      )
    );

    const startedAt = Date.now();
    try {
      if (mode === "remove") {
        await sdk.removeParticipant({ participantUUID: bot.participantUUID });
        const latencyMs = Date.now() - startedAt;
        appendLog("success", `Removed: ${bot.name} (${latencyMs}ms)`);
        addToBlocklist(bot.name, bot.email);
        setDetectedBots((prev) =>
          prev.map((b) =>
            b.participantUUID === bot.participantUUID
              ? { ...b, status: "removed" as const }
              : b
          )
        );
        await syncEvent({
          participantName: bot.name,
          participantEmail: bot.email ?? undefined,
          participantZoomId: bot.participantUUID,
          matchReason: bot.reason,
          action: "removed",
          latencyMs,
        });
        // Clear from the dedup set. If this bot rejoins later (typically with
        // a new UUID anyway), we want detectParticipant to log it as a fresh
        // detection rather than silently swallowing the event. The blocklist
        // (added above) handles auto-kicking; logging still runs first.
        detectedUUIDsRef.current.delete(bot.participantUUID);
      } else {
        await sdk.putParticipantToWaitingRoom({
          participantUUID: bot.participantUUID,
        });
        const latencyMs = Date.now() - startedAt;
        appendLog("success", `Sent to waiting room: ${bot.name} (${latencyMs}ms)`);
        // Deliberately not blocklisting on waiting-room — admit-back is reversible.
        setDetectedBots((prev) =>
          prev.map((b) =>
            b.participantUUID === bot.participantUUID
              ? { ...b, status: "waiting" as const }
              : b
          )
        );
        await syncEvent({
          participantName: bot.name,
          participantEmail: bot.email ?? undefined,
          participantZoomId: bot.participantUUID,
          matchReason: bot.reason,
          action: "moved_to_waiting_room",
          latencyMs,
        });
        // Clear from the dedup set. Zoom keeps the same UUID across the
        // waiting-room cycle, so without this clear, an admit-back would be
        // silently swallowed by the guard in detectParticipant. With the
        // clear, admit-back fires a fresh `detected` event and the cycle
        // counts on the dashboard reflect reality.
        detectedUUIDsRef.current.delete(bot.participantUUID);
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      const human = humanizeErrorShort(msg);
      appendLog("error", `Action failed for ${bot.name}: ${human}`);
      showToast(`${COPY.sidebarToastFailed(bot.name)}: ${human}`);
      setDetectedBots((prev) =>
        prev.map((b) =>
          b.participantUUID === bot.participantUUID
            ? { ...b, status: "failed" as const, errorMessage: msg }
            : b
        )
      );
      await syncEvent({
        participantName: bot.name,
        participantEmail: bot.email ?? undefined,
        participantZoomId: bot.participantUUID,
        matchReason: bot.reason,
        action: "remove_failed",
        errorMessage: `${mode}: ${msg}`,
      });
    }
  }

  async function actOnAllPending() {
    const pending = detectedBots.filter(
      (b) => b.status === "pending" || b.status === "failed"
    );
    if (pending.length === 0) return;
    if (actionMode === "waiting_room" && waitingRoomEnabled === false) {
      appendLog("error", COPY.sidebarWaitingRoomOff);
      showToast("Waiting room is off — turn it on first");
      return;
    }
    setBulkRunning(true);
    const verb = actionMode === "remove" ? "Removing" : "Sending to waiting room";
    appendLog("info", `${verb} ${pending.length} bot(s)…`);
    for (const bot of pending) {
      await actOnBot(bot, actionMode);
    }
    setBulkRunning(false);
    appendLog("info", "Bulk action complete");
  }

  function clearResolved() {
    setDetectedBots((prev) =>
      prev.filter((b) => b.status !== "removed" && b.status !== "waiting")
    );
  }

  async function refreshWaitingRoomState() {
    const sdk = sdkRef.current;
    if (!sdk) return;
    try {
      const wrState: any = await sdk.getWaitingRoomState();
      appendLog(
        "info",
        `Waiting room raw: ${JSON.stringify(wrState).slice(0, 200)}`
      );
      const candidates = [
        wrState?.enabled,
        wrState?.isEnabled,
        wrState?.state,
        wrState?.waitingRoom,
        wrState?.waitingRoomEnabled,
        wrState?.status,
      ];
      let enabled: boolean | null = null;
      for (const c of candidates) {
        if (typeof c === "boolean") {
          enabled = c;
          break;
        }
        if (typeof c === "string") {
          enabled =
            c.toLowerCase() === "enabled" ||
            c.toLowerCase() === "on" ||
            c === "true";
          break;
        }
      }
      if (enabled === null && typeof wrState === "boolean") enabled = wrState;
      if (enabled === null && wrState && typeof wrState === "object") {
        appendLog("warn", "Waiting room state shape unrecognized; defaulting to enabled");
        enabled = true;
      }
      setWaitingRoomEnabled(enabled);
      appendLog(
        enabled === true ? "success" : enabled === false ? "warn" : "info",
        `Waiting room: ${enabled === true ? "enabled" : enabled === false ? "disabled" : "unknown"}`
      );
    } catch (err: any) {
      appendLog(
        "warn",
        `Couldn't read waiting room state: ${humanizeErrorShort(err?.message ?? err)}`
      );
      setWaitingRoomEnabled(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const zoomSdk = (await import("@zoom/appssdk")).default;
        sdkRef.current = zoomSdk;

        await zoomSdk.config({
          version: "0.16.0",
          capabilities: [
            "getRunningContext",
            "getMeetingContext",
            "getMeetingParticipants",
            "removeParticipant",
            "putParticipantToWaitingRoom",
            "getWaitingRoomState",
            "onParticipantChange",
            "showNotification",
          ],
        });
        if (cancelled) return;
        appendLog("info", "Zoom SDK configured");

        const ctx = await zoomSdk.getRunningContext();
        appendLog("info", `Running context: ${ctx.context}`);
        if (ctx.context !== "inMeeting") {
          setStatus({ kind: "main_client" });
          return;
        }

        let meetingTopic: string | undefined;
        try {
          const meetingCtx: any = await zoomSdk.getMeetingContext();
          meetingTopic = meetingCtx?.meetingTopic;
          meetingTopicRef.current = meetingTopic ?? "";
          meetingIdRef.current = String(
            meetingCtx?.meetingID ?? meetingCtx?.meetingId ?? ""
          );
          meetingUuidRef.current = String(meetingCtx?.meetingUUID ?? "");
          const userId = meetingCtx?.userId ?? meetingCtx?.hostUserId;
          if (userId) userIdRef.current = String(userId);
          appendLog("info", `Meeting: ${meetingTopic ?? "(unnamed)"}`);
        } catch (err) {
          appendLog("warn", `Couldn't fetch meeting context: ${err}`);
        }

        meetingStartRef.current = Date.now();
        setStatus({ kind: "in_meeting", meetingTopic });

        await refreshWaitingRoomState();

        try {
          const result: any = await zoomSdk.getMeetingParticipants();
          const list = result?.participants ?? [];
          setParticipants(list);
          appendLog("info", `Initial participants: ${list.length}`);
          for (const p of list) {
            await detectParticipant(p);
          }
        } catch (err) {
          appendLog("warn", `Couldn't fetch participants: ${err}`);
        }

        zoomSdk.addEventListener("onParticipantChange", async (event: any) => {
          const changes = event?.participants ?? [];
          for (const p of changes) {
            const name = p.screenName ?? p.userName ?? "?";
            const action = p.action ?? p.status;
            const uuid = p.participantUUID;
            appendLog("info", `${action}: ${name}`);

            if (action === "leave" || action === "left") {
              setParticipants((prev) =>
                prev.filter((x) => x.participantUUID !== uuid)
              );
              detectedUUIDsRef.current.delete(uuid);
              setDetectedBots((prev) =>
                prev.filter((b) => b.participantUUID !== uuid)
              );
            } else {
              setParticipants((prev) => {
                const exists = prev.some((x) => x.participantUUID === uuid);
                return exists ? prev : [...prev, p];
              });
            }
            if (action === "join" || action === "joined") {
              await detectParticipant(p, true);
            }
          }
        });
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.message ?? String(err);
        if (
          msg.includes("not running") ||
          msg.includes("not configured") ||
          msg.toLowerCase().includes("zoom")
        ) {
          setStatus({ kind: "outside_zoom", message: msg });
        } else {
          setStatus({ kind: "error", message: msg });
          appendLog("error", msg);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (notifyTimerRef.current) {
        clearTimeout(notifyTimerRef.current);
        notifyTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick clock periodically for meeting elapsed
  const [, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const pendingCount = detectedBots.filter(
    (b) => b.status === "pending" || b.status === "failed"
  ).length;
  const resolvedCount = detectedBots.filter(
    (b) => b.status === "removed" || b.status === "waiting"
  ).length;
  const waitingRoomSelectable = waitingRoomEnabled !== false;
  const inMeeting = status.kind === "in_meeting";
  const meetingElapsed = formatElapsed(Date.now() - meetingStartRef.current);

  return (
    <main
      className="min-h-screen flex justify-center items-start font-sans"
      style={{ background: "var(--canvas-sand)", padding: 16 }}
    >
      {/* Error toast container — fixed bottom-right. Errors only; success
          actions are reflected via bot card status changes inside the
          Caught bots section, and the Zoom system notification handles
          new-bot alerts. */}
      <div
        className="fixed z-50 flex flex-col gap-2 pointer-events-none"
        style={{ bottom: 16, right: 16, maxWidth: 320 }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </div>

      <div
        className="rounded-2xl w-full"
        style={{
          maxWidth: 380,
          background: "var(--canvas-sand)",
          padding: "18px 16px 22px",
          boxShadow: "0 8px 32px -8px rgba(0,0,0,0.12)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2.5">
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "var(--sage-plum)",
                boxShadow: "var(--shadow-glow-indigo)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="shield-check" size={16} color="#fff" />
            </div>
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--ink-900)",
                  lineHeight: 1.1,
                }}
              >
                NoteBouncer
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--ink-500)",
                  marginTop: 1,
                  letterSpacing: "0.04em",
                }}
              >
                {COPY.sidebarVersion}
              </div>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {inMeeting ? (
          <>
            {/* Current meeting card */}
            <div className="glass-card mb-3.5" style={{ padding: 14 }}>
              <div className="tiny-label">{COPY.sidebarCurrentMeeting}</div>
              <div
                className="mt-1"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--ink-900)",
                  letterSpacing: "-0.01em",
                }}
              >
                {meetingTopicRef.current || "Current meeting"}
              </div>
              <div
                className="mt-2 flex items-center gap-2.5"
                style={{ fontSize: 11, color: "var(--ink-500)" }}
              >
                <span className="inline-flex items-center gap-1">
                  <Icon name="users" size={11} />
                  {participants.length}
                  {participants.length === 1 ? " participant" : " participants"}
                </span>
                <span
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: 99,
                    background: "var(--ink-400)",
                  }}
                />
                <span className="inline-flex items-center gap-1">
                  <Icon name="clock" size={11} />
                  {meetingElapsed}
                </span>
              </div>
            </div>

            {/* Action mode toggle */}
            <div className="mb-3.5">
              <div className="flex justify-between items-center mb-1.5">
                <div className="tiny-label">{COPY.sidebarActionLabel}</div>
                <button
                  onClick={refreshWaitingRoomState}
                  className="bg-transparent border-none cursor-pointer inline-flex items-center gap-1"
                  style={{ fontSize: 10, color: "var(--ink-500)" }}
                >
                  <Icon name="refresh" size={10} />
                  {COPY.sidebarRecheck}
                </button>
              </div>
              <div
                className="flex rounded-[10px]"
                style={{
                  background: "rgba(255,255,255,0.5)",
                  padding: 3,
                  border: "1px solid rgba(255,255,255,0.6)",
                }}
              >
                <ToggleButton
                  active={actionMode === "remove"}
                  onClick={() => setActionMode("remove")}
                  label={COPY.sidebarActionRemove}
                />
                <ToggleButton
                  active={actionMode === "waiting_room"}
                  onClick={() => {
                    if (waitingRoomSelectable) setActionMode("waiting_room");
                  }}
                  label={COPY.sidebarActionWaiting}
                  disabled={!waitingRoomSelectable}
                />
              </div>
              {!waitingRoomSelectable && (
                <p
                  className="mt-1.5"
                  style={{ fontSize: 11, color: "var(--ink-500)", lineHeight: 1.5 }}
                >
                  {COPY.sidebarWaitingRoomOff}{" "}
                  <button
                    onClick={refreshWaitingRoomState}
                    className="underline bg-transparent border-none cursor-pointer p-0"
                    style={{ color: "var(--ink-700)" }}
                  >
                    {COPY.sidebarRecheck}
                  </button>
                  .
                </p>
              )}
            </div>

            {/* Detected bots */}
            <div className="flex justify-between items-center mb-1.5">
              <div className="tiny-label">
                {COPY.sidebarDetectedHeader} · {pendingCount} pending
              </div>
              {resolvedCount > 0 && (
                <button
                  onClick={clearResolved}
                  className="bg-transparent border-none cursor-pointer"
                  style={{ fontSize: 10, color: "var(--ink-500)" }}
                >
                  {COPY.sidebarClearResolved}
                </button>
              )}
            </div>

            {pendingCount > 0 && (
              <button
                onClick={actOnAllPending}
                disabled={bulkRunning}
                className="w-full text-white border-none inline-flex items-center justify-center gap-1.5 mb-2.5"
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 500,
                  background:
                    actionMode === "remove"
                      ? "var(--ink-900)"
                      : "var(--sage-plum)",
                  boxShadow:
                    actionMode === "waiting_room"
                      ? "var(--shadow-glow-indigo)"
                      : "none",
                  cursor: bulkRunning ? "not-allowed" : "pointer",
                  opacity: bulkRunning ? 0.6 : 1,
                }}
              >
                {!bulkRunning && (
                  <Icon
                    name={actionMode === "remove" ? "trash" : "door-open"}
                    size={13}
                    color="#fff"
                  />
                )}
                {bulkRunning
                  ? "Working…"
                  : actionMode === "remove"
                    ? COPY.sidebarRemoveAll(pendingCount)
                    : COPY.sidebarSendAll(pendingCount)}
              </button>
            )}

            {detectedBots.length === 0 ? (
              <SidebarEmpty />
            ) : (
              <div className="flex flex-col gap-2 mb-4">
                {detectedBots.map((b) => (
                  <BotCard
                    key={b.participantUUID}
                    bot={b}
                    mode={actionMode}
                    onAct={() => actOnBot(b, actionMode)}
                    disabled={bulkRunning}
                  />
                ))}
              </div>
            )}

            {/* In meeting */}
            <div className="tiny-label mt-4">
              {COPY.sidebarParticipantsHeader} · {participants.length}
            </div>
            <div
              className="glass-card mt-1.5 mb-4"
              style={{
                padding: "8px 12px",
                maxHeight: 130,
                overflowY: "auto",
              }}
            >
              {participants.length === 0 ? (
                <div
                  className="py-2 text-center"
                  style={{ fontSize: 12, color: "var(--ink-500)" }}
                >
                  Waiting for participants…
                </div>
              ) : (
                participants.map((p, i) => {
                  const name =
                    p.screenName ?? p.userName ?? p.displayName ?? "(unknown)";
                  const isBot =
                    /otter|fireflies|krisp|fathom|notetaker|tl;?dv|granola|read\.?ai|fellow|avoma|sembly|spinach|meetgeek/i.test(
                      name
                    );
                  return (
                    <div
                      key={i}
                      className="flex justify-between items-center"
                      style={{
                        fontSize: 12,
                        padding: "5px 0",
                        borderBottom:
                          i < participants.length - 1
                            ? "1px solid var(--gray-100)"
                            : "none",
                        color: isBot ? "var(--ink-700)" : "var(--ink-800)",
                      }}
                    >
                      <span className="inline-flex items-center gap-2 truncate">
                        <Icon
                          name={isBot ? "bot" : "users"}
                          size={11}
                          color={isBot ? "var(--sage-plum)" : "var(--ink-500)"}
                        />
                        <span className="truncate">{name}</span>
                      </span>
                      {isBot && (
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--sage-plum)",
                            fontWeight: 500,
                            flexShrink: 0,
                            marginLeft: 6,
                          }}
                        >
                          bot
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <NonMeetingState status={status} />
        )}

        {/* Blocked participants — always visible, primary section
            after Caught bots. The host can review who's locked out
            of the meeting and click × to unblock anyone. */}
        <div className="tiny-label mt-6">Blocked</div>
        <div className="mt-1.5 mb-6">
          <BlockedList
            entries={blocklist}
            onRemove={removeFromBlocklist}
          />
        </div>

        {/* Activity log — developer-flavored event stream. Hidden by
            default; the toggle below opens it when needed for debugging. */}
        <button
          type="button"
          onClick={() => setShowActivityLog((v) => !v)}
          className="text-[11px] font-medium"
          style={{
            color: "var(--ink-500)",
            background: "transparent",
            border: 0,
            padding: "4px 0",
            cursor: "pointer",
            letterSpacing: "0.04em",
          }}
          aria-expanded={showActivityLog}
        >
          {showActivityLog ? "Hide activity log" : "Show activity log"}
        </button>
        {showActivityLog && (
          <div className="mt-2">
            <ActivityLog entries={logs} />
          </div>
        )}
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status.kind === "in_meeting") {
    return <StatusPill tone="emerald">{COPY.sidebarWatching}</StatusPill>;
  }
  if (status.kind === "loading") {
    return <StatusPill tone="slate">{COPY.sidebarConnecting}</StatusPill>;
  }
  if (status.kind === "main_client") {
    return <StatusPill tone="indigo">{COPY.sidebarIdle}</StatusPill>;
  }
  if (status.kind === "outside_zoom") {
    return <StatusPill tone="amber">{COPY.sidebarOutsideZoom}</StatusPill>;
  }
  return <StatusPill tone="rose">{COPY.sidebarError}</StatusPill>;
}

function NonMeetingState({ status }: { status: Status }) {
  if (status.kind === "loading") return null;
  let text = "";
  let tone: "outside" | "main" | "error" = "main";
  if (status.kind === "outside_zoom") {
    text = COPY.sidebarEmptyOutside;
    tone = "outside";
  } else if (status.kind === "main_client") {
    text = COPY.sidebarEmptyMainClient;
    tone = "main";
  } else if (status.kind === "error") {
    text = humanizeError(status.message);
    tone = "error";
  }
  return (
    <div
      className="glass-card mb-4 text-center"
      style={{ padding: 24, fontSize: 13, color: "var(--ink-600)" }}
    >
      <div
        className="mx-auto mb-3 rounded-xl flex items-center justify-center"
        style={{
          width: 44,
          height: 44,
          background:
            tone === "error" ? "var(--rose-100)" : "var(--sage-plum-50)",
          color: tone === "error" ? "#9F1239" : "var(--sage-plum)",
        }}
      >
        <Icon
          name={tone === "error" ? "x" : "shield-check"}
          size={22}
          color={tone === "error" ? "#9F1239" : "var(--sage-plum)"}
        />
      </div>
      <div style={{ lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}

function SidebarEmpty() {
  return (
    <div className="text-center py-6 px-2">
      <div
        className="mx-auto mb-3 rounded-2xl flex items-center justify-center"
        style={{
          width: 44,
          height: 44,
          background: "var(--sage-plum-50)",
          color: "var(--sage-plum)",
        }}
      >
        <Icon
          name="shield-check"
          size={22}
          color="var(--sage-plum)"
          stroke={1.5}
        />
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-600)",
          lineHeight: 1.5,
          maxWidth: 260,
          margin: "0 auto",
        }}
      >
        {COPY.sidebarEmptyWatching}
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 border-none"
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 500,
        background: active ? "#fff" : "transparent",
        color: active ? "var(--ink-900)" : "var(--ink-600)",
        boxShadow: active ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
    </button>
  );
}

function BotCard({
  bot,
  mode,
  onAct,
  disabled,
}: {
  bot: DetectedBot;
  mode: ActionMode;
  onAct: () => void;
  disabled: boolean;
}) {
  const palette = {
    pending: {
      bg: "rgba(255, 251, 235, 0.85)",
      border: "var(--amber-100)",
      stripe: "var(--amber-500)",
    },
    acting: {
      bg: "var(--indigo-50)",
      border: "var(--indigo-100)",
      stripe: "var(--indigo-500)",
    },
    removed: {
      bg: "var(--emerald-50)",
      border: "var(--emerald-100)",
      stripe: "var(--emerald-500)",
    },
    waiting: {
      bg: "var(--indigo-50)",
      border: "var(--indigo-100)",
      stripe: "var(--indigo-500)",
    },
    failed: {
      bg: "var(--rose-100)",
      border: "#fecdd3",
      stripe: "var(--rose-500)",
    },
  }[bot.status];

  return (
    <div
      className="relative overflow-hidden transition-colors"
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 12,
        padding: "10px 12px 10px 14px",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: palette.stripe,
        }}
      />
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div
            className="flex items-center gap-1.5 font-semibold"
            style={{ fontSize: 13, color: "var(--ink-900)" }}
          >
            <Icon name="bot" size={13} color="var(--ink-700)" />
            <span className="truncate">{bot.name}</span>
          </div>
          <div
            className="font-mono mt-0.5"
            style={{ fontSize: 11, color: "var(--ink-600)" }}
          >
            {bot.reason}
          </div>
          {bot.errorMessage && (
            <div
              className="mt-1"
              style={{ fontSize: 11, color: "#9F1239", lineHeight: 1.4 }}
              title={bot.errorMessage}
            >
              {humanizeError(bot.errorMessage)}
            </div>
          )}
        </div>
        {bot.status === "removed" && (
          <span
            className="font-mono inline-flex items-center gap-1 whitespace-nowrap"
            style={{ fontSize: 11, color: "var(--emerald-600)" }}
          >
            <Icon name="check" size={11} color="var(--emerald-600)" /> removed
          </span>
        )}
        {bot.status === "waiting" && (
          <span
            className="font-mono inline-flex items-center gap-1 whitespace-nowrap"
            style={{ fontSize: 11, color: "var(--indigo-600)" }}
          >
            <Icon name="hourglass" size={11} color="var(--indigo-600)" /> waiting
          </span>
        )}
        {bot.status === "acting" && (
          <span
            className="font-mono whitespace-nowrap"
            style={{ fontSize: 11, color: "var(--indigo-600)" }}
          >
            working…
          </span>
        )}
        {(bot.status === "pending" || bot.status === "failed") && (
          <button
            onClick={onAct}
            disabled={disabled}
            className="rounded-full text-white border-none whitespace-nowrap"
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: "5px 12px",
              background: "var(--ink-900)",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {bot.status === "failed"
              ? "Retry"
              : mode === "remove"
                ? "Remove"
                : "Wait"}
          </button>
        )}
      </div>
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  // Rose / error styling only — non-error toasts have been removed.
  const ROSE_BG = "var(--rose-100)";
  const ROSE_BORDER = "#fecdd3";
  const ROSE_FG = "#9F1239";

  return (
    <div
      className="rounded-xl flex items-center gap-2 pointer-events-auto animate-toast-in"
      style={{
        background: ROSE_BG,
        border: `1px solid ${ROSE_BORDER}`,
        boxShadow: "var(--shadow-float)",
        padding: "10px 14px",
        color: ROSE_FG,
        fontSize: 13,
        fontWeight: 500,
        lineHeight: 1.4,
      }}
    >
      <Icon name="x" size={14} color={ROSE_FG} />
      <span className="flex-1">{toast.text}</span>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-toast-in { animation: toast-in 200ms cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}

function BlockedList({
  entries,
  onRemove,
}: {
  entries: BlocklistEntry[];
  onRemove: (id: string) => void;
}) {
  // Empty state — explicit so the host knows the feature exists and
  // where blocked people will appear.
  if (entries.length === 0) {
    return (
      <div
        className="glass-card"
        style={{ padding: "16px 14px" }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--ink-700)",
          }}
        >
          No blocked participants yet
        </div>
        <div
          className="mt-1"
          style={{
            fontSize: 11,
            color: "var(--ink-500)",
            lineHeight: 1.5,
          }}
        >
          Removed bots appear here. Click × to unblock.
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: 6 }}>
      {entries.map((entry) => (
        <BlockedEntryRow
          key={entry.id}
          entry={entry}
          onRemove={() => onRemove(entry.id)}
        />
      ))}
    </div>
  );
}

function BlockedEntryRow({
  entry,
  onRemove,
}: {
  entry: BlocklistEntry;
  onRemove: () => void;
}) {
  // "Just kicked" highlight — amber for 5 seconds after a matching
  // auto-kick. We check the timestamp inline so adjacent rows update
  // independently and no global re-render hook is needed.
  const isJustKicked =
    entry.lastKickedAt !== null && Date.now() - entry.lastKickedAt < 5000;

  const subtitle = entry.domain
    ? `· ${entry.domain}`
    : entry.email
    ? `· ${entry.email}`
    : null;

  return (
    <div
      className="flex items-center justify-between rounded-lg"
      style={{
        padding: "8px 10px 8px 12px",
        background: isJustKicked ? "var(--amber-50)" : "transparent",
        borderLeft: isJustKicked
          ? "3px solid var(--amber-500)"
          : "3px solid transparent",
        transition: "background-color 200ms ease, border-color 200ms ease",
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--ink-900)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {entry.displayName}
          </span>
          {subtitle && (
            <span
              style={{
                fontSize: 11,
                color: "var(--ink-500)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
            >
              {subtitle}
            </span>
          )}
          {isJustKicked && (
            <StatusPill tone="amber" showDot={false}>
              Just kicked
            </StatusPill>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Unblock ${entry.displayName}`}
        title="Unblock"
        className="flex-shrink-0"
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          border: 0,
          background: "transparent",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-500)",
          marginLeft: 8,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--rose-100)";
          e.currentTarget.style.color = "#9F1239";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--ink-500)";
        }}
      >
        <Icon name="x" size={14} color="currentColor" />
      </button>
    </div>
  );
}

function ActivityLog({ entries }: { entries: LogEntry[] }) {
  const colors: Record<LogEntry["level"], string> = {
    info: "var(--ink-600)",
    warn: "#B45309",
    error: "#9F1239",
    success: "var(--emerald-600)",
  };
  const dots: Record<LogEntry["level"], string> = {
    info: "var(--slate-400)",
    warn: "var(--amber-500)",
    error: "var(--rose-500)",
    success: "var(--emerald-500)",
  };
  return (
    <div
      className="glass-card"
      style={{ padding: 4, maxHeight: 230, overflowY: "auto" }}
    >
      {entries.length === 0 ? (
        <div
          className="px-3 py-2"
          style={{ fontSize: 11, color: "var(--ink-500)" }}
        >
          Initialising…
        </div>
      ) : (
        entries.map((e, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5"
            style={{
              padding: "7px 12px",
              borderBottom:
                i < entries.length - 1
                  ? "1px solid var(--gray-100)"
                  : "none",
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 99,
                background: dots[e.level],
                marginTop: 7,
                flexShrink: 0,
              }}
            />
            <div className="min-w-0 flex-1">
              <div style={{ fontSize: 11.5, lineHeight: 1.45, color: colors[e.level] }}>
                {e.text}
              </div>
              <div
                className="font-mono mt-0.5"
                style={{ fontSize: 10, color: "var(--ink-500)" }}
              >
                {new Date(e.ts).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}`;
  return `${m}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
