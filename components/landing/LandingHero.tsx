// LandingHero — first impression. Centered editorial layout.
//
// Order:
//   1. Eyebrow:   "NoteBouncer for Zoom" (plum, uppercase, small)
//   2. Headline:  display weight 300, light italic plum NOT used (per v3 spec)
//   3. Sub:       lead size, ink-700
//   4. CTA:       single Google sign-in button
//   5. Meta:      "Free for individual hosts. No credit card required."
//   6. Login:     "Already a user? Log in" (Log in is a plum link)
//
// Optional `errorMessage` prop renders an inline error banner above the
// hero (used when the user gets bounced back from /install with an error).

import Link from "next/link";
import { GoogleSignInButton } from "./GoogleSignInButton";

export interface LandingHeroProps {
  errorMessage?: string;
}

export function LandingHero({ errorMessage }: LandingHeroProps) {
  return (
    <section className="px-6 pt-24 pb-20 sm:px-8 sm:pt-28 sm:pb-24 lg:pt-32 lg:pb-24">
      <div className="mx-auto max-w-[1136px]">
        <div className="mx-auto max-w-[680px] text-center">
          {errorMessage && (
            <div
              role="alert"
              className="mb-8 inline-block rounded-lg border border-rose-100 bg-rose-100/70 px-4 py-2 text-sm text-rose-700"
            >
              {errorMessage}
            </div>
          )}

          <p className="mb-6 text-[11px] font-medium uppercase tracking-[0.12em] text-plum-deep">
            NoteBouncer for Zoom
          </p>

          <h1 className="mb-6 text-[40px] font-light leading-[1.08] tracking-[-0.025em] text-ink-900 sm:text-[48px] lg:text-[56px] lg:leading-[1.05]">
            You decide what AI is allowed in your meeting.
          </h1>

          <p className="mx-auto mb-10 max-w-[580px] text-[16px] leading-[1.55] text-ink-700 sm:text-[18px]">
            NoteBouncer watches your Zoom calls for AI notetakers and lets
            you remove them with one click. Otter, Fireflies, Read, Krisp,
            and many more are detected the moment they join.
          </p>

          <div className="flex flex-col items-center">
            <GoogleSignInButton />

            <p className="mt-4 text-[11px] tracking-wide text-ink-500">
              Free for individual hosts. No credit card required.
            </p>

            <p className="mt-4 text-sm text-ink-500">
              Already a user?{" "}
              <Link
                href="/install"
                className="font-medium text-plum hover:text-plum-deep hover:underline"
              >
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
