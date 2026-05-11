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

// A bot we've detected. Stays in the list until the host removes it
// (or removal fails). status tracks the lifecycle.
type DetectedBot = {
  participantUUID: string;
  name: string;
  email: string | null;
  reason: string;
  detectedAt: number;
  // pending: not yet acted on
  // removing: removal in flight
  // removed: successfully kicked
  // failed: tried and failed
  status: "pending" | "removing" | "removed" | "failed";
  errorMessage?: string;
};

export default function ZoomHomePage() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [participants, setParticipants] = useState<any[]>([]);
  const [detectedBots, setDetectedBots] = useState<DetectedBot[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [bulkRemoving, setBulkRemoving] = useState(false);
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
    action: "detected" | "removed" | "remove_failed";
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

  // When a participant joins/exists: detect, log, and add to the pending list.
  // Does NOT remove — that's manual.
  async function detectParticipant(p: any) {
    const name = p.screenName ?? p.userName ?? p.displayName ?? "";
    const email = p.email ?? null;
    const uuid = p.participantUUID ?? p.userId;
    if (!name || !uuid) return;

    // Avoid duplicate entries if the SDK fires the same join twice
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

    // Log detection to the dashboard
    await syncEvent({
      participantName: name,
      participantEmail: email ?? undefined,
      participantZoomId: uuid,
      matchReason: result.reason,
      action: "detected",
    });
  }

  // Remove a single bot via the SDK. Updates state and syncs result.
  async function removeBot(bot: DetectedBot) {
    const sdk = sdkRef.current;
    if (!sdk) {
      appendLog("error", "SDK not available — can't remove");
      return;
    }

    // Don't double-remove
    if (bot.status !== "pending" && bot.status !== "failed") return;

    setDetectedBots((prev) =>
      prev.map((b) =>
        b.participantUUID === bot.participantUUID
          ? { ...b, status: "removing" as const, errorMessage: undefined }
          : b
      )
    );

    const startedAt = Date.now();

    try {
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
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      appendLog("error", `Remove failed for ${bot.name}: ${msg}`);

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
        errorMessage: msg,
      });
    }
  }

  // Remove all pending bots in sequence
  async function removeAllPending() {
    const pending = detectedBots.filter(
      (b) => b.status === "pending" || b.status === "failed"
    );
    if (pending.length === 0) return;

    setBulkRemoving(true);
    appendLog("info", `Removing ${pending.length} bot(s)…`);

    for (const bot of pending) {
      await removeBot(bot);
    }

    setBulkRemoving(false);
    appendLog("info", `Bulk removal complete`);
  }

  function clearRemoved() {
    setDetectedBots((prev) => prev.filter((b) => b.status !== "removed"));
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

        // Get current participants and run detection
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

        // Subscribe to participant changes
        zoomSdk.addEventListener(
          "onParticipantChange",
          async (event: any) => {
            const changes = event?.participants ?? [];
            for (const p of changes) {
              const name = p.screenName ?? p.userName ?? "?";
              const action = p.action ?? p.status;
              appendLog("info", `${action}: ${name}`);

              setParticipants((prev) => {
                if (action === "leave" || action === "left") {
                  return prev.filter(
                    (x) => x.participantUUID !== p.participantUUID
                  );
                }
                const exists = prev.some(
                  (x) => x.participantUUID === p.participantUUID
                );
                return exists ? prev : [...prev, p];
              });

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
  const removedCount = detectedBots.filter((b) => b.status === "removed").length;

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
          {/* Bulk action */}
          <section className="mb-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-xs font-medium uppercase tracking-wider text-stone-500">
                Detected bots ({pendingCount} pending)
              </h2>
              {removedCount > 0 && (
                <button
                  onClick={clearRemoved}
                  className="text-xs text-stone-500 hover:text-stone-800 underline"
                >
                  Clear removed
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
                    onClick={removeAllPending}
                    disabled={bulkRemoving}
                    className="w-full mb-2 rounded-md bg-red-600 hover:bg-red-700 disabled:bg-stone-400 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-3 transition"
                  >
                    {bulkRemoving
                      ? `Removing…`
                      : `Remove all bots (${pendingCount})`}
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
                          onRemove={() => removeBot(bot)}
                          disabled={bulkRemoving}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* All participants (read-only) */}
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

      {/* Activity log */}
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

function cardColor(s: DetectedBot["status"]): string {
  switch (s) {
    case "pending":
      return "bg-amber-50 border-amber-200";
    case "removing":
      return "bg-blue-50 border-blue-200";
    case "removed":
      return "bg-emerald-50 border-emerald-200";
    case "failed":
      return "bg-red-50 border-red-200";
  }
}

function BotAction({
  bot,
  onRemove,
  disabled,
}: {
  bot: DetectedBot;
  onRemove: () => void;
  disabled: boolean;
}) {
  if (bot.status === "removed") {
    return (
      <span className="text-xs font-mono text-emerald-700 whitespace-nowrap">
        ✓ removed
      </span>
    );
  }
  if (bot.status === "removing") {
    return (
      <span className="text-xs font-mono text-blue-700 whitespace-nowrap">
        removing…
      </span>
    );
  }
  return (
    <button
      onClick={onRemove}
      disabled={disabled}
      className="text-xs font-medium px-2 py-1 rounded bg-stone-900 text-white hover:bg-stone-700 disabled:bg-stone-400 disabled:cursor-not-allowed transition whitespace-nowrap"
    >
      {bot.status === "failed" ? "Retry" : "Remove"}
    </button>
  );
}