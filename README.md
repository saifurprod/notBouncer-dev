# NoteBouncer MVP v0.2

Detects AI notetaker bots in your Zoom meetings and auto-removes them when
the sidebar app is open.

## What's in this build

Three components working together:

1. **Server-side detection** (passive) — Zoom webhooks fire when participants
   join. The Next.js webhook handler runs detection and logs detected bots to
   the database. **Does not remove** — Zoom's REST API doesn't support
   removing meeting participants.

2. **Sidebar Zoom App** (active removal) — A page at `/zoom-home` that loads
   inside Zoom's in-client browser. Uses the Zoom Apps SDK to detect bots
   in real-time and remove them via `removeParticipant()`. Works only when
   the host has the sidebar open during a meeting.

3. **Dashboard** (`/dashboard`) — Shows hosts, stats, and a unified activity
   log of both webhook detections and sidebar removals.

## Architecture

```
                   Zoom platform
                   /            \
         webhooks  /              \  Apps SDK (in-meeting)
                  /                \
                 v                  v
       ┌────────────────┐    ┌──────────────────┐
       │  /api/zoom/    │    │   /zoom-home     │
       │  webhook       │    │   (sidebar)      │
       │                │    │                  │
       │  detects bot   │    │  detects bot     │
       │  → audit_log   │    │  → removes it    │
       │    (passive)   │    │  → audit_log     │
       └────────────────┘    │    (active)      │
                  \          └──────────────────┘
                   \              /
                    v            v
                  ┌──────────────────┐
                  │   /dashboard     │
                  │  unified view    │
                  └──────────────────┘
```

## Deployment

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "NoteBouncer MVP v0.2"
git remote add origin https://github.com/YOUR_USERNAME/notebouncer-mvp.git
git push -u origin main
```

### 2. Set up Neon Postgres

Sign up at [neon.tech](https://neon.tech), create a project, copy the
connection string.

### 3. Generate token encryption key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Save the output.

### 4. Create Vercel project

Import the GitHub repo at [vercel.com/new](https://vercel.com/new).

Add these environment variables (all environments: Production, Preview,
Development):

| Key | Value |
|---|---|
| `DATABASE_URL` | your Neon connection string |
| `TOKEN_ENCRYPTION_KEY` | output of step 3 |
| `ZOOM_CLIENT_ID` | (will fill in step 6) |
| `ZOOM_CLIENT_SECRET` | (will fill in step 6) |
| `ZOOM_WEBHOOK_SECRET` | (will fill in step 6) |
| `ZOOM_REDIRECT_URI` | `https://YOUR-DOMAIN.vercel.app/api/oauth/callback` |
| `NEXT_PUBLIC_APP_URL` | `https://YOUR-DOMAIN.vercel.app` |

Deploy. Note your production URL — it's the one without a deployment hash.

### 5. Push database schema

Locally:

```bash
npm install
echo 'DATABASE_URL="your-neon-string"' > .env
npx prisma db push
```

### 6. Configure Zoom Marketplace

In your Zoom dev console (`marketplace.zoom.us/develop/created`):

**Basic Information / OAuth:**
- App type: **General App**
- Distribution: **User-managed**
- OAuth Redirect URL: `https://YOUR-DOMAIN.vercel.app/api/oauth/callback`
- OAuth Allow List: `https://YOUR-DOMAIN.vercel.app`

**Scopes:** Add these (search the picker; names may vary by account):
- `user:read:user` (or `user:read`)
- `meeting:read:meeting` (or `meeting:read`)
- `meeting:read:participant`
- `zoomapp:inmeeting`

**Surface tab:**
- Tick **Meetings** under "Select where to use your app"
- Home URL: `https://YOUR-DOMAIN.vercel.app/zoom-home`
- Domain Allow List: `https://YOUR-DOMAIN.vercel.app`
- **Zoom App SDK** section, tick these APIs:
  - `removeParticipant`
  - `getMeetingParticipants`
  - `getRunningContext`
  - `getMeetingContext`
- And these Events:
  - `onParticipantChange`

**Feature tab → Event Subscriptions:**
- Endpoint URL: `https://YOUR-DOMAIN.vercel.app/api/zoom/webhook`
- Events:
  - `Meeting → Participant/Host joined meeting`
  - `App Marketplace → App Deauthorized`
- Copy the Secret Token → paste into Vercel as `ZOOM_WEBHOOK_SECRET`

After saving Vercel env vars, force a redeploy (uncheck Build Cache).

Click **Validate** on the webhook subscription in Zoom — should turn green.

### 7. Install on yourself

Visit `https://YOUR-DOMAIN.vercel.app` → click **Install on Zoom** → Allow.

You should land on `/dashboard?installed=1` with your name in Connected hosts.

### 8. Test the sidebar

1. Open Zoom desktop client (signed into the same account that installed)
2. Start a new meeting
3. Click the **Apps** button in the meeting toolbar (puzzle-piece icon)
4. Find **NoteBouncer Dev** and click it
5. The sidebar should open showing "Watching: <meeting name>" in green
6. Have a guest join the meeting (incognito browser, name `Otter.ai Notetaker`)
7. The sidebar's Activity log should show:
   - `join: Otter.ai Notetaker`
   - `Bot detected: Otter.ai Notetaker (name:otter)`
   - `Removed: Otter.ai Notetaker (XYZms)`
8. The guest gets kicked from the meeting
9. Refresh `/dashboard` — should see a new row with `removed` action and
   `sidebar` source

## File structure

```
notebouncer-mvp/
├── app/
│   ├── api/
│   │   ├── oauth/callback/route.ts        OAuth code exchange
│   │   ├── sidebar/
│   │   │   ├── config/route.ts            Sidebar fetches detection config
│   │   │   └── event/route.ts             Sidebar reports removals here
│   │   └── zoom/webhook/route.ts          Passive webhook detection
│   ├── dashboard/page.tsx                 Activity dashboard
│   ├── install/route.ts                   Kicks off OAuth
│   ├── zoom-home/page.tsx                 ★ Sidebar Zoom App
│   ├── layout.tsx
│   ├── page.tsx                           Landing page
│   └── globals.css
├── lib/
│   ├── crypto.ts                          AES token encryption
│   ├── db.ts                              Prisma client
│   ├── detection.ts                       Bot detection (shared client+server)
│   └── zoom.ts                            OAuth + user fetch helpers
├── prisma/schema.prisma
├── .env.example
├── .gitignore
├── next.config.js                         CSP/security headers for Zoom
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

## How removal actually works

The sidebar runs inside the Zoom desktop client when you open it from the
Apps panel. It uses the Zoom Apps SDK:

1. `getRunningContext()` — confirms we're `inMeeting`
2. `getMeetingParticipants()` — gets current roster, runs detection on each
3. `addEventListener('onParticipantChange')` — fires whenever anyone joins
4. For each participant, runs `detect()` from `lib/detection.ts`
5. If matched, calls `sdk.removeParticipant({ participantUUID })` — this is
   the actual kick
6. Reports the action to `/api/sidebar/event` so the dashboard sees it

Latency: typically <500ms from join to removed.

## Behavior matrix

| Scenario | Webhook detection | Sidebar removal | Bot kicked? |
|---|---|---|---|
| Sidebar open in your meeting | ✓ logged | ✓ removes | Yes |
| Sidebar closed in your meeting | ✓ logged | — | No (logged only) |
| You're not host of the meeting | — | — | No |

## Troubleshooting

### Sidebar doesn't appear in Zoom's Apps panel

- Verify Home URL in Surface tab matches your Vercel URL exactly
- Verify `Meetings` is ticked under "Select where to use your app"
- Uninstall and reinstall the app via `/install` after changing scopes

### Sidebar shows "outside Zoom" or error

- Open browser dev tools (right-click in sidebar → Inspect)
- Check console for CSP violations or SDK init errors
- Verify `next.config.js` headers are deployed (test: `curl -I https://YOUR-DOMAIN.vercel.app/zoom-home`)

### Sidebar loads but doesn't detect/remove

- Check the activity log inside the sidebar for what's happening
- If you see `join: SomeBot` but no `Bot detected:` line, the name doesn't
  match a regex — add it to `lib/detection.ts`
- If you see `Bot detected:` but no `Removed:`, check the error in the log
  — it might be a missing SDK capability

### Webhook detections aren't appearing in dashboard

- Vercel Logs filter `/api/zoom/webhook`
- Should see 200 responses for participant joins
- If 401 → webhook secret mismatch
- If no entries at all → subscription not validated, or you're not host

## What's intentionally not in this build

- Sidebar context-token verification (spec section 4.8) — for trust hardening
- KMS envelope encryption — env-key AES is fine for solo dev
- BullMQ/Redis worker — synchronous webhook handler is fine at this scale
- Per-host config UI — uses defaults inline
- Stripe billing
- Marketplace public submission

These are all clear next steps once the core demo works.

## License

Personal/internal use.
