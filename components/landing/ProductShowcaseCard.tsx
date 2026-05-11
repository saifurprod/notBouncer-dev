// ProductShowcaseCard — a stylized representation of the in-Zoom sidebar.
//
// Shows the "Caught bots" panel with a single example bot card (Otter)
// and a Remove button. Designed to demonstrate the product without using
// a real screenshot (cleaner, ages better, won't break if real UI changes).
//
// Used in LandingHowItWorksSection. Lays out as 5/12 + 7/12 on desktop,
// stacked on mobile/tablet.

export function ProductShowcaseCard() {
  return (
    <div
      className="rounded-2xl border p-6 sm:p-8"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 100%)",
        borderColor: "rgba(255,255,255,0.7)",
      }}
    >
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5">
          <MiniSidebar />
        </div>
        <div className="lg:col-span-7">
          <h3 className="mb-3 text-[18px] font-medium tracking-[-0.01em] text-ink-900">
            One panel. One click. Done.
          </h3>
          <p className="text-[15px] leading-[1.6] text-ink-700 sm:text-[16px]">
            The sidebar lives inside Zoom, next to your meeting. When a
            notetaker joins, you see it. When you remove it, it is gone,
            and will not be admitted back if it tries to rejoin.
          </p>
        </div>
      </div>
    </div>
  );
}

function MiniSidebar() {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: "var(--canvas-sand)",
        borderColor: "rgba(0,0,0,0.06)",
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-medium text-ink-900">
          Caught bots · 1 pending
        </span>
        <span
          className="rounded-full px-2 py-[3px] text-[10px] font-medium"
          style={{ background: "#DCFCE7", color: "#059669" }}
        >
          Watching
        </span>
      </div>

      <div
        className="relative overflow-hidden rounded-[10px] border px-3 py-2.5"
        style={{
          background: "var(--amber-50)",
          borderColor: "var(--amber-100)",
        }}
      >
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ background: "var(--amber-500)" }}
        />
        <div className="flex items-center gap-1.5 pl-1 text-[12px] font-medium text-ink-900">
          <BotGlyph />
          Otter.ai Notetaker
        </div>
        <div className="pl-1 font-mono text-[10px] text-ink-700">
          name:Otter
        </div>
      </div>

      <button
        type="button"
        className="mt-3 cursor-default rounded-full bg-ink-900 px-3 py-1.5 text-[11px] font-medium text-white"
        aria-label="Remove all caught bots (mockup, not interactive)"
        tabIndex={-1}
      >
        Remove all (1)
      </button>
    </div>
  );
}

function BotGlyph() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
    </svg>
  );
}
