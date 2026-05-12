// SidebarMockupCard — a stylized faux Zoom sidebar shown beside the hero.
//
// Designed to look like a real screenshot of NoteBouncer running in a
// meeting, but built from the same tokens as the actual sidebar so it
// reads as part of the product, not a marketing illustration.
//
// Behavior: enters with a subtle "slides down from above + fades in"
// animation on initial page load (600ms, ease-out, runs once). Respects
// `prefers-reduced-motion` — users who opt out of motion see no animation.
//
// This is a server component — the animation is CSS-only, no JS. The
// `<style jsx global>` block is replaced with an inline <style> tag for
// SSR compatibility.
//
// Not interactive. All buttons are visual only.

export function SidebarMockupCard() {
  return (
    <>
      <style
        // Module-scoped CSS for the entry animation. Inline because the
        // styled-jsx tag would require a "use client" boundary just for
        // an animation. Inline CSS in a server component is fine and
        // streams with the SSR output.
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes nbMockupEntry {
              from { opacity: 0; transform: translateY(-20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .nb-mockup-card {
              animation: nbMockupEntry 600ms cubic-bezier(0.22, 1, 0.36, 1) 150ms both;
              will-change: opacity, transform;
            }
            @media (prefers-reduced-motion: reduce) {
              .nb-mockup-card { animation: none; }
            }
          `,
        }}
      />
      <div
        className="nb-mockup-card rounded-2xl border p-5 sm:p-6"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.55) 100%)",
          borderColor: "rgba(255,255,255,0.8)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          boxShadow:
            "0 1px 2px rgba(41,37,36,0.04), 0 4px 24px rgba(41,37,36,0.06)",
        }}
        aria-label="NoteBouncer sidebar example. Three caught bots in a Zoom meeting."
        role="img"
      >
        <MockupHeader />
        <div className="mt-4 mb-2 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-500">
            Caught bots · 3 pending
          </span>
        </div>
        <BotRow
          name="Otter.ai Notetaker"
          reason="name:otter"
          state="pending"
        />
        <BotRow
          name="Fireflies.ai"
          reason="domain:fireflies.ai"
          state="pending"
        />
        <BotRow
          name="Fathom Notetaker"
          reason="name:fathom · 412ms"
          state="removed"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="mt-2 w-full cursor-default rounded-xl px-3 py-2.5 text-[12px] font-medium text-white"
          style={{ background: "rgb(128,71,128)" }}
        >
          Remove all bots (2)
        </button>
      </div>
    </>
  );
}

function MockupHeader() {
  return (
    <div className="flex items-start justify-between">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-500">
          In meeting
        </div>
        <div className="mt-0.5 text-[14px] font-medium tracking-[-0.01em] text-ink-900">
          Q2 Founder Sync
        </div>
      </div>
      <span
        className="inline-flex items-center gap-1 rounded-full border px-2 py-[3px] text-[10px] font-medium"
        style={{
          background: "rgba(167,243,208,0.45)",
          borderColor: "rgba(16,185,129,0.3)",
          color: "rgb(6,95,70)",
        }}
      >
        <span
          aria-hidden="true"
          className="inline-block h-[5px] w-[5px] rounded-full"
          style={{ background: "rgb(16,185,129)" }}
        />
        Watching
      </span>
    </div>
  );
}

interface BotRowProps {
  name: string;
  reason: string;
  state: "pending" | "removed";
}

function BotRow({ name, reason, state }: BotRowProps) {
  const isRemoved = state === "removed";
  return (
    <div
      className="mb-1.5 flex items-center justify-between rounded-xl border px-3 py-2.5"
      style={{
        background: isRemoved ? "rgba(245,238,245,0.55)" : "rgba(255,255,255,0.85)",
        borderColor: isRemoved
          ? "rgba(128,71,128,0.2)"
          : "rgba(168,162,158,0.22)",
      }}
    >
      <div className="min-w-0 flex-1 pr-3">
        <div className="truncate text-[12px] font-medium text-ink-900">
          {name}
        </div>
        <div className="mt-0.5 truncate font-mono text-[10px] text-ink-500">
          {reason}
        </div>
      </div>
      {isRemoved ? (
        <span
          className="rounded-full px-2 py-[3px] text-[10px] font-medium"
          style={{
            background: "rgba(167,243,208,0.55)",
            color: "rgb(6,95,70)",
          }}
        >
          ✓ Removed
        </span>
      ) : (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="cursor-default rounded-full border px-2.5 py-1 text-[10px] font-medium"
          style={{
            background: "rgba(255,228,230,0.55)",
            borderColor: "rgba(159,18,57,0.32)",
            color: "rgb(159,18,57)",
          }}
        >
          Remove
        </button>
      )}
    </div>
  );
}
