import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

/**
 * Sidebar reports events here: bot detections and removals it performed.
 *
 * Body: {
 *   zoomUserId?: string,        // host's Zoom user ID (optional for MVP)
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
 * MVP single-host fallback: if zoomUserId isn't provided (the SDK doesn't
 * always return user identity reliably), attribute to the most recently
 * installed user. This is fine for personal demos — replace with proper
 * Zoom App context token verification (spec section 4.8) before multi-user.
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

  if (!meetingId || !matchReason || !action) {
    return NextResponse.json(
      { error: "missing_required_fields" },
      { status: 400 }
    );
  }

  // Find the user. Prefer matching by zoomUserId if provided; otherwise
  // fall back to the most recently installed active user (single-host MVP).
  let user = null;
  if (zoomUserId) {
    user = await prisma.user.findUnique({ where: { zoomUserId } });
  }
  if (!user) {
    user = await prisma.user.findFirst({
      where: { deauthorizedAt: null },
      orderBy: { installedAt: "desc" },
    });
  }
  if (!user) {
    return NextResponse.json(
      { error: "no_active_user_found" },
      { status: 404 }
    );
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
    `Sidebar event: ${action} ${participantName} in meeting ${meetingId} (user: ${user.email})`
  );

  return NextResponse.json({ ok: true });
}