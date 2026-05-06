import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(_req: NextRequest) {
  const state = crypto.randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ZOOM_CLIENT_ID!,
    redirect_uri: process.env.ZOOM_REDIRECT_URI!,
    state,
  });

  const url = `https://zoom.us/oauth/authorize?${params.toString()}`;
  const res = NextResponse.redirect(url);

  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return res;
}
