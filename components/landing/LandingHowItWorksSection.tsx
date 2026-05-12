// LandingHowItWorksSection — three-step explainer + product showcase.
//
// Layout:
//   - Eyebrow + h2 top
//   - 3 step cards: stacked on mobile, 3-up on lg+
//   - ProductShowcaseCard below, full width of the container

import { ProductShowcaseCard } from "./ProductShowcaseCard";

interface Step {
  num: string;
  title: string;
  body: string;
}

const STEPS: readonly Step[] = [
  {
    num: "01",
    title: "Sign up",
    body: "Use your Google account. Nothing to install on your computer.",
  },
  {
    num: "02",
    title: "Connect Zoom",
    body: "Authorise NoteBouncer from your dashboard. Takes about ten seconds.",
  },
  {
    num: "03",
    title: "Open in your meeting",
    body: "Launch NoteBouncer from Zoom's Apps panel during a call. Caught bots appear instantly.",
  },
];

export function LandingHowItWorksSection() {
  return (
    <section className="border-t border-stone-100/80 px-6 py-20 sm:px-8 sm:py-24 lg:py-24">
      <div className="mx-auto max-w-[1136px]">
        <p className="mb-6 text-[11px] font-medium uppercase tracking-[0.08em] text-plum-deep">
          How it works
        </p>

        <h2 className="mb-10 max-w-[720px] text-[28px] font-light leading-[1.2] tracking-[-0.02em] text-ink-900 sm:text-[32px] lg:text-[36px] lg:leading-[1.15]">
          Three steps to take back control.
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          {STEPS.map((step) => (
            <StepCard key={step.num} {...step} />
          ))}
        </div>

        <div className="mt-12 lg:mt-16">
          <ProductShowcaseCard />
        </div>
      </div>
    </section>
  );
}

function StepCard({ num, title, body }: Step) {
  return (
    <article
      className="h-full rounded-2xl border p-7"
      style={{
        background: "rgba(255, 255, 255, 0.65)",
        borderColor: "rgba(255, 255, 255, 0.8)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <span
        aria-hidden="true"
        className="mb-4 inline-flex h-7 w-7 items-center justify-center rounded-lg font-mono text-[13px] font-medium"
        style={{
          background: "var(--sage-plum-50)",
          color: "var(--sage-plum-deep)",
        }}
      >
        {num}
      </span>
      <h3 className="mb-2 text-[16px] font-medium tracking-[-0.01em] text-ink-900">
        {title}
      </h3>
      <p className="text-[14px] leading-[1.55] text-ink-700">{body}</p>
    </article>
  );
}
