# NoteBouncer MVP — Complete Deployment Guide

A personal-demo build of NoteBouncer — a Zoom app that automatically removes
AI notetaker bots (Otter, Fireflies, Fathom, etc.) from your meetings.

This README walks you all the way from "I have the code" to "I just watched a
bot get kicked out of my Zoom meeting." Plan for **2–3 hours** end-to-end the
first time. The Zoom Marketplace step is the slowest because of clicking
through screens, not because of difficulty.

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Phase 1 — Push the code to GitHub](#phase-1--push-the-code-to-github)
3. [Phase 2 — First Vercel deploy (get a URL)](#phase-2--first-vercel-deploy-get-a-url)
4. [Phase 3 — Set up the database](#phase-3--set-up-the-database)
5. [Phase 4 — Create the Zoom Marketplace app](#phase-4--create-the-zoom-marketplace-app)
6. [Phase 5 — Wire env vars into Vercel and redeploy](#phase-5--wire-env-vars-into-vercel-and-redeploy)
7. [Phase 6 — Validate the webhook in Zoom](#phase-6--validate-the-webhook-in-zoom)
8. [Phase 7 — Install and test](#phase-7--install-and-test)
9. [Troubleshooting](#troubleshooting)
10. [What's intentionally missing from this MVP](#whats-intentionally-missing-from-this-mvp)

---

## 1. Prerequisites

You'll need:

- **A GitHub account** with `git` configured locally.
- **Node.js 20 or later** installed locally. Run `node --version` to check —
  if you get an error or a version below 20, install from
  [nodejs.org](https://nodejs.org/) (LTS).
- **A Zoom account** that can host meetings. A free Basic account works. The
  account you sign into at marketplace.zoom.us must be the same one you'll
  use to host test meetings. If you're on a Pro/Business plan, even better.
- **A Neon Postgres database** (you said you've done this — keep the
  connection string handy).
- **A Vercel account** — sign up at [vercel.com](https://vercel.com) with
  GitHub for the smoothest experience.

---

## Phase 1 — Push the code to GitHub

Skip this section if you already have the code on GitHub.

```bash
cd notebouncer-mvp

# Initialize git if you haven't already
git init
git add .
git commit -m "Initial NoteBouncer MVP scaffold"

# Create a new GitHub repo (private is fine — it's just for you)
# Then connect it:
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/notebouncer-mvp.git
git push -u origin main
```

---

## Phase 2 — First Vercel deploy (get a URL)

We're deploying first **without any Zoom credentials** — this seems
backwards, but it's the cleanest path because you need a public URL before
you can set up the Zoom Marketplace app, and Zoom won't accept a localhost
URL.

### Step 2.1 — Create the project

1. Go to [vercel.com/new](https://vercel.com/new).
2. Click **Import** next to your `notebouncer-mvp` repo. (If the repo doesn't
   show up, click "Adjust GitHub App Permissions" and grant Vercel access to
   it.)
3. On the configuration screen:
   - **Framework Preset**: should auto-detect as Next.js. Leave it.
   - **Root Directory**: leave as `./` (the repo root).
   - **Build / Output Settings**: leave defaults. The `package.json` already
     has `prisma generate && next build`.
   - **Environment Variables**: expand this section. Add only these two for
     now (we'll add the rest after the Zoom setup):

     | Key | Value |
     |---|---|
     | `DATABASE_URL` | your Neon connection string |
     | `TOKEN_ENCRYPTION_KEY` | run the command below to generate this |

     Generate the encryption key on your local machine:

     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
     ```

     Paste the output as the value. Save it somewhere too — if you lose it,
     you can't decrypt any tokens that have already been stored, and you'll
     need to re-install on Zoom.

4. Click **Deploy**. The first build takes 1–2 minutes.

### Step 2.2 — Note your production URL

Once deployed, Vercel shows you the URL. It looks like: 

```
https://notebouncer-mvp-yourusername.vercel.app
```

Or if you have other projects with the same name, something like
`notebouncer-mvp-q4j8.vercel.app`.

**Copy this URL exactly. You'll paste it into Zoom in three different places.**

If you visit the URL right now, you'll see the landing page with the
"Install on Zoom" button. **Don't click it yet** — Zoom isn't configured.

> **Note about preview URLs**: Each PR or push creates a new preview URL.
> Zoom only knows about your *production* URL — the stable one above. Don't
> waste time configuring Zoom against preview URLs.

---

## Phase 3 — Set up the database

The schema needs to be pushed to Neon once. Easiest way: run Prisma locally
against your Neon connection string.

### Step 3.1 — Install dependencies and configure local env

```bash
cd notebouncer-mvp
npm install
```

Create a file called `.env` in the project root (it's gitignored):

```bash
DATABASE_URL="postgresql://user:pass@your-neon-host/db?sslmode=require"
```

Use your real Neon connection string here. (You can get it from the Neon
dashboard → your project → "Connection Details".)

### Step 3.2 — Push the schema

```bash
npx prisma db push
```

You should see something like:

```
🚀  Your database is now in sync with your Prisma schema.
✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in 89ms
```

That's it — the `users`, `oauth_tokens`, and `audit_log` tables now exist in
Neon. You can verify by visiting your Neon dashboard → Tables.

You won't need to run this again unless you change `prisma/schema.prisma`.

---

## Phase 4 — Create the Zoom Marketplace app

This is the longest phase. Plan for ~30–45 minutes the first time.

### Step 4.1 — Open the developer console

1. Sign into [marketplace.zoom.us](https://marketplace.zoom.us) with the same
   Zoom account you'll use as a test host.
2. Top-right corner: click **Develop** → **Build App**. (Or go to
   [marketplace.zoom.us/develop/create](https://marketplace.zoom.us/develop/create).)

### Step 4.2 — Choose app type

You'll see several app types. Pick:

- **General App**

  *Why not "Zoom App"? — On Basic (free) accounts the in-client Zoom App
  option often isn't available, and we're not building the sidebar in the MVP
  anyway.*

Click **Create**.

### Step 4.3 — Choose how the app is managed

Zoom asks: who manages this app?

- Pick **User-managed** (formerly called "Personal Account").

  *Each individual user grants the app permission to access their personal
  Zoom data. This is what you want for testing on your own account without
  going through admin approval.*

Give it a name: `NoteBouncer Dev` (or anything). Click **Create**.

### Step 4.4 — Basic Information tab

You'll land in the dev app config. The left sidebar has tabs:
**Basic Information**, **Surface**, **Scopes**, **Add Feature**, etc.
(The exact labels may vary slightly — Zoom's UI changes month to month.)

Fill in the **Basic Information** tab:

- **App name**: NoteBouncer Dev
- **Short description**: anything, this is just for you
- **Long description**: anything
- **Company name / Developer contact**: your details
- **Privacy policy URL**: any URL — for personal dev use, you can use your
  Vercel URL or a placeholder like `https://example.com/privacy`. Required
  field, but not validated for personal apps.
- **Terms of use URL**: same — placeholder is fine.

You'll see a **Development credentials** section with:
- **Client ID**
- **Client Secret**

**Copy both of these and keep them in a temporary scratchpad.** You'll paste
them into Vercel in Phase 5.

### Step 4.5 — App Credentials / Redirect URLs

Still on Basic Information (or under a tab called "App Credentials" /
"OAuth"):

- **OAuth Redirect URL for OAuth**: paste
  `https://YOUR-VERCEL-URL.vercel.app/api/oauth/callback`
- **OAuth Allow List**: add the same URL, or just `https://YOUR-VERCEL-URL.vercel.app`

Save the page.

### Step 4.6 — Surface (or "Features") tab — enable webhooks

The exact label here is unstable: it's been called "Features", "Surface",
"Embed", or "Add Feature" in different Zoom UI revisions. Look for a section
to **subscribe to events** or **event subscriptions**.

1. Toggle **Event Subscriptions** ON.
2. Add a subscription. You'll be asked for:
   - **Subscription name**: `Participant join events` (just a label)
   - **Event notification endpoint URL**:
     `https://YOUR-VERCEL-URL.vercel.app/api/zoom/webhook`
   - **Validation method**: choose **Validate by Token** (sometimes called
     "challenge response" or "URL validation" — it's the HMAC handshake the
     code already implements).

3. **Secret Token**: Zoom shows you a secret token for this subscription.
   **Copy it** — this is your `ZOOM_WEBHOOK_SECRET`.

4. **Add Events** to the subscription:
   - Under **Meeting**, find and add:
     - `Participant/Host joined meeting` → emits `meeting.participant_joined`
     - (Optional but recommended) `Participant/Host left meeting`
     - (Optional) `Meeting started` and `Meeting ended` for richer logs
     - (Optional) `Participant joined waiting room` if you want to remove
       bots before they're admitted
   - Under **App Marketplace** (or scroll for it), add:
     - `App Deauthorized` → so you can clean up if a user uninstalls

5. **Save** — but **don't click Validate yet**. The endpoint isn't live
   until Phase 6.

### Step 4.7 — Scopes tab

This is where the spec's warning about scope migration matters most. The
exact strings depend on whether your account is on classic or granular
scopes.

You need scopes for three things:
1. Identifying who installed the app (read user info)
2. Reading meeting and participant data
3. Removing participants from a live meeting

In the Scopes tab, click **Add Scopes** and search/check for:

| Purpose | Granular scope (current) | Classic scope (older accounts) |
|---|---|---|
| Identify the host | `user:read:user` | `user:read` |
| Read meeting metadata | `meeting:read:meeting` | `meeting:read` |
| Read participants on live meetings | `meeting:read:participant` | (covered by `meeting:read`) |
| **Remove participants from live meeting** | `meeting:write:in_meeting_control` or `meeting:update:in_meeting_control` | `meeting:write` |

The names you actually see depend on your account vintage. **Search the
scope picker for words like "in-meeting", "participant", "remove", "control"
and pick whatever's there.** The descriptions next to the scopes describe
what they do — pick the ones whose descriptions mention "in-meeting
controls" or "remove participants from a live meeting."

> **Heads up — possible blocker**: removing participants from a live meeting
> historically required `meeting:write:admin` or `meeting:master`, which
> are **account-level scopes** and **don't appear** in user-managed app
> configs on free accounts. If after Phase 7 your removal calls return
> `403 Forbidden` or `4711` errors, this is why. Your two options:
>
> 1. Switch your app to **Admin-managed** distribution (requires you to be
>    an account admin — works on free accounts where you're the only user).
> 2. Build a **Server-to-Server OAuth app** instead. This is a different
>    app type entirely, no OAuth flow, you generate tokens directly from
>    account credentials. The detection and removal code in this repo would
>    work the same way; you'd swap out `lib/zoom.ts`'s OAuth logic for a
>    direct token exchange. This is actually the cleanest path for a
>    personal-demo MVP — happy to walk through it if you hit the wall.

Save scopes.

### Step 4.8 — Don't worry about anything else

Other tabs (Information, Submission, Embed, etc.) are for public Marketplace
listings. Since your distribution is **User-managed** and you're not
publishing publicly, you can ignore them.

You should now have a Zoom app in development mode with:
- Client ID, Client Secret, Webhook Secret all copied
- Redirect URL pointing at your Vercel app
- Webhook endpoint pointing at your Vercel app
- Scopes selected

Leave the Zoom dev console open — you'll come back to it in Phase 6.

---

## Phase 5 — Wire env vars into Vercel and redeploy

### Step 5.1 — Add the remaining env vars

1. Go to your Vercel project → **Settings** → **Environment Variables**.
2. Add (or edit) these:

   | Key | Value |
   |---|---|
   | `ZOOM_CLIENT_ID` | from Zoom dev console (Step 4.4) |
   | `ZOOM_CLIENT_SECRET` | from Zoom dev console (Step 4.4) |
   | `ZOOM_WEBHOOK_SECRET` | from Zoom dev console (Step 4.6) |
   | `ZOOM_REDIRECT_URI` | `https://YOUR-VERCEL-URL.vercel.app/api/oauth/callback` |
   | `NEXT_PUBLIC_APP_URL` | `https://YOUR-VERCEL-URL.vercel.app` |

   (`DATABASE_URL` and `TOKEN_ENCRYPTION_KEY` should already be set from
   Phase 2.)

3. For each variable, make sure all three environments are checked:
   **Production**, **Preview**, **Development**.

### Step 5.2 — Redeploy

Env var changes don't trigger automatic redeploys. Force one:

1. Go to **Deployments** tab.
2. Click the `...` menu on your latest deployment.
3. Click **Redeploy**. Confirm.

Wait ~90 seconds for it to finish.

---

## Phase 6 — Validate the webhook in Zoom

Now go back to your Zoom Marketplace dev app, **Event Subscriptions** tab.

1. Find your webhook subscription. Next to the endpoint URL, there's a
   **Validate** button. Click it.
2. If everything is correctly configured, you'll see a green check or
   "Validated" status within a few seconds.
3. If it fails, see [Troubleshooting](#troubleshooting) below — almost
   always a `ZOOM_WEBHOOK_SECRET` mismatch between Zoom and Vercel.

### How the validation handshake works

Zoom POSTs `{ event: "endpoint.url_validation", payload: { plainToken: "..." } }`
to your webhook. Your code (in `app/api/zoom/webhook/route.ts`) responds
with `{ plainToken, encryptedToken: HMAC_SHA256(plainToken, secret) }`.
Zoom verifies the HMAC and marks the endpoint validated.

If Zoom's secret doesn't match what your code is HMACing with, validation
fails. There's no way to recover from a mismatch other than copying the
secret correctly into Vercel and redeploying.

---

## Phase 7 — Install and test

### Step 7.1 — Install the app on yourself

1. Visit `https://YOUR-VERCEL-URL.vercel.app`.
2. Click **Install on Zoom**.
3. You'll be redirected to Zoom's OAuth consent screen. Review the
   permissions. Click **Allow**.
4. You'll land back at `/dashboard?installed=1` and see a green
   "Installed successfully" banner.

If you see an error banner instead, check the URL bar — the error reason
will be in the query string (`?error=token_exchange`, etc). See
[Troubleshooting](#troubleshooting).

### Step 7.2 — Test the bot removal

Here's the trick: **you don't need a real notetaker bot to verify the
pipeline**. Zoom's webhooks fire for any participant join, and the
detection module matches on participant name. So:

1. Start a Zoom meeting from the **same Zoom account** you installed the
   app on. **You must be the host** — the OAuth grant gave NoteBouncer
   permission to act as you, the host.

2. Get your phone, a friend's computer, or an incognito browser window.

3. Join the meeting **as a guest** (not signed into Zoom, or signed into a
   different account). When prompted for your name, enter:

   ```
   Otter.ai Notetaker
   ```

   Or any of these — they're all in the regex list:
   ```
   Fireflies Notetaker
   Fathom AI Notetaker
   Read.ai
   tl;dv
   Granola Bot
   ```

4. Watch what happens.

   **If everything works**: the guest gets kicked from the meeting within
   2–3 seconds of joining. The host (you) sees the "left the meeting"
   notification.

5. Refresh `https://YOUR-VERCEL-URL.vercel.app/dashboard`. You should see a
   new entry in **Recent removals** with the participant name, match
   reason, and latency in milliseconds.

6. Try a real human name (your own) to confirm it doesn't false-positive.
   Join as `John Smith` — you should not be removed. Nothing appears in
   the dashboard. ✓

---

## Troubleshooting

### Webhook validation fails

- **Most common cause**: `ZOOM_WEBHOOK_SECRET` in Vercel doesn't match the
  secret token Zoom shows for that subscription. Re-copy from Zoom
  (Event Subscriptions → your subscription → Secret Token) and paste into
  Vercel. Redeploy.
- **Second most common**: the webhook URL has a typo. Should end in
  `/api/zoom/webhook`, not `/zoom/webhook` or `/webhook`.
- **Third**: Vercel isn't redeployed after the env var change. Vercel only
  picks up env vars on new deploys. Force a redeploy from the Deployments
  tab.

### OAuth install fails with `state_mismatch`

Browser is dropping the cookie. Common causes:
- Strict cookie blocking (Brave, Safari with strict tracking prevention).
  Try Chrome.
- The redirect URL in Zoom doesn't *exactly* match `ZOOM_REDIRECT_URI` in
  Vercel. Trailing slashes matter. Subdomain matters. https vs http matters.

### OAuth install fails with `token_exchange`

- Wrong `ZOOM_CLIENT_ID` or `ZOOM_CLIENT_SECRET` in Vercel.
- The redirect URI in the token-exchange request doesn't match what's
  registered in Zoom. (The code uses `ZOOM_REDIRECT_URI` for both — make
  sure it's the same string in both Vercel and the Zoom console.)

### Bot joins, doesn't get removed, nothing appears in dashboard

Check Vercel logs:
1. Vercel project → **Logs** tab.
2. Filter by `/api/zoom/webhook`.
3. You should see one line per webhook Zoom sends.

If no logs at all → Zoom isn't sending events. Check that:
- Your subscription is saved and validated (Phase 6).
- You've actually selected the `meeting.participant_joined` event in the
  subscription.
- You're hosting the meeting from the same Zoom account that installed
  the app (the webhook fires per-host, not per-meeting).

If logs show webhooks arriving but no removal → check the log for the
specific error. Most common:
- `zoom_api 403`: missing scope. See the warning in Phase 4.7 — you may
  need to switch to Admin-managed or a Server-to-Server app.
- `zoom_api 401`: token refresh failed. Try uninstalling and reinstalling
  the app (`/install`).
- `no_token`: the user record exists but the OAuth token doesn't. Same fix
  — reinstall.

### Bot is detected but match reason is empty / removal logged but bot still in meeting

This means Zoom returned 200 to the API call but didn't actually remove
the bot. This happens when the participant ID format is wrong. Check the
audit log latency — if it's <100ms, the API likely 200'd without doing
anything. Compare the Zoom webhook payload's `participant_user_id` and
`id` fields and adjust `app/api/zoom/webhook/route.ts` line ~115 to use
the correct one for your Zoom version.

### Local development without ngrok

You can develop locally and still test against the live Vercel deploy:
- Make changes locally
- `git push` to your branch
- Vercel auto-deploys preview URL
- Test against the preview URL

This is slower than a tunneling tool but requires zero setup. If you want
faster iteration, use Cloudflare Tunnel (free, persistent URL):

```bash
npm install -g cloudflared
cloudflared tunnel --url http://localhost:3000
```

Update `ZOOM_REDIRECT_URI` and the webhook URL in Zoom to the cloudflared
URL while developing. Switch back to the Vercel URL when done.

---

## What's intentionally missing from this MVP

Listed roughly in priority order. Each one is a clear next step once the
core demo is working.

| Feature | Why it's not here | When you'll want it |
|---|---|---|
| Per-host config UI (allowlist, strictness) | Uses defaults inline | After your first false-positive |
| Dry-run mode | Same — defaults `enabled=true` | Before showing this to a colleague |
| KMS envelope encryption | AES-256-GCM with env key is fine for solo use | Before any second user |
| BullMQ + Redis worker | Synchronous handler is fine at single-host scale | When you have >5 active hosts |
| Sidebar Zoom App (sub-second removal) | Bigger lift, requires Zoom App distribution | When the 2s server-side delay starts to matter |
| Account-wide policy (admin-managed) | Out of scope for personal demo | Before selling to a team |
| Stripe billing | Why monetize a thing nobody uses yet | After 10+ retained users |
| Marketplace submission | 2–6 week review process | When you want public users |
| Notification chat messages, lock meeting, waiting room | Nice-to-haves | Iterate based on what you actually want |

If the MVP works and you want to ship publicly, the spec's section 6
("Build Order and Estimates") is the right roadmap from here.

---

## License

For personal/internal use. Don't ship this commercially without doing the
production hardening listed above.
