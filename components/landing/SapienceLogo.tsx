// SapienceLogo — the cleaned, transparent Sapience AI wordmark.
// Lives in /public/brand/sapience-ai.png (12KB transparent PNG).
//
// The intrinsic dimensions of the source PNG are 276x100 px (ratio 2.76:1).
// Passing only `height` lets next/image preserve the aspect ratio and
// keep the file's natural quality without scaling artefacts.

import Image from "next/image";

export interface SapienceLogoProps {
  height?: number;
  className?: string;
}

export function SapienceLogo({ height = 24, className }: SapienceLogoProps) {
  const width = Math.round(height * 2.76);
  return (
    <Image
      src="/brand/sapience-ai.png"
      alt="Sapience AI"
      width={width}
      height={height}
      priority
      className={className}
      style={{ height, width: "auto" }}
    />
  );
}
