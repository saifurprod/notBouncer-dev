// Section label — small uppercase eyebrow text above a section title.
// Optional `action` slot on the right (e.g. "View all" link).

import * as React from "react";

export interface SectionLabelProps {
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function SectionLabel({ children, action }: SectionLabelProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="text-xs font-medium uppercase tracking-[0.11em] text-ink-500">
        {children}
      </div>
      {action}
    </div>
  );
}
