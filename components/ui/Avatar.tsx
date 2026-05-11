// Avatar — circular initials avatar.
// Renders the first 1–2 initials of `name` on a lavender gradient.

import * as React from "react";

export interface AvatarProps {
  name: string;
  size?: number;
}

export function Avatar({ name, size = 32 }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const fontSize = Math.round(size * 0.4);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        background: "linear-gradient(135deg, #d1c5e7 0%, #b9a3d9 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
