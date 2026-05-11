# Project structure

Production layout as of the v3 landing page rollout. Updated whenever
the structure changes meaningfully.

## Top-level

```
notebouncer-mvp/
├── app/                  Next.js App Router — URL routes only
├── components/           React components, organised by surface
├── lib/                  Non-component code: domain logic + infrastructure
├── prisma/               Database schema and migrations
├── public/               Static assets served at the root URL
├── middleware.ts         (none currently — present here as a placeholder slot)
├── next.config.js        Next.js build/runtime config
├── package.json
├── postcss.config.js
├── tailwind.config.ts    Design tokens + content paths
└── tsconfig.json
```

## `app/` — routes and pages

Next.js App Router treats every folder as a URL segment. Files named
`page.tsx` are page entry points. Files named `route.ts` are API
endpoints. Other names (like `loading.tsx`) are reserved for special
behaviours.

```
app/
├── layout.tsx                          Root HTML wrapper, metadata, fonts
├── globals.css                         Global styles + CSS-var design tokens
│
├── (marketing)/                        Route group — no URL prefix
│   └── page.tsx                        Landing page at /
│                                       Export: MarketingLandingPage
│
├── (app)/                              Route group — no URL prefix
│   ├── dashboard/
│   │   ├── page.tsx                    Dashboard at /dashboard
│   │   │                               Export: HostDashboardPage
│   │   ├── loading.tsx                 Loading skeleton during fetch
│   │   │                               Export: HostDashboardLoadingSkeleton
│   │   └── IncidentActivityCard.tsx    Activity table component
│   │                                   (was activity-table.tsx)
│   │
│   └── zoom-home/
│       └── page.tsx                    Zoom sidebar app at /zoom-home
│                                       Export: ZoomSidebarApp
│
├── api/                                Server endpoints
│   ├── oauth/callback/route.ts         Zoom OAuth callback
│   ├── sidebar/config/route.ts         Detection config for sidebar
│   ├── sidebar/event/route.ts          Sidebar action logging
│   └── zoom/webhook/route.ts           Zoom platform webhooks
│
└── install/
    └── route.ts                        Zoom install redirect
                                        Both new + returning users
```

**Route groups**: parentheses around a folder name `(marketing)`,
`(app)` group routes without affecting URLs. They exist so we can
keep marketing surfaces visually separate from authenticated app
surfaces in the codebase.

## `components/` — React components

```
components/
├── landing/                            Used only on the marketing landing page
│   ├── LandingNav.tsx                  Top nav: NoteBouncer + Sapience logo
│   ├── LandingHero.tsx                 Hero with CTA + login link
│   ├── LandingProblemSection.tsx       Two-column problem explainer
│   ├── LandingHowItWorksSection.tsx    Three-step flow + product showcase
│   ├── LandingWhoItsForSection.tsx     Centered universal-audience line
│   ├── LandingFooter.tsx               Sapience logo + Privacy/Terms/Support
│   ├── ProductShowcaseCard.tsx         Stylized in-Zoom sidebar mockup
│   ├── SapienceLogo.tsx                next/image wrapper for the logo
│   └── GoogleSignInButton.tsx          The hero CTA — 4-color G + plum
│
├── dashboard/                          Used only on the dashboard
│                                       (empty for now; dashboard-specific
│                                       widgets live in app/(app)/dashboard/
│                                       for the moment)
│
├── sidebar/                            Used only in the Zoom sidebar
│                                       (empty for now; sidebar widgets
│                                       still inline in zoom-home/page.tsx)
│
└── ui/                                 Shared primitives used across surfaces
    ├── Icon.tsx                        Lucide-family inline SVG icons
    ├── StatusPill.tsx                  Colored pill + TONE_FOR_ACTION map
    ├── SectionLabel.tsx                Uppercase eyebrow with optional action
    ├── BrandMark.tsx                   Small plum chip with shield icon
    └── Avatar.tsx                      Circular initials avatar
```

**Naming convention**: surface-specific components are prefixed with
their surface name (`LandingHero`, not `Hero`). Shared primitives have
no prefix (`Icon`, `StatusPill`). Both are PascalCase.

## `lib/` — non-component code

```
lib/
├── domain/                             Business logic, no external I/O
│   ├── detection.ts                    AI notetaker detection rules
│   ├── dedup.ts                        Group incidents by meeting+participant
│   └── insights.ts                     Rule-based AI insight generation
│
├── infra/                              External system integration
│   ├── db.ts                           Prisma client singleton
│   ├── crypto.ts                       AES-256-GCM token encryption
│   └── zoom.ts                         Zoom API client + token refresh
│
└── copy.ts                             Sidebar UI copy strings and
                                        error humanizer functions
```

**Why split**: `domain/` code is pure logic, easy to test, no
dependencies on databases or APIs. `infra/` code is the "outside
world" — replace it (e.g. swap Prisma for Drizzle) without touching
domain.

## `public/`

```
public/
└── brand/
    └── sapience-ai.png                 12KB transparent PNG, 276×100
                                        natural dimensions
```

Static assets served at the root URL. `/brand/sapience-ai.png`
in JSX resolves to this file.

## Adding a new surface

If a new product surface gets added (say a settings page), the
pattern is:

1. Create the route: `app/(app)/settings/page.tsx`
   with meaningful export name like `HostSettingsPage`.

2. Create surface-specific components in `components/settings/`
   with prefixed names like `SettingsSidebar`, `SettingsForm`.

3. Lift any genuinely shared component to `components/ui/` only
   when used by 2+ surfaces.

4. Domain logic goes in `lib/domain/`. External integration in
   `lib/infra/`. Neither directly imports React.
