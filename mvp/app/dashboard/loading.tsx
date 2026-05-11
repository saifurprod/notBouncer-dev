// Next.js automatically renders this while the server component awaits its
// data. Replaces the white-flash before content appears.

export default function DashboardLoading() {
  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--canvas-lavender)" }}
    >
      <div className="max-w-[1280px] mx-auto px-6 sm:px-14 pt-12 pb-24">
        {/* Header skeleton */}
        <div className="mb-6 h-3 w-32 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.6)" }} />

        <div className="flex items-start justify-between gap-8 flex-wrap">
          <div className="flex items-start gap-5">
            <Shimmer w={48} h={48} radius={16} />
            <div>
              <Shimmer w={180} h={14} className="mb-3" />
              <Shimmer w={420} h={42} className="mb-3" />
              <Shimmer w={320} h={14} />
            </div>
          </div>
          <div className="hidden md:flex flex-col items-end gap-5">
            <Shimmer w={120} h={18} />
            <div className="flex items-center gap-3">
              <Shimmer w={32} h={32} radius={9999} />
              <Shimmer w={100} h={14} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-10 mt-10">
          {/* Insight card skeleton */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div className="flex items-start gap-[18px]">
              <Shimmer w={40} h={40} radius={12} />
              <div className="flex-1">
                <Shimmer w={"60%"} h={14} className="mb-2" />
                <Shimmer w={"90%"} h={12} className="mb-1" />
                <Shimmer w={"70%"} h={12} />
              </div>
            </div>
          </div>

          {/* Stats skeleton */}
          <div>
            <div className="section-label mb-4">
              <Shimmer w={140} h={12} />
            </div>
            <div className="glass-card" style={{ padding: 28 }}>
              <Shimmer w={200} h={18} className="mb-2" />
              <Shimmer w={320} h={12} className="mb-5" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-xl"
                    style={{
                      padding: 20,
                      background: "rgba(255,255,255,0.7)",
                      border: "1px solid rgba(255,255,255,0.6)",
                      minHeight: 140,
                    }}
                  >
                    <Shimmer w={70} h={20} radius={9999} className="mb-6" />
                    <Shimmer w={80} h={36} className="mb-2" />
                    <Shimmer w={100} h={11} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Activity skeleton */}
          <div>
            <div className="section-label mb-4">
              <Shimmer w={120} h={12} />
            </div>
            <div className="glass-card" style={{ padding: 28 }}>
              <div className="flex justify-between mb-5">
                <Shimmer w={120} h={18} />
                <div className="flex gap-2">
                  <Shimmer w={70} h={28} radius={9999} />
                  <Shimmer w={70} h={28} radius={9999} />
                </div>
              </div>
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex justify-between items-center"
                  style={{
                    padding: "14px 4px",
                    borderTop:
                      i === 0 ? "none" : "1px solid var(--gray-100)",
                  }}
                >
                  <div className="flex-1 flex gap-3 items-center">
                    <Shimmer w={120} h={12} />
                    <Shimmer w={140} h={14} />
                  </div>
                  <Shimmer w={90} h={22} radius={9999} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Shimmer({
  w,
  h,
  radius = 6,
  className = "",
}: {
  w: number | string;
  h: number;
  radius?: number;
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse ${className}`}
      style={{
        width: typeof w === "number" ? w : w,
        height: h,
        borderRadius: radius,
        background: "rgba(255,255,255,0.55)",
      }}
    />
  );
}
