import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { detect, DEFAULT_CONFIG } from "@/lib/detection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_SECRET = process.env.ZOOM_WEBHOOK_SECRET!;

/**
 * Webhook ingest. Detects bots passively and logs them to audit_log.
 * Does NOT attempt to remove via REST — that endpoint doesn't support
 * participant removal. Active removal happens in the sidebar Zoom App.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  let parsed: any;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // URL validation handshake
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

  // HMAC signature verification
  if (!verifySignature(req, rawBody)) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  if (parsed.event === "app_deauthorized") {
    await handleDeauth(parsed.payload);
    return NextResponse.json({ ok: true });
  }

  if (parsed.event === "meeting.participant_joined") {
    const receivedAt = Date.now();
    await handleParticipantJoined(parsed.payload, receivedAt);
  }

  return NextResponse.json({ ok: true });
}

function verifySignature(req: NextRequest, rawBody: string): boolean {
  const ts = req.headers.get("x-zm-request-timestamp");
  const sig = req.headers.get("x-zm-signature");
  if (!ts || !sig) return false;

  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;

  const message = `v0:${ts}:${rawBody}`;
  const hash = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(message)
    .digest("hex");
  const expected = `v0=${hash}`;

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

  const result = detect(
    {
      name: p.user_name,
      email: p.email ?? null,
      zoomUserId: p.id,
      isGuest: !p.email,
    },
    DEFAULT_CONFIG
  );

  if (!result.match) return;

  // Just log the detection. The sidebar handles actual removal.
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      meetingId: String(meetingId),
      meetingUuid: meetingUuid ? String(meetingUuid) : null,
      participantName: p.user_name,
      participantEmail: p.email ?? null,
      participantZoomId: p.id,
      matchReason: result.reason,
      action: "detected",
      latencyMs: Date.now() - receivedAt,
      source: "webhook",
    },
  });

  console.log(
    `Bot detected via webhook: ${p.user_name} in meeting ${meetingId}`
  );
}
