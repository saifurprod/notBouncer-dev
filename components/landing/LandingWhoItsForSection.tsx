// LandingWhoItsForSection — single centered line, intentional whitespace.
//
// Per v3 spec: drop industry lists, keep one universal line. Quiet section
// that lets the page breathe before the footer.

export function LandingWhoItsForSection() {
  return (
    <section className="border-t border-stone-100/80 px-6 py-20 sm:px-8 sm:py-24 lg:py-24">
      <div className="mx-auto max-w-[1136px]">
        <div className="mx-auto max-w-[640px] text-center">
          <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500">
            Who it&apos;s for
          </p>
          <p className="text-[20px] font-light leading-[1.4] tracking-[-0.015em] text-ink-900 sm:text-[22px] lg:text-[24px]">
            For anyone who hosts meetings where what is said matters.
          </p>
        </div>
      </div>
    </section>
  );
}
