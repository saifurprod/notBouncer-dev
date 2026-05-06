import { prisma } from "./db";
import { encryptToken, decryptToken } from "./crypto";

const TOKEN_URL = "https://zoom.us/oauth/token";
const API_BASE = "https://api.zoom.us/v2";

/**
 * Returns a valid access token for the given user, refreshing if expired.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const row = await prisma.oauthToken.findUnique({ where: { userId } });
  if (!row) throw new Error("no_token");

  if (row.expiresAt.getTime() - Date.now() > 60_000) {
    return decryptToken(row.accessTokenCipher);
  }

  const refreshToken = decryptToken(row.refreshTokenCipher);
  const basic = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`refresh_failed:${res.status}:${body}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  };

  await prisma.oauthToken.update({
    where: { userId },
    data: {
      accessTokenCipher: encryptToken(data.access_token),
      refreshTokenCipher: encryptToken(data.refresh_token),
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    },
  });

  return data.access_token;
}

/** Fetch the Zoom user profile of the currently-authenticated host. */
export async function fetchZoomUser(accessToken: string) {
  const res = await fetch(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    console.error(
      `fetchZoomUser failed: ${res.status} ${res.statusText} — body: ${body}`
    );
    throw new Error(`fetch_me_failed:${res.status}:${body.slice(0, 200)}`);
  }
  return res.json() as Promise<{
    id: string;
    account_id: string;
    email: string;
    first_name: string;
    last_name: string;
  }>;
}
