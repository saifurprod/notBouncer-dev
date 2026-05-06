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

type RemovalRecord = {
  name: string;
  reason: string;
  at: number;
  status: "removed" | "failed";
  error?: string;
};

export default function ZoomHomePage() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [participants, setParticipants] = useState<any[]>([]);
  const [removals, setRemovals] = useState<RemovalRecord[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [config] = useState<DetectionConfig>(DEFAULT_CONFIG);
  const userIdRef = useRef<string | null>(null);
  const sdkRef = useRef<any>(null);

  function appendLog(level: LogEntry["level"], text: string) {
    setLogs((prev) =>
      [{ ts: Date.now(), level, text }, ...prev].slice(0, 100)
    );
  }

  // Sync events back to the Vercel backend so the dashboard sees them
  async function syncEvent(payload: {
    meetingId: string;
    meetingUuid?: string;
    participantName: string;
    participantEmail?: string;
    participantZoomId?: string;
    matchReason: string;
    action: "detected" | "removed" | "remove_failed";
    errorMessage?: string;
    latencyMs?: number;
  }) {
    if (!userIdRef.current) {
      appendLog("warn", "Cannot sync event: user ID not yet known");
      return;
    }
    try {
      await fetch("/api/sidebar/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zoomUserId: userIdRef.current,
          ...payload,
        }),
      });
    } catch (err) {
      appendLog("warn", `Sync failed: ${(err as Error).message}`);
    }
  }

  // Process a participant — detect and remove if bot
  async function processParticipant(p: any, meetingId: string) {
    const name = p.screenName ?? p.userName ?? p.displayName ?? "";
    const email = p.email ?? null;
    if (!name) return;

    const result = detect(
      {
        name,
        email,
        zoomUserId: p.participantUUID ?? p.userId,
        isGuest: !email,
      },
      config
    );

    if (!result.match) return;

    const detectedAt = Date.now();
    appendLog("warn", `Bot detected: ${name} (${result.reason})`);

    // Try to remove
    const sdk = sdkRef.current;
    if (!sdk) {
      appendLog("error", "SDK not available — can't remove");
      return;
    }

    try {
      // Try the Zoom Apps SDK removeParticipant call
      await sdk.removeParticipant({
        participantUUID: p.participantUUID,
      });
      const latencyMs = Date.now() - detectedAt;
      appendLog("success", `Removed: ${name} (${latencyMs}ms)`);
      setRemovals((prev) =>
        [
          {
            name,
            reason: result.reason,
            at: detectedAt,
            status: "removed" as const,
          },
          ...prev,
        ].slice(0, 50)
      );
      await syncEvent({
        meetingId,
        participantName: name,
        participantEmail: email ?? undefined,
        participantZoomId: p.participantUUID,
        matchReason: result.reason,
        action: "removed",
        latencyMs,
      });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      appendLog("error", `Remove failed for ${name}: ${msg}`);
      setRemovals((prev) =>
        [
          {
            name,
            reason: result.reason,
            at: detectedAt,
            status: "failed",
            error: msg,
          },
          ...prev,
        ].slice(0, 50)
      );
      await syncEvent({
        meetingId,
        participantName: name,
        participantEmail: email ?? undefined,
        participantZoomId: p.participantUUID,
        matchReason: result.reason,
        action: "remove_failed",
        errorMessage: msg,
      });
    }
  }

  useEffect(() => {
    let cancelled = false;
    let currentMeetingId = "";

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

        // Get meeting info
        let meetingTopic: string | undefined;
        try {
          const meetingCtx: any = await zoomSdk.getMeetingContext();
          meetingTopic = meetingCtx?.meetingTopic;
          currentMeetingId = String(
            meetingCtx?.meetingID ?? meetingCtx?.meetingId ?? ""
          );
          // Try to get the host's user ID from context too
          const userId = meetingCtx?.userId ?? meetingCtx?.hostUserId;
          if (userId) userIdRef.current = String(userId);
          appendLog("info", `Meeting: ${meetingTopic ?? "(unnamed)"}`);
        } catch (err) {
          appendLog("warn", `Couldn't fetch meeting context: ${err}`);
        }

        setStatus({ kind: "in_meeting", meetingTopic });

        // Get current participants
        try {
          const result: any = await zoomSdk.getMeetingParticipants();
          const list = result?.participants ?? [];
          setParticipants(list);
          appendLog("info", `Initial participants: ${list.length}`);
          // Run detection on existing participants
          for (const p of list) {
            await processParticipant(p, currentMeetingId);
          }
        } catch (err) {
          appendLog("warn", `Couldn't fetch participants: ${err}`);
        }

        // Subscribe to participant changes
        zoomSdk.addEventListener("onParticipantChange", async (event: any) => {
          const changes = event?.participants ?? [];
          for (const p of changes) {
            const name = p.screenName ?? p.userName ?? "?";
            const action = p.action ?? p.status;
            appendLog("info", `${action}: ${name}`);
            // Update participants list
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
            // Detect on join
            if (action === "join" || action === "joined") {
              await processParticipant(p, currentMeetingId);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 p-5 font-sans">
      <header className="mb-5 pb-3 border-b border-stone-200">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
          Sidebar
        </p>
        <h1 className="font-display text-2xl mt-0.5">NoteBouncer</h1>
      </header>

      <section className="mb-5">
        <StatusBadge status={status} />
      </section>

      {status.kind === "in_meeting" && (
        <>
          <section className="mb-5">
            <h2 className="text-xs font-medium uppercase tracking-wider text-stone-500 mb-2">
              In meeting ({participants.length})
            </h2>
            {participants.length === 0 ? (
              <p className="text-sm text-stone-500">
                Watching for new participants…
              </p>
            ) : (
              <ul className="text-sm space-y-1 bg-white border border-stone-200 rounded p-2">
                {participants.map((p, i) => (
                  <li key={i} className="text-stone-700 truncate">
                    {p.screenName ?? p.userName ?? "(unknown)"}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mb-5">
            <h2 className="text-xs font-medium uppercase tracking-wider text-stone-500 mb-2">
              Removals this meeting ({removals.length})
            </h2>
            {removals.length === 0 ? (
              <p className="text-sm text-stone-500">No bots removed yet.</p>
            ) : (
              <ul className="text-sm space-y-2">
                {removals.map((r, i) => (
                  <li
                    key={i}
                    className={`rounded border p-2 ${
                      r.status === "removed"
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs font-mono text-stone-600 mt-0.5">
                      {r.reason}
                    </div>
                    {r.error && (
                      <div className="text-xs text-red-700 mt-1">
                        {r.error}
                      </div>
                    )}
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
        <div className="bg-stone-900 text-stone-100 rounded p-2 font-mono text-[11px] leading-relaxed max-h-64 overflow-auto">
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
      "Connected to Zoom. Open during a meeting to enable auto-removal.",
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
