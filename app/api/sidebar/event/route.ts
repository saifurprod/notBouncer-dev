import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

/**
 * Sidebar reports events here: bot detections and removals it performed.
 *
 * Body: {
 *   zoomUserId: string,       // host's Zoom user ID
 *   meetingId: string,
 *   meetingUuid?: string,
 *   participantName: string,
 *   participantEmail?: string,
 *   participantZoomId?: string,
 *   matchReason: string,
 *   action: "detected" | "removed" | "remove_failed",
 *   errorMessage?: string,
 *   latencyMs?: number,
 * }
 *
 * Auth: For MVP, we trust the body's zoomUserId. Production should verify
 * the Zoom App context token (spec section 4.8) — that's a hardening task
 * for later.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const {
    zoomUserId,
    meetingId,
    meetingUuid,
    participantName,
    participantEmail,
    participantZoomId,
    matchReason,
    action,
    errorMessage,
    latencyMs,
  } = body ?? {};

  if (!zoomUserId || !meetingId || !matchReason || !action) {
    return NextResponse.json(
      { error: "missing_required_fields" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { zoomUserId } });
  if (!user || user.deauthorizedAt) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      meetingId: String(meetingId),
      meetingUuid: meetingUuid ? String(meetingUuid) : null,
      participantName: participantName ?? null,
      participantEmail: participantEmail ?? null,
      participantZoomId: participantZoomId ?? null,
      matchReason: String(matchReason),
      action: String(action),
      latencyMs: typeof latencyMs === "number" ? latencyMs : null,
      source: "sidebar",
      errorMessage: errorMessage ?? null,
    },
  });

  console.log(
    `Sidebar event: ${action} ${participantName} in meeting ${meetingId}`
  );

  return NextResponse.json({ ok: true });
}
