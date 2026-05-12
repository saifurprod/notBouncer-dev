// LandingFooter — Sapience brand mark left, links right.
//
// Mobile: stacked center-aligned (logo on top, links centered, copyright bottom).
// Desktop: 7/5 split — brand+copyright left, links right.

import Link from "next/link";
import { SapienceLogo } from "./SapienceLogo";

const FOOTER_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Support", href: "mailto:support@sapienceai.co" },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-stone-100/80">
      <div className="mx-auto max-w-[1136px] px-6 py-10 sm:px-8 sm:py-12">
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:text-left">
          <div>
            <SapienceLogo height={36} className="mx-auto sm:mx-0" />
            <p className="mt-3 text-[11px] tracking-wide text-ink-500">
              © {new Date().getFullYear()} Sapience AI. All rights reserved.
            </p>
          </div>

          <nav aria-label="Footer">
            <ul className="flex items-center gap-6 sm:gap-8">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-700 hover:text-plum"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
