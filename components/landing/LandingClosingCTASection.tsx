// LandingClosingCTASection — final invitation, just before the footer.
//
// Centered, calm, mirrors the hero's energy with one more CTA so visitors
// who scrolled to the bottom have a second chance to sign up.
//
// Layout: eyebrow → headline → support line → CTA → meta line.
// Reuses the same GoogleSignInButton component as the hero. Same
// "Free for individual hosts. No credit card required." meta line.

import { GoogleSignInButton } from "./GoogleSignInButton";

export function LandingClosingCTASection() {
  return (
    <section className="border-t border-stone-100/80 px-6 py-20 sm:px-8 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-[1136px]">
        <div className="mx-auto max-w-[640px] text-center">
          <p className="mb-6 text-[11px] font-medium uppercase tracking-[0.12em] text-plum-deep">
            Get started
          </p>
          <h2 className="mb-5 text-[28px] font-light leading-[1.1] tracking-[-0.025em] text-ink-900 sm:text-[34px] lg:text-[40px]">
            Your meetings, your rules.
          </h2>
          <p className="mx-auto mb-10 max-w-[480px] text-[15px] leading-[1.6] text-ink-700 sm:text-[16px]">
            A few seconds to sign up. Years of meetings worth protecting.
          </p>
          <div className="flex flex-col items-center">
            <GoogleSignInButton />
            <p className="mt-4 text-[11px] tracking-wide text-ink-500">
              Free for individual hosts. No credit card required.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
