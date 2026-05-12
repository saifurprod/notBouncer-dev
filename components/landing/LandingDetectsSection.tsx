// LandingDetectsSection — "What we detect" section.
//
// Lists the AI notetaker vendors NoteBouncer recognizes out of the box.
// A simple flex-wrap of chips. Final chip is accented to indicate
// custom rules can be added beyond the built-in list.
//
// The vendor list is hard-coded here rather than imported from
// `lib/domain/detection.ts` because (a) it's intentionally a curated
// marketing-facing list, not the exhaustive technical patterns, and
// (b) keeping it inline means landing-page changes don't accidentally
// drag in server-side imports.

const VENDORS: readonly string[] = [
  "Otter.ai",
  "Fireflies.ai",
  "Fathom",
  "tl;dv",
  "Read.AI",
  "Granola",
  "Krisp",
  "Fellow.app",
  "Avoma",
  "Sembly",
  "Spinach",
  "MeetGeek",
];

export function LandingDetectsSection() {
  return (
    <section className="border-t border-stone-100/80 px-6 py-20 sm:px-8 sm:py-24 lg:py-24">
      <div className="mx-auto max-w-[1136px]">
        <p className="mb-6 text-[11px] font-medium uppercase tracking-[0.08em] text-plum-deep">
          What we detect
        </p>
        <h2 className="mb-6 max-w-[720px] text-[28px] font-light leading-[1.2] tracking-[-0.02em] text-ink-900 sm:text-[32px] lg:text-[36px] lg:leading-[1.15]">
          If it's a notetaker, we know about it.
        </h2>
        <p className="mb-10 max-w-[560px] text-[15px] leading-[1.65] text-ink-700 sm:text-[16px] sm:leading-[1.6]">
          If a bot from any of these joins your meeting, NoteBouncer catches
          it instantly. Add your own detection rules for anything we do
          not cover.
        </p>
        <div className="flex flex-wrap gap-2">
          {VENDORS.map((vendor) => (
            <span
              key={vendor}
              className="inline-flex items-center rounded-full border px-3.5 py-2 text-[13px] text-ink-700"
              style={{
                background: "rgba(255,255,255,0.7)",
                borderColor: "rgba(168,162,158,0.28)",
              }}
            >
              {vendor}
            </span>
          ))}
          <span
            className="inline-flex items-center rounded-full border px-3.5 py-2 text-[13px] font-medium"
            style={{
              background: "rgba(245,238,245,0.95)",
              borderColor: "rgba(128,71,128,0.28)",
              color: "rgb(103,76,103)",
            }}
          >
            + rules you define
          </span>
        </div>
      </div>
    </section>
  );
}
