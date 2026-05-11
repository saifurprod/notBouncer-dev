// Brand mark — a small plum chip with the NoteBouncer shield icon.
// Used in the dashboard header. The landing page uses its own logo treatment.

import * as React from "react";
import { Icon } from "./Icon";

export interface BrandMarkProps {
  size?: number;
  iconSize?: number;
}

export function BrandMark({ size = 36, iconSize = 18 }: BrandMarkProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: "var(--sage-plum)",
        boxShadow: "var(--shadow-glow-indigo)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name="shield-check" size={iconSize} color="#fff" />
    </div>
  );
}
