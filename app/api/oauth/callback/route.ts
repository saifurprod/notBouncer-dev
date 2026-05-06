import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encryptToken } from "@/lib/crypto";
import { fetchZoomUser } from "@/lib/zoom";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("oauth_state")?.value;

  if (!code) {
    return NextResponse.redirect(
      new URL("/?error=no_code", req.nextUrl.origin)
    );
  }
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(
      new URL("/?error=state_mismatch", req.nextUrl.origin)
    );
  }

  const basic = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
  ).toString("base64");

  const tokenRes = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.ZOOM_REDIRECT_URI!,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error("Token exchange failed:", body);
    return NextResponse.redirect(
      new URL("/?error=token_exchange", req.nextUrl.origin)
    );
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  };

  let me;
  try {
    me = await fetchZoomUser(tokens.access_token);
  } catch (err: any) {
    console.error("fetchZoomUser failed:", err?.message);
    return NextResponse.redirect(
      new URL("/?error=fetch_user", req.nextUrl.origin)
    );
  }

  const encryptedAccess = encryptToken(tokens.access_token);
  const encryptedRefresh = encryptToken(tokens.refresh_token);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { zoomUserId: me.id },
      update: {
        email: me.email,
        displayName: `${me.first_name} ${me.last_name}`.trim(),
        zoomAccountId: me.account_id,
        deauthorizedAt: null,
      },
      create: {
        zoomUserId: me.id,
        zoomAccountId: me.account_id,
        email: me.email,
        displayName: `${me.first_name} ${me.last_name}`.trim(),
      },
    });

    await tx.oauthToken.upsert({
      where: { userId: user.id },
      update: {
        accessTokenCipher: encryptedAccess,
        refreshTokenCipher: encryptedRefresh,
        expiresAt,
        scope: tokens.scope,
      },
      create: {
        userId: user.id,
        accessTokenCipher: encryptedAccess,
        refreshTokenCipher: encryptedRefresh,
        expiresAt,
        scope: tokens.scope,
      },
    });
  });

  return NextResponse.redirect(
    new URL("/dashboard?installed=1", req.nextUrl.origin)
  );
}
