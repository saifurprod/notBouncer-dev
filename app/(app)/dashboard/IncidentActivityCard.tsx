"use client";

import { useMemo, useState, useEffect } from "react";
import { Icon } from "@/components/ui/Icon";
import { StatusPill, TONE_FOR_ACTION } from "@/components/ui/StatusPill";
import { COPY, humanizeError, humanizeErrorShort } from "@/lib/copy";

export type IncidentCycles = {
  detected: number;
  waiting: number;
  removed: number;
  failed: number;
};

export type ActivityRow = {
  id: string;
  meetingId: string;
  whenISO: string;
  name: string | null;
  email: string | null;
  reason: string;
  action: string;
  latency: number | null;
  error: string | null;
  cycles: IncidentCycles;
};

export type MeetingForClient = {
  meetingId: string;
  earliestISO: string;
  latestISO: string;
  counts: {
    total: number;
    removed: number;
    waiting: number;
    failed: number;
    detectedOnly: number;
  };
  incidents: Array<{
    id: string;
    whenISO: string;
    name: string | null;
    reason: string;
    action: string;
    latency: number | null;
    cycles: IncidentCycles;
  }>;
};

/**
 * Format a cycles object into a compact annotation string.
 * Shows only counters that hit 2+ occurrences, joined by middle dots.
 * Returns null if nothing crosses the threshold (i.e. no annotation needed).
 *
 * Examples:
 *   { waiting: 7, removed: 0, failed: 0, detected: 8 } → "waiting × 7"
 *   { waiting: 3, removed: 2, failed: 0 }              → "waiting × 3 · removed × 2"
 *   { waiting: 1, removed: 0, failed: 0 }              → null (nothing ≥ 2)
 */
function formatCycles(cycles: IncidentCycles): string | null {
  const parts: string[] = [];
  if (cycles.waiting >= 2) parts.push(`waiting × ${cycles.waiting}`);
  if (cycles.removed >= 2) parts.push(`removed × ${cycles.removed}`);
  if (cycles.failed >= 2) parts.push(`failed × ${cycles.failed}`);
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

// Smart timestamp formatter — local timezone, relative wording.
function formatTimestamp(iso: string, now: Date): string {
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMs < 0) {
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (sameDay) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })}, ${time}`;
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type ViewMode = "event" | "meeting";

export function ActivityCard({
  rows,
  meetings,
}: {
  rows: ActivityRow[];
  meetings: MeetingForClient[];
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("event");
  const [filterOpen, setFilterOpen] = useState(false);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      return true;
    });
  }, [rows, actionFilter]);

  function exportCsv() {
    const header = ["when", "name", "email", "reason", "action", "latency_ms", "error"];
    const escape = (v: any) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [
      header.join(","),
      ...filteredRows.map((r) =>
        [
          r.whenISO,
          r.name ?? "",
          r.email ?? "",
          r.reason,
          r.action,
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

  const hasFilters = actionFilter !== "all";
  const isEmpty = rows.length === 0;

  return (
    <div className="glass-card" style={{ padding: "20px" }}>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
        <div className="min-w-0">
          <div
            className="font-bold"
            style={{ fontSize: 18, color: "var(--ink-900)" }}
          >
            {COPY.activityTitle}
          </div>
          <div className="mt-1" style={{ fontSize: 13, color: "var(--ink-600)" }}>
            {viewMode === "event"
              ? COPY.activitySubtitleEvent
              : COPY.activitySubtitleMeeting}
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap relative">
          {/* View toggle */}
          <div
            className="flex rounded-full p-0.5"
            style={{
              background: "rgba(255,255,255,0.6)",
              border: "1px solid var(--gray-200)",
            }}
          >
            <SegBtn
              label={COPY.groupByEvent}
              active={viewMode === "event"}
              onClick={() => setViewMode("event")}
            />
            <SegBtn
              label={COPY.groupByMeeting}
              active={viewMode === "meeting"}
              onClick={() => setViewMode("meeting")}
            />
          </div>
          {viewMode === "event" && (
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
              {COPY.filterButton}
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
          )}
          <button
            onClick={exportCsv}
            disabled={isEmpty}
            className="rounded-full bg-white inline-flex items-center gap-1.5"
            style={{
              fontSize: 12,
              fontWeight: 500,
              padding: "7px 12px",
              border: "1px solid var(--gray-200)",
              color: "var(--ink-700)",
              cursor: isEmpty ? "not-allowed" : "pointer",
              opacity: isEmpty ? 0.4 : 1,
            }}
          >
            <Icon name="download" size={12} />
            {COPY.exportButton}
          </button>

          {filterOpen && (
            <div
              className="absolute right-0 top-12 z-10 rounded-xl p-4"
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
                  style={{ fontSize: 10, fontWeight: 500, color: "var(--ink-500)" }}
                >
                  {COPY.filterActionLabel}
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    "all",
                    "detected",
                    "removed",
                    "moved_to_waiting_room",
                    "remove_failed",
                  ].map((a) => (
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
                        color: actionFilter === a ? "#fff" : "var(--ink-700)",
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
                  ))}
                </div>
              </div>
              <div
                className="flex justify-between items-center pt-2 border-t"
                style={{ borderColor: "var(--gray-100)" }}
              >
                <button
                  onClick={() => setActionFilter("all")}
                  className="text-xs underline"
                  style={{
                    color: "var(--ink-500)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {COPY.filterClear}
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
                  {COPY.filterDone}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isEmpty ? (
        <EmptyActivity firstRun />
      ) : viewMode === "event" ? (
        filteredRows.length === 0 ? (
          <EmptyActivity firstRun={false} />
        ) : (
          <EventTable rows={filteredRows} now={now} />
        )
      ) : (
        <MeetingList meetings={meetings} now={now} />
      )}
    </div>
  );
}

function SegBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full whitespace-nowrap"
      style={{
        fontSize: 12,
        fontWeight: 500,
        padding: "5px 12px",
        background: active ? "#fff" : "transparent",
        color: active ? "var(--ink-900)" : "var(--ink-600)",
        boxShadow: active ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
        border: "none",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function EmptyActivity({ firstRun }: { firstRun: boolean }) {
  const copy = firstRun ? COPY.emptyActivityFirst : COPY.emptyActivityFiltered;
  return (
    <div className="text-center py-10 px-4">
      <div
        className="mx-auto mb-4 rounded-2xl flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          background: "var(--sage-plum-50)",
          color: "var(--sage-plum)",
        }}
      >
        <Icon
          name="shield-check"
          size={28}
          color="var(--sage-plum)"
          stroke={1.5}
        />
      </div>
      <div
        className="font-semibold mb-2"
        style={{ fontSize: 16, color: "var(--ink-900)" }}
      >
        {copy.title}
      </div>
      <div
        className="max-w-md mx-auto"
        style={{ fontSize: 13, color: "var(--ink-600)", lineHeight: 1.6 }}
      >
        {copy.body}
      </div>
      {firstRun && "hint" in copy && (
        <div
          className="mt-4 inline-block rounded-full px-4 py-2"
          style={{
            background: "var(--canvas-sand)",
            fontSize: 12,
            color: "var(--ink-700)",
          }}
        >
          {(copy as { hint: string }).hint}
        </div>
      )}
    </div>
  );
}

function EventTable({
  rows,
  now,
}: {
  rows: ActivityRow[];
  now: Date | null;
}) {
  return (
    <>
      {/* Desktop table — hidden on small screens */}
      <div
        className="hidden md:block rounded-xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.7)",
          border: "1px solid rgba(255,255,255,0.6)",
        }}
      >
        <div
          className="grid uppercase tracking-[0.06em]"
          style={{
            gridTemplateColumns: "180px 1.4fr 1fr 140px 80px",
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
          <div className="text-right">Latency</div>
        </div>
        {rows.map((log, i) => {
          const a = TONE_FOR_ACTION[log.action] ?? {
            tone: "slate" as const,
            label: log.action,
          };
          const whenText = now ? formatTimestamp(log.whenISO, now) : "—";
          const fullTime = now
            ? new Date(log.whenISO).toLocaleString()
            : log.whenISO;
          return (
            <div
              key={log.id}
              className="grid items-center"
              style={{
                gridTemplateColumns: "180px 1.4fr 1fr 140px 80px",
                gap: 12,
                padding: "14px 18px",
                borderTop: i === 0 ? "none" : "1px solid var(--gray-100)",
                background: i % 2 ? "transparent" : "rgba(255,255,255,0.35)",
              }}
            >
              <div
                className="font-medium"
                style={{ fontSize: 12, color: "var(--ink-700)" }}
                title={fullTime}
              >
                {whenText}
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
                {(() => {
                  const cyclesText = formatCycles(log.cycles);
                  return cyclesText ? (
                    <div
                      className="font-mono"
                      style={{
                        fontSize: 11,
                        color: "var(--ink-500)",
                        marginTop: 4,
                        lineHeight: 1.4,
                      }}
                      title="Action cycles for this incident"
                    >
                      {cyclesText}
                    </div>
                  ) : null;
                })()}
                {log.error && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#9F1239",
                      marginTop: 4,
                      lineHeight: 1.4,
                    }}
                    title={log.error}
                  >
                    {humanizeErrorShort(log.error)}
                  </div>
                )}
              </div>
              <div
                className="text-right font-mono"
                style={{ fontSize: 11, color: "var(--ink-500)" }}
              >
                {log.latency ? `${log.latency}ms` : "—"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile cards — visible only on small screens */}
      <div className="md:hidden flex flex-col gap-2">
        {rows.map((log) => {
          const a = TONE_FOR_ACTION[log.action] ?? {
            tone: "slate" as const,
            label: log.action,
          };
          const whenText = now ? formatTimestamp(log.whenISO, now) : "—";
          return (
            <div
              key={log.id}
              className="rounded-xl"
              style={{
                padding: 14,
                background: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.6)",
              }}
            >
              <div className="flex justify-between items-start gap-3 mb-1.5">
                <div
                  className="font-medium truncate"
                  style={{ fontSize: 14, color: "var(--ink-900)" }}
                >
                  {log.name ?? "—"}
                </div>
                <StatusPill tone={a.tone}>{a.label}</StatusPill>
              </div>
              <div
                className="font-mono mb-2"
                style={{ fontSize: 11, color: "var(--ink-600)" }}
              >
                {log.reason}
              </div>
              <div
                className="flex justify-between items-center"
                style={{ fontSize: 11, color: "var(--ink-500)" }}
              >
                <span>{whenText}</span>
                <span className="flex items-center gap-2">
                  {(() => {
                    const cyclesText = formatCycles(log.cycles);
                    return cyclesText ? (
                      <span
                        className="font-mono"
                        style={{ color: "var(--ink-600)" }}
                        title="Action cycles for this incident"
                      >
                        {cyclesText}
                      </span>
                    ) : null;
                  })()}
                  {log.latency && (
                    <span className="font-mono">{log.latency}ms</span>
                  )}
                </span>
              </div>
              {log.error && (
                <div
                  className="mt-2"
                  style={{ fontSize: 11, color: "#9F1239", lineHeight: 1.4 }}
                >
                  {humanizeError(log.error)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function MeetingList({
  meetings,
  now,
}: {
  meetings: MeetingForClient[];
  now: Date | null;
}) {
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(meetings.length / PAGE_SIZE));
  // Reset to page 1 if the underlying meetings array shrinks past the
  // current page (e.g. on filter change in a future revision).
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  if (meetings.length === 0) {
    return <EmptyActivity firstRun={true} />;
  }

  const startIdx = (page - 1) * PAGE_SIZE;
  const endIdx = startIdx + PAGE_SIZE;
  const pageMeetings = meetings.slice(startIdx, endIdx);
  const showPagination = meetings.length > PAGE_SIZE;

  return (
    <div className="flex flex-col gap-3">
      {pageMeetings.map((m) => {
        const whenText = now ? formatTimestamp(m.latestISO, now) : "—";
        const idShort =
          m.meetingId.length > 11
            ? `${m.meetingId.slice(0, 4)}…${m.meetingId.slice(-4)}`
            : m.meetingId;
        return (
          <details
            key={m.meetingId}
            className="rounded-xl group"
            style={{
              background: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(255,255,255,0.6)",
            }}
          >
            <summary
              className="cursor-pointer list-none px-4 py-3 sm:px-5 sm:py-4"
              style={{ outline: "none" }}
            >
              <div className="flex justify-between items-start gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div
                    className="font-medium font-mono"
                    style={{ fontSize: 12, color: "var(--ink-700)" }}
                  >
                    Meeting {idShort}
                  </div>
                  <div
                    className="mt-0.5"
                    style={{ fontSize: 12, color: "var(--ink-500)" }}
                  >
                    {whenText} · {m.counts.total} bot
                    {m.counts.total === 1 ? "" : "s"} caught
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {m.counts.removed > 0 && (
                    <StatusPill tone="emerald">
                      {m.counts.removed} removed
                    </StatusPill>
                  )}
                  {m.counts.waiting > 0 && (
                    <StatusPill tone="indigo">
                      {m.counts.waiting} waiting
                    </StatusPill>
                  )}
                  {m.counts.detectedOnly > 0 && (
                    <StatusPill tone="amber">
                      {m.counts.detectedOnly} detected
                    </StatusPill>
                  )}
                  {m.counts.failed > 0 && (
                    <StatusPill tone="rose">{m.counts.failed} failed</StatusPill>
                  )}
                </div>
              </div>
            </summary>
            <div
              style={{
                borderTop: "1px solid var(--gray-100)",
                padding: "12px 18px",
              }}
            >
              {m.incidents.map((inc, i) => {
                const a = TONE_FOR_ACTION[inc.action] ?? {
                  tone: "slate" as const,
                  label: inc.action,
                };
                return (
                  <div
                    key={inc.id}
                    className="flex justify-between items-center gap-3 flex-wrap"
                    style={{
                      padding: "8px 0",
                      borderTop:
                        i === 0 ? "none" : "1px solid var(--gray-100)",
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className="font-medium truncate"
                        style={{ fontSize: 13, color: "var(--ink-900)" }}
                      >
                        {inc.name ?? "—"}
                      </div>
                      <div
                        className="font-mono"
                        style={{
                          fontSize: 11,
                          color: "var(--ink-500)",
                          marginTop: 1,
                        }}
                      >
                        {inc.reason}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusPill tone={a.tone}>{a.label}</StatusPill>
                      {(() => {
                        const cyclesText = formatCycles(inc.cycles);
                        return cyclesText ? (
                          <span
                            className="font-mono"
                            style={{ fontSize: 10, color: "var(--ink-500)" }}
                            title="Action cycles for this incident"
                          >
                            {cyclesText}
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}
      {showPagination && (
        <MeetingPagination
          page={page}
          totalPages={totalPages}
          startIdx={startIdx}
          endIdx={Math.min(endIdx, meetings.length)}
          total={meetings.length}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

/**
 * MeetingPagination — client-side pagination controls for the meeting list.
 * Renders "Showing X–Y of N · prev / page numbers / next" below the meeting
 * cards. Page numbers are condensed when there are many pages: shows first,
 * last, current, and neighbors with ellipses between.
 */
function MeetingPagination({
  page,
  totalPages,
  startIdx,
  endIdx,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  startIdx: number;
  endIdx: number;
  total: number;
  onPageChange: (n: number) => void;
}) {
  return (
    <div
      className="flex items-center justify-between mt-2 pt-3 gap-3 flex-wrap"
      style={{
        borderTop: "1px solid rgba(168, 162, 158, 0.15)",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--ink-600)" }}>
        Showing {startIdx + 1}–{endIdx} of {total} meeting
        {total === 1 ? "" : "s"}
      </div>
      <div className="flex gap-1.5">
        <PageButton
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </PageButton>
        {pageNumbersToRender(page, totalPages).map((n, i) =>
          n === "…" ? (
            <span
              key={`gap-${i}`}
              className="inline-flex items-center justify-center"
              style={{
                width: 32,
                height: 32,
                color: "var(--ink-500)",
                fontSize: 11,
              }}
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <PageButton
              key={n}
              current={n === page}
              onClick={() => onPageChange(n)}
              aria-label={`Page ${n}`}
              aria-current={n === page ? "page" : undefined}
            >
              {n}
            </PageButton>
          ),
        )}
        <PageButton
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Next page"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </PageButton>
      </div>
    </div>
  );
}

function PageButton({
  current,
  disabled,
  onClick,
  children,
  ...rest
}: {
  current?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
} & React.AriaAttributes & { "aria-label"?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center rounded-[7px] transition-colors"
      style={{
        width: 32,
        height: 32,
        border: current
          ? "1px solid var(--sage-plum)"
          : "1px solid rgba(168, 162, 158, 0.25)",
        background: current ? "var(--sage-plum)" : "rgba(255, 255, 255, 0.5)",
        color: current ? "white" : "var(--ink-700)",
        fontSize: 11,
        fontWeight: current ? 500 : 400,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        fontFamily: "inherit",
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * Returns the page numbers to render, with "…" inserted where pages are
 * skipped. Always shows page 1, last page, current page, and 1 neighbor
 * on each side of current.
 *
 * Examples:
 *   pageNumbersToRender(1, 1)  → [1]
 *   pageNumbersToRender(3, 5)  → [1, 2, 3, 4, 5]
 *   pageNumbersToRender(5, 20) → [1, "…", 4, 5, 6, "…", 20]
 */
function pageNumbersToRender(
  page: number,
  totalPages: number,
): Array<number | "…"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const out: Array<number | "…"> = [1];
  const left = Math.max(2, page - 1);
  const right = Math.min(totalPages - 1, page + 1);
  if (left > 2) out.push("…");
  for (let i = left; i <= right; i++) out.push(i);
  if (right < totalPages - 1) out.push("…");
  out.push(totalPages);
  return out;
}
