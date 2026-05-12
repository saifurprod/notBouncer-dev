// LandingHero — first impression. Two-column layout on desktop with
// centered text in the left column and the SidebarMockupCard on the
// right. Stacks vertically below the `lg` breakpoint.
//
// Mobile/tablet order: text → CTA cluster → mockup beneath.
// Desktop (≥lg, 1024px+): text+CTA centered in left col, mockup in right col.
//
// The text content is centered WITHIN its own column, not across the
// page. On desktop the eye reads the text first (left), then the
// mockup (right). On mobile the same vertical order applies because
// the columns stack: text first, mockup second.
//
// Order of elements (top to bottom in each column):
//   Left column (text):
//     1. Optional error banner (when ?error=... arrives from /install)
//     2. Eyebrow: "NoteBouncer for Zoom"
//     3. Headline (display weight 300, plum NOT used)
//     4. Sub paragraph
//     5. CTA: GoogleSignInButton
//     6. Meta: "Free for individual hosts..."
//     7. Login link: "Already a user? Log in"
//   Right column:
//     - SidebarMockupCard (with subtle entry animation)

import Link from "next/link";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { SidebarMockupCard } from "./SidebarMockupCard";

export interface LandingHeroProps {
  errorMessage?: string;
}

export function LandingHero({ errorMessage }: LandingHeroProps) {
  return (
    <section className="px-6 pt-16 pb-20 sm:px-8 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-28">
      <div className="mx-auto max-w-[1136px]">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-14">
          {/* LEFT COLUMN: text, centered within its column */}
          <div className="text-center">
            {errorMessage && (
              <div
                role="alert"
                className="mb-6 inline-block rounded-lg border border-rose-100 bg-rose-100/70 px-4 py-2 text-sm text-rose-700"
              >
                {errorMessage}
              </div>
            )}

            <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.12em] text-plum-deep">
              NoteBouncer for Zoom
            </p>

            <h1 className="mb-5 text-[36px] font-light leading-[1.08] tracking-[-0.025em] text-ink-900 sm:text-[42px] lg:text-[44px] lg:leading-[1.05] xl:text-[48px]">
              You decide what AI is allowed in your meeting.
            </h1>

            <p className="mx-auto mb-8 max-w-[460px] text-[15px] leading-[1.55] text-ink-700 sm:text-[16px]">
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

          {/* RIGHT COLUMN: faux sidebar mockup with entry animation */}
          <div className="w-full">
            <div className="mx-auto max-w-[440px] lg:max-w-none">
              <SidebarMockupCard />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
