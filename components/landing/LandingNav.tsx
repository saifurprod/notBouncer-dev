// LandingNav — top navigation strip on the marketing landing page.
//
// Layout: container (1136px max, 32px gutters), 12-col grid implied.
// Left:  plum "N" chip + NoteBouncer wordmark
// Right: Sapience AI logo (the parent brand)

import { SapienceLogo } from "./SapienceLogo";

export function LandingNav() {
  return (
    <header className="border-b border-stone-100/80">
      <div className="mx-auto flex max-w-[1136px] items-center justify-between px-6 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-plum text-sm font-medium text-white"
          >
            N
          </span>
          <span className="text-[15px] font-medium tracking-tight text-ink-900">
            NoteBouncer
          </span>
        </div>
        <SapienceLogo height={24} />
      </div>
    </header>
  );
}
