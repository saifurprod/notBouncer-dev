"use client";

import { useEffect, useRef, useState } from "react";
import { detect, DetectionConfig, DEFAULT_CONFIG } from "@/lib/detection";

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
  // pending: not yet acted on
  // acting: action in flight
  // removed: kicked from meeting
  // waiting: moved to waiting room
  // failed: tried and failed
  status: "pending" | "acting" | "removed" | "waiting" | "failed";
  errorMessage?: string;
};

export default function ZoomHomePage() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [participants, setParticipants] = useState<any[]>([]);
  const [detectedBots, setDetectedBots] = useState<DetectedBot[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode>("remove");
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState<boolean | null>(null);
  const [config] = useState<DetectionConfig>(DEFAULT_CONFIG);
  const userIdRef = useRef<string | null>(null);
  const sdkRef = useRef<any>(null);
  const meetingIdRef = useRef<string>("");
  const meetingUuidRef = useRef<string>("");
  const detectedUUIDsRef = useRef<Set<string>>(new Set());

  function appendLog(level: LogEntry["level"], text: string) {
    setLogs((prev) =>
      [{ ts: Date.now(), level, text }, ...prev].slice(0, 100)
    );
  }

  // Sync events back to the Vercel backend (logs to dashboard)
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

  // Detect a participant — does not act, just adds to pending list
  async function detectParticipant(p: any) {
    const name = p.screenName ?? p.userName ?? p.displayName ?? "";
    const email = p.email ?? null;
    const uuid = p.participantUUID ?? p.userId;
    if (!name || !uuid) return;

    if (detectedUUIDsRef.current.has(uuid)) return;

    const result = detect(
      { name, email, zoomUserId: uuid, isGuest: !email },
      config
    );
    if (!result.match) return;

    detectedUUIDsRef.current.add(uuid);
    appendLog("warn", `Bot detected: ${name} (${result.reason})`);

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

  // Act on a single bot using the current actionMode
  async function actOnBot(bot: DetectedBot, mode: ActionMode) {
    const sdk = sdkRef.current;
    if (!sdk) {
      appendLog("error", "SDK not available");
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
      } else {
        await sdk.putParticipantToWaitingRoom({
          participantUUID: bot.participantUUID,
        });
        const latencyMs = Date.now() - startedAt;
        appendLog("success", `Sent to waiting room: ${bot.name} (${latencyMs}ms)`);

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
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      appendLog("error", `Action failed for ${bot.name}: ${msg}`);

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

  // Act on all pending bots using current actionMode
  async function actOnAllPending() {
    const pending = detectedBots.filter(
      (b) => b.status === "pending" || b.status === "failed"
    );
    if (pending.length === 0) return;

    // If sending to waiting room but it's off, stop and tell the host
    if (actionMode === "waiting_room" && waitingRoomEnabled === false) {
      appendLog(
        "error",
        "Waiting room is disabled in this meeting. Enable it in Zoom's security menu first, or switch to 'remove from meeting'."
      );
      return;
    }

    setBulkRunning(true);
    const verb = actionMode === "remove" ? "Removing" : "Sending to waiting room";
    appendLog("info", `${verb} ${pending.length} bot(s)…`);

    for (const bot of pending) {
      await actOnBot(bot, actionMode);
    }

    setBulkRunning(false);
    appendLog("info", `Bulk action complete`);
  }

  // Read waiting room state from SDK. Tries every plausible response shape
  // and logs the raw response so we can see exactly what Zoom sent back.
  async function refreshWaitingRoomState() {
    const sdk = sdkRef.current;
    if (!sdk) return;
    try {
      const wrState: any = await sdk.getWaitingRoomState();
      // Log the raw shape so we can see what Zoom actually returns on
      // this particular client/version
      appendLog(
        "info",
        `Waiting room raw: ${JSON.stringify(wrState).slice(0, 200)}`
      );
      // Try every field name the SDK has used historically
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
          enabled = c.toLowerCase() === "enabled" || c.toLowerCase() === "on" || c === "true";
          break;
        }
      }
      // Bare boolean response
      if (enabled === null && typeof wrState === "boolean") {
        enabled = wrState;
      }
      // If SDK returned anything truthy at all and we couldn't parse,
      // err on the side of "enabled" — the user said it's on
      if (enabled === null && wrState && typeof wrState === "object") {
        appendLog(
          "warn",
          "Waiting room state shape unrecognized; defaulting to enabled"
        );
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
        `Couldn't read waiting room state: ${err?.message ?? err}`
      );
      setWaitingRoomEnabled(null);
    }
  }

  function clearResolved() {
    setDetectedBots((prev) =>
      prev.filter((b) => b.status !== "removed" && b.status !== "waiting")
    );
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

        setStatus({ kind: "in_meeting", meetingTopic });

        // Check waiting room state initially
        await refreshWaitingRoomState();

        // Get current participants and detect
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

        zoomSdk.addEventListener(
          "onParticipantChange",
          async (event: any) => {
            const changes = event?.participants ?? [];
            for (const p of changes) {
              const name = p.screenName ?? p.userName ?? "?";
              const action = p.action ?? p.status;
              const uuid = p.participantUUID;
              appendLog("info", `${action}: ${name}`);

              if (action === "leave" || action === "left") {
                // Drop from current participants list
                setParticipants((prev) =>
                  prev.filter((x) => x.participantUUID !== uuid)
                );
                // CRITICAL: forget that we've detected this UUID, so if
                // they re-join (after being admitted back from waiting
                // room, or rejoining themselves) we detect them again.
                detectedUUIDsRef.current.delete(uuid);
                // Also drop the stale entry from the detected list so we
                // don't keep a "removed" or "waiting" card around for a
                // participant who isn't there anymore.
                setDetectedBots((prev) =>
                  prev.filter((b) => b.participantUUID !== uuid)
                );
              } else {
                setParticipants((prev) => {
                  const exists = prev.some(
                    (x) => x.participantUUID === uuid
                  );
                  return exists ? prev : [...prev, p];
                });
              }

              if (action === "join" || action === "joined") {
                await detectParticipant(p);
              }
            }
          }
        );
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingCount = detectedBots.filter(
    (b) => b.status === "pending" || b.status === "failed"
  ).length;
  const resolvedCount = detectedBots.filter(
    (b) => b.status === "removed" || b.status === "waiting"
  ).length;

  // Whether the waiting-room mode is selectable. If the SDK couldn't read
  // the state (null), we still allow it — call may succeed.
  const waitingRoomSelectable = waitingRoomEnabled !== false;

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 p-5 font-sans">
      <header className="mb-4 pb-3 border-b border-stone-200">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
          Sidebar
        </p>
        <h1 className="font-display text-2xl mt-0.5">NoteBouncer</h1>
      </header>

      <section className="mb-4">
        <StatusBadge status={status} />
      </section>

      {status.kind === "in_meeting" && (
        <>
          {/* Action mode toggle */}
          <section className="mb-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-xs font-medium uppercase tracking-wider text-stone-500">
                Action when removing
              </h2>
              <button
                onClick={refreshWaitingRoomState}
                className="text-xs text-stone-500 hover:text-stone-800 underline"
                title="Re-check waiting room state from Zoom"
              >
                Recheck
              </button>
            </div>
            <div className="flex bg-stone-100 rounded-md p-1 gap-1">
              <ToggleButton
                active={actionMode === "remove"}
                onClick={() => setActionMode("remove")}
                label="Remove from meeting"
              />
              <ToggleButton
                active={actionMode === "waiting_room"}
                onClick={() => {
                  if (waitingRoomSelectable) setActionMode("waiting_room");
                }}
                label="Send to waiting room"
                disabled={!waitingRoomSelectable}
                title={
                  !waitingRoomSelectable
                    ? "Waiting room is disabled in this meeting"
                    : undefined
                }
              />
            </div>
            {!waitingRoomSelectable && (
              <p className="text-xs text-stone-500 mt-1.5">
                Waiting room appears disabled. If you just enabled it, click{" "}
                <button
                  onClick={refreshWaitingRoomState}
                  className="underline hover:text-stone-800"
                >
                  Recheck
                </button>
                .
              </p>
            )}
          </section>

          {/* Detected bots */}
          <section className="mb-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-xs font-medium uppercase tracking-wider text-stone-500">
                Detected bots ({pendingCount} pending)
              </h2>
              {resolvedCount > 0 && (
                <button
                  onClick={clearResolved}
                  className="text-xs text-stone-500 hover:text-stone-800 underline"
                >
                  Clear resolved
                </button>
              )}
            </div>

            {detectedBots.length === 0 ? (
              <p className="text-sm text-stone-500 py-2">
                Watching for notetaker bots…
              </p>
            ) : (
              <>
                {pendingCount > 0 && (
                  <button
                    onClick={actOnAllPending}
                    disabled={bulkRunning}
                    className={`w-full mb-2 rounded-md text-white text-sm font-medium py-2 px-3 transition ${
                      actionMode === "remove"
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-amber-600 hover:bg-amber-700"
                    } disabled:bg-stone-400 disabled:cursor-not-allowed`}
                  >
                    {bulkRunning
                      ? "Working…"
                      : actionMode === "remove"
                        ? `Remove all bots (${pendingCount})`
                        : `Send all to waiting room (${pendingCount})`}
                  </button>
                )}

                <ul className="space-y-2">
                  {detectedBots.map((bot) => (
                    <li
                      key={bot.participantUUID}
                      className={`rounded border p-2 ${cardColor(bot.status)}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">
                            {bot.name}
                          </div>
                          <div className="text-xs font-mono text-stone-600 mt-0.5">
                            {bot.reason}
                          </div>
                          {bot.errorMessage && (
                            <div className="text-xs text-red-700 mt-1 break-words">
                              {bot.errorMessage}
                            </div>
                          )}
                        </div>
                        <BotAction
                          bot={bot}
                          actionMode={actionMode}
                          onAct={() => actOnBot(bot, actionMode)}
                          disabled={bulkRunning}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="mb-4">
            <h2 className="text-xs font-medium uppercase tracking-wider text-stone-500 mb-2">
              In meeting ({participants.length})
            </h2>
            {participants.length === 0 ? (
              <p className="text-sm text-stone-500">No participants yet.</p>
            ) : (
              <ul className="text-sm space-y-1 bg-white border border-stone-200 rounded p-2 max-h-40 overflow-auto">
                {participants.map((p, i) => (
                  <li key={i} className="text-stone-700 truncate">
                    {p.screenName ?? p.userName ?? "(unknown)"}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section>
        <h2 className="text-xs font-medium uppercase tracking-wider text-stone-500 mb-2">
          Activity log
        </h2>
        <div className="bg-stone-900 text-stone-100 rounded p-2 font-mono text-[11px] leading-relaxed max-h-56 overflow-auto">
          {logs.length === 0 ? (
            <p className="text-stone-500">Initialising…</p>
          ) : (
            logs.map((entry, i) => (
              <div
                key={i}
                className={
                  entry.level === "error"
                    ? "text-red-300"
                    : entry.level === "warn"
                      ? "text-amber-300"
                      : entry.level === "success"
                        ? "text-emerald-300"
                        : "text-stone-300"
                }
              >
                [{new Date(entry.ts).toLocaleTimeString()}] {entry.text}
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<string, string> = {
    loading: "bg-stone-100 text-stone-700 border-stone-300",
    outside_zoom: "bg-amber-50 text-amber-800 border-amber-200",
    main_client: "bg-blue-50 text-blue-800 border-blue-200",
    in_meeting: "bg-emerald-50 text-emerald-800 border-emerald-200",
    error: "bg-red-50 text-red-800 border-red-200",
  };
  const messages: Record<string, string> = {
    loading: "Connecting to Zoom client…",
    outside_zoom:
      status.kind === "outside_zoom"
        ? `Not running inside Zoom. ${status.message?.slice(0, 80) ?? ""}`
        : "Open this from Zoom's Apps panel.",
    main_client:
      "Connected to Zoom. Open during a meeting to enable bot removal.",
    in_meeting:
      status.kind === "in_meeting"
        ? `Watching: ${status.meetingTopic ?? "current meeting"}`
        : "",
    error: status.kind === "error" ? `Error: ${status.message}` : "",
  };
  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm ${styles[status.kind]}`}
    >
      {messages[status.kind]}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  disabled,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex-1 text-xs font-medium py-1.5 px-2 rounded transition ${
        active
          ? "bg-white text-stone-900 shadow-sm"
          : "text-stone-600 hover:text-stone-900"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      {label}
    </button>
  );
}

function cardColor(s: DetectedBot["status"]): string {
  switch (s) {
    case "pending":
      return "bg-amber-50 border-amber-200";
    case "acting":
      return "bg-blue-50 border-blue-200";
    case "removed":
      return "bg-emerald-50 border-emerald-200";
    case "waiting":
      return "bg-emerald-50 border-emerald-200";
    case "failed":
      return "bg-red-50 border-red-200";
  }
}

function BotAction({
  bot,
  actionMode,
  onAct,
  disabled,
}: {
  bot: DetectedBot;
  actionMode: ActionMode;
  onAct: () => void;
  disabled: boolean;
}) {
  if (bot.status === "removed") {
    return (
      <span className="text-xs font-mono text-emerald-700 whitespace-nowrap">
        ✓ removed
      </span>
    );
  }
  if (bot.status === "waiting") {
    return (
      <span className="text-xs font-mono text-emerald-700 whitespace-nowrap">
        ✓ waiting
      </span>
    );
  }
  if (bot.status === "acting") {
    return (
      <span className="text-xs font-mono text-blue-700 whitespace-nowrap">
        working…
      </span>
    );
  }
  const label =
    bot.status === "failed"
      ? "Retry"
      : actionMode === "remove"
        ? "Remove"
        : "Wait";
  const cls =
    actionMode === "remove"
      ? "bg-stone-900 hover:bg-stone-700"
      : "bg-amber-700 hover:bg-amber-800";
  return (
    <button
      onClick={onAct}
      disabled={disabled}
      className={`text-xs font-medium px-2 py-1 rounded text-white transition whitespace-nowrap ${cls} disabled:bg-stone-400 disabled:cursor-not-allowed`}
    >
      {label}
    </button>
  );
}
