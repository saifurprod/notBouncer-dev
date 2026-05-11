import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { installed?: string };
}) {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const users = await prisma.user.findMany({
    where: { deauthorizedAt: null },
    select: { email: true, displayName: true, installedAt: true },
  });

  const justInstalled = searchParams.installed === "1";

  // Stats
  const totalDetected = logs.filter(
    (l) => l.action === "detected" || l.action === "removed"
  ).length;
  const totalRemoved = logs.filter((l) => l.action === "removed").length;
  const totalFailed = logs.filter((l) => l.action === "remove_failed").length;

  return (
    <main className="min-h-screen px-6 py-12 max-w-5xl mx-auto">
      <header className="flex items-baseline justify-between mb-12">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
            Dashboard
          </p>
          <h1 className="font-display text-5xl mt-1">NoteBouncer</h1>
        </div>
        <div className="text-right text-sm text-stone-600 font-mono">
          {users.length} {users.length === 1 ? "host" : "hosts"} installed
        </div>
      </header>

      {justInstalled && (
        <div className="mb-10 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          ✓ Installed successfully. Open NoteBouncer from Zoom's Apps panel
          during a meeting to enable auto-removal of bots.
        </div>
      )}

      {/* Stats */}
      <section className="mb-12 grid grid-cols-3 gap-4">
        <Stat label="Bots detected" value={totalDetected} />
        <Stat label="Removed by sidebar" value={totalRemoved} accent="emerald" />
        <Stat label="Removal failed" value={totalFailed} accent="red" />
      </section>

      {/* Hosts */}
      <section className="mb-12">
        <h2 className="font-display text-2xl mb-4">Connected hosts</h2>
        {users.length === 0 ? (
          <p className="text-sm text-stone-500">No hosts installed yet.</p>
        ) : (
          <ul className="divide-y divide-stone-200 border border-stone-200 rounded-md bg-white">
            {users.map((u) => (
              <li
                key={u.email}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <div className="font-medium">{u.displayName ?? "—"}</div>
                  <div className="text-sm text-stone-500 font-mono">
                    {u.email}
                  </div>
                </div>
                <div className="text-xs text-stone-400 font-mono">
                  installed {u.installedAt.toISOString().slice(0, 10)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Activity */}
      <section>
        <h2 className="font-display text-2xl mb-4">Activity</h2>
        {logs.length === 0 ? (
          <div className="rounded-md border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
            <p className="font-display text-xl text-stone-700">
              No bots have crashed your meetings yet.
            </p>
            <p className="mt-2 text-sm text-stone-500">
              When a notetaker joins one of your meetings, you'll see it here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th className="px-4 py-3 text-left font-medium text-stone-700">
                    When
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-stone-700">
                    Bot
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-stone-700">
                    Reason
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-stone-700">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-stone-700">
                    Source
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-stone-700">
                    Latency
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {logs.map((log) => (
                  <tr key={String(log.id)}>
                    <td className="px-4 py-3 text-stone-500 font-mono text-xs whitespace-nowrap">
                      {log.createdAt
                        .toISOString()
                        .slice(0, 19)
                        .replace("T", " ")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {log.participantName ?? "—"}
                      </div>
                      {log.participantEmail && (
                        <div className="text-xs text-stone-500 font-mono">
                          {log.participantEmail}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-600">
                      {log.matchReason}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={log.action} />
                      {log.errorMessage && (
                        <div className="text-xs text-red-600 mt-1 max-w-xs truncate">
                          {log.errorMessage}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-500 font-mono">
                      {log.source}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-stone-500">
                      {log.latencyMs ? `${log.latencyMs}ms` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "red";
}) {
  const valueColor =
    accent === "emerald"
      ? "text-emerald-700"
      : accent === "red"
        ? "text-red-700"
        : "text-stone-900";
  return (
    <div className="bg-white border border-stone-200 rounded-md p-4">
      <div className="text-xs uppercase tracking-wider text-stone-500 mb-1">
        {label}
      </div>
      <div className={`font-display text-3xl ${valueColor}`}>{value}</div>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const styles: Record<string, string> = {
    detected: "bg-amber-50 text-amber-700 border-amber-200",
    removed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    remove_failed: "bg-red-50 text-red-700 border-red-200",
    dry_run: "bg-stone-50 text-stone-700 border-stone-200",
  };
  const cls = styles[action] ?? "bg-stone-50 text-stone-700 border-stone-200";
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs ${cls}`}
    >
      {action.replace(/_/g, " ")}
    </span>
  );
}
