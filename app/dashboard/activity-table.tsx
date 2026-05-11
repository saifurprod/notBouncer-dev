"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/lib/ui/icons";
import { StatusPill, TONE_FOR_ACTION } from "@/lib/ui/components";

export type ActivityRow = {
  id: string;
  when: string; // ISO string
  whenFormatted: string; // pre-formatted for display
  name: string | null;
  email: string | null;
  reason: string;
  action: string;
  source: string;
  latency: number | null;
  error: string | null;
};

export function ActivityTable({ rows }: { rows: ActivityRow[] }) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
      return true;
    });
  }, [rows, actionFilter, sourceFilter]);

  function exportCsv() {
    const header = [
      "when",
      "name",
      "email",
      "reason",
      "action",
      "source",
      "latency_ms",
      "error",
    ];
    const escape = (v: any) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [
      header.join(","),
      ...filtered.map((r) =>
        [
          r.when,
          r.name ?? "",
          r.email ?? "",
          r.reason,
          r.action,
          r.source,
          r.latency ?? "",
          r.error ?? "",
        ]
          .map(escape)
          .join(",")
      ),
    ];
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notebouncer-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasFilters = actionFilter !== "all" || sourceFilter !== "all";

  return (
    <div className="glass-card p-7">
      <div className="flex justify-between items-start mb-1">
        <div>
          <div
            className="font-bold"
            style={{ fontSize: 18, color: "var(--ink-900)" }}
          >
            Activity
          </div>
          <div
            className="mt-1"
            style={{ fontSize: 13, color: "var(--ink-600)" }}
          >
            Every detection and removal across your hosts, newest first
          </div>
        </div>
        <div className="flex gap-2 relative">
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className="rounded-full bg-white cursor-pointer inline-flex items-center gap-1.5"
            style={{
              fontSize: 12,
              fontWeight: 500,
              padding: "7px 12px",
              border: hasFilters
                ? "1px solid var(--sage-plum)"
                : "1px solid var(--gray-200)",
              color: hasFilters ? "var(--sage-plum)" : "var(--ink-700)",
            }}
          >
            <Icon name="filter" size={12} />
            Filter
            {hasFilters && (
              <span
                className="rounded-full"
                style={{
                  background: "var(--sage-plum)",
                  color: "#fff",
                  fontSize: 10,
                  padding: "1px 5px",
                  marginLeft: 2,
                }}
              >
                on
              </span>
            )}
          </button>
          <button
            onClick={exportCsv}
            className="rounded-full bg-white cursor-pointer inline-flex items-center gap-1.5"
            style={{
              fontSize: 12,
              fontWeight: 500,
              padding: "7px 12px",
              border: "1px solid var(--gray-200)",
              color: "var(--ink-700)",
            }}
          >
            <Icon name="download" size={12} />
            Export
          </button>

          {filterOpen && (
            <div
              className="absolute right-0 top-10 z-10 rounded-xl p-4"
              style={{
                background: "#fff",
                border: "1px solid var(--gray-200)",
                boxShadow: "var(--shadow-float)",
                minWidth: 240,
              }}
            >
              <div className="mb-3">
                <div
                  className="mb-2 uppercase tracking-[0.06em]"
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: "var(--ink-500)",
                  }}
                >
                  Action
                </div>
                <div className="flex flex-wrap gap-1">
                  {["all", "detected", "removed", "moved_to_waiting_room", "remove_failed"].map(
                    (a) => (
                      <button
                        key={a}
                        onClick={() => setActionFilter(a)}
                        className="rounded-full"
                        style={{
                          fontSize: 11,
                          padding: "4px 10px",
                          background:
                            actionFilter === a
                              ? "var(--sage-plum)"
                              : "var(--gray-100)",
                          color:
                            actionFilter === a ? "#fff" : "var(--ink-700)",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        {a === "moved_to_waiting_room"
                          ? "Waiting room"
                          : a === "remove_failed"
                            ? "Failed"
                            : a.charAt(0).toUpperCase() + a.slice(1)}
                      </button>
                    )
                  )}
                </div>
              </div>
              <div className="mb-3">
                <div
                  className="mb-2 uppercase tracking-[0.06em]"
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: "var(--ink-500)",
                  }}
                >
                  Source
                </div>
                <div className="flex gap-1">
                  {["all", "webhook", "sidebar"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSourceFilter(s)}
                      className="rounded-full"
                      style={{
                        fontSize: 11,
                        padding: "4px 10px",
                        background:
                          sourceFilter === s
                            ? "var(--sage-plum)"
                            : "var(--gray-100)",
                        color: sourceFilter === s ? "#fff" : "var(--ink-700)",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t" style={{ borderColor: "var(--gray-100)" }}>
                <button
                  onClick={() => {
                    setActionFilter("all");
                    setSourceFilter("all");
                  }}
                  className="text-xs underline"
                  style={{ color: "var(--ink-500)", background: "none", border: "none", cursor: "pointer" }}
                >
                  Clear
                </button>
                <button
                  onClick={() => setFilterOpen(false)}
                  className="rounded-full text-white"
                  style={{
                    background: "var(--ink-900)",
                    fontSize: 11,
                    padding: "5px 12px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className="mt-[22px] rounded-xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.7)",
          border: "1px solid rgba(255,255,255,0.6)",
        }}
      >
        <div
          className="grid uppercase tracking-[0.06em]"
          style={{
            gridTemplateColumns: "170px 1.4fr 1fr 130px 90px 70px",
            gap: 12,
            padding: "12px 18px",
            borderBottom: "1px solid var(--gray-200)",
            fontSize: 11,
            fontWeight: 500,
            color: "var(--ink-500)",
          }}
        >
          <div>When</div>
          <div>Bot</div>
          <div>Reason</div>
          <div>Action</div>
          <div>Source</div>
          <div className="text-right">Latency</div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center" style={{ padding: 48, color: "var(--ink-500)" }}>
            {rows.length === 0
              ? "No activity yet. When a bot joins one of your meetings, it'll show here."
              : "No activity matches the current filters."}
          </div>
        ) : (
          filtered.map((log, i) => {
            const a = TONE_FOR_ACTION[log.action] ?? {
              tone: "slate" as const,
              label: log.action,
            };
            return (
              <div
                key={log.id}
                className="grid items-center"
                style={{
                  gridTemplateColumns: "170px 1.4fr 1fr 130px 90px 70px",
                  gap: 12,
                  padding: "14px 18px",
                  borderTop: i === 0 ? "none" : "1px solid var(--gray-100)",
                  background: i % 2 ? "transparent" : "rgba(255,255,255,0.35)",
                }}
              >
                <div
                  className="font-mono"
                  style={{ fontSize: 11, color: "var(--ink-500)" }}
                >
                  {log.whenFormatted}
                </div>
                <div>
                  <div
                    className="font-medium"
                    style={{ fontSize: 13, color: "var(--ink-900)" }}
                  >
                    {log.name ?? "—"}
                  </div>
                  {log.email && (
                    <div
                      className="font-mono mt-[2px]"
                      style={{ fontSize: 11, color: "var(--ink-500)" }}
                    >
                      {log.email}
                    </div>
                  )}
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 11, color: "var(--ink-600)" }}
                >
                  {log.reason}
                </div>
                <div>
                  <StatusPill tone={a.tone}>{a.label}</StatusPill>
                  {log.error && (
                    <div
                      className="font-mono"
                      style={{
                        fontSize: 11,
                        color: "#9F1239",
                        marginTop: 4,
                      }}
                    >
                      {log.error}
                    </div>
                  )}
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 11, color: "var(--ink-500)" }}
                >
                  {log.source}
                </div>
                <div
                  className="text-right font-mono"
                  style={{ fontSize: 11, color: "var(--ink-500)" }}
                >
                  {log.latency ? `${log.latency}ms` : "—"}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
