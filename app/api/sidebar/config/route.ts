import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_CONFIG } from "@/lib/detection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

/**
 * Sidebar fetches its config here. For MVP, returns DEFAULT_CONFIG.
 * When per-host configs are added, look up by zoomUserId from the
 * verified context token.
 */
export async function GET(_req: NextRequest) {
  return NextResponse.json({
    config: DEFAULT_CONFIG,
    enabled: true,
    dryRun: false,
  });
}
