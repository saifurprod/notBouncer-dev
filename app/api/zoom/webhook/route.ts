import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { detect, DEFAULT_CONFIG } from "@/lib/detection";
import { ZoomClient, getValidAccessToken } from "@/lib/zoom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_SECRET = process.env.ZOOM_WEBHOOK_SECRET!;

/**
 * Webhook ingest. In production (per spec) this enqueues to BullMQ and returns
 * 200 within 100ms. For the MVP we process synchronously — at single-host scale
 * Zoom won't penalize us and the code is dramatically simpler.
 */
export async function POST(req: NextRequest) {
  // We need the raw body for HMAC verification, so read it as text first.
  const rawBody = await req.text();

  // Handle Zoom's URL-validation challenge before signature checks.
  // Zoom POSTs this once when you save a webhook endpoint URL.
  let parsed: any;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (parsed?.event === "endpoint.url_validation") {
    const plainToken = parsed.payload?.plainToken;
    if (typeof plainToken !== "string") {
      return NextResponse.json(
        { error: "missing_plain_token" },
        { status: 400 }
      );
    }
    const encryptedToken = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(plainToken)
      .digest("hex");
    return NextResponse.json({ plainToken, encryptedToken });
  }

  // Verify Zoom HMAC signature for all other events
  if (!verifySignature(req, rawBody)) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  // Handle deauthorize event — clean up user data
  if (parsed.event === "app_deauthorized") {
    await handleDeauth(parsed.payload);
    return NextResponse.json({ ok: true });
  }

  // Only act on participant_joined for now
  if (parsed.event !== "meeting.participant_joined") {
    return NextResponse.json({ ok: true });
  }

  const receivedAt = Date.now();
  await handleParticipantJoined(parsed.payload, receivedAt);

  return NextResponse.json({ ok: true });
}

function verifySignature(req: NextRequest, rawBody: string): boolean {
  const ts = req.headers.get("x-zm-request-timestamp");
  const sig = req.headers.get("x-zm-signature");
  if (!ts || !sig) return false;

  // Reject events older than 5 minutes (replay protection)
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;

  const message = `v0:${ts}:${rawBody}`;
  const hash = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(message)
    .digest("hex");
  const expected = `v0=${hash}`;

  // Use timingSafeEqual to prevent timing attacks
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function handleDeauth(payload: any) {
  const zoomUserId = payload?.user_id;
  if (!zoomUserId) return;
  const user = await prisma.user.findUnique({ where: { zoomUserId } });
  if (!user) return;
  await prisma.$transaction([
    prisma.oauthToken.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({
      where: { id: user.id },
      data: { deauthorizedAt: new Date() },
    }),
  ]);
}

async function handleParticipantJoined(payload: any, receivedAt: number) {
  const meetingId = payload?.object?.id;
  const meetingUuid = payload?.object?.uuid;
  const hostId = payload?.object?.host_id;
  const p = payload?.object?.participant;

  if (!meetingId || !hostId || !p) return;

  const user = await prisma.user.findUnique({ where: { zoomUserId: hostId } });
  if (!user || user.deauthorizedAt) return;

  // For MVP, use default config inline. When configs table is added back,
  // load from DB here.
  const config = DEFAULT_CONFIG;

  const result = detect(
    {
      name: p.user_name,
      email: p.email ?? null,
      zoomUserId: p.id,
      isGuest: !p.email,
    },
    config
  );

  if (!result.match) return;

  // Remove the bot
  try {
    const token = await getValidAccessToken(user.id);
    const zoom = new ZoomClient(token);
    await zoom.removeParticipant(
      String(meetingId),
      p.participant_user_id ?? p.id
    );

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        meetingId: String(meetingId),
        meetingUuid: String(meetingUuid),
        participantName: p.user_name,
        participantEmail: p.email ?? null,
        participantZoomId: p.id,
        matchReason: result.reason,
        action: "removed",
        latencyMs: Date.now() - receivedAt,
        source: "webhook",
      },
    });
  } catch (err: any) {
    console.error("Removal failed:", err?.message);
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        meetingId: String(meetingId),
        meetingUuid: String(meetingUuid),
        participantName: p.user_name,
        participantEmail: p.email ?? null,
        participantZoomId: p.id,
        matchReason: result.reason,
        action: "failed",
        latencyMs: Date.now() - receivedAt,
        source: "webhook",
      },
    });
  }
}
