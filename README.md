# Ellie Life Project Assistant

A meaning-first life planning tool. Instead of starting with tasks, Ellie starts
with your **life areas**, the **values** that matter in them, and the
**projects** that serve those values — then turns each project into an adaptable
**journey** of initiatives and epics.

> Calm, intentional, spacious, supportive, non-judgmental — not performance-driven.

This is the **proof-of-concept**: a multi-user web app built to validate the core
experience (`Life Area → Value → Project → Journey → Reflection`). Each person
signs in and sees only their own life map.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** for the design language
- **Prisma 6** + **SQLite** for persistence (single file, zero setup)
- **React Flow** for the Life Map canvas
- Custom pointer-based timeline for the Project Journey (drag + resize)
- Sessions on Node's built-in `scrypt` + an httpOnly cookie — **no auth
  dependency**

All mutations go through **Next server actions** (`src/lib/actions.ts`) — there is
no separate API layer.

## Getting started

```bash
npm install
npm run db:push     # create the SQLite database from the schema
npm run db:seed     # load a demo account with a sample life map
npm run dev         # http://localhost:3000
```

The seed creates **demo@luma.local / demo-password** — sign in with that to see
the sample map. To work as yourself instead, make an account:

```bash
npm run user:add -- you@example.com "a good password" "Your Name"
```

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Run the app locally |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:push` | Sync the Prisma schema to the database |
| `npm run db:seed` | Reset + seed the demo account's sample data |
| `npm run db:backfill` | Give pre-auth data an owner (see *Accounts*) |
| `npm run user:add` | Create a user, or reset an existing one's password |
| `npm run user:provision` | Create the accounts listed in `INVITE_USERS` |
| `npm run db:showcase` | Fill `SHOWCASE_EMAIL`'s account with the example map |
| `npm run db:studio` | Browse the data in Prisma Studio |
| `npm run test:e2e` | Run the Playwright end-to-end suite |

## Accounts

There is **no public sign-up** — accounts are created by invitation while LUMA is
finding its feet. Everything else works the way any multi-user app does.

Two ways to make one:

- **Locally**: `npm run user:add -- them@example.com "their password" "Name"`.
  Re-running it on an existing address resets that password.
- **On the deployed app**, where the database isn't reachable from a laptop: add
  them to the `INVITE_USERS` environment variable and redeploy —
  `INVITE_USERS="ana@example.com:her-password,ben@example.com:his-password"`.
  This is **create-only**: accounts that already exist are left completely alone,
  so a deploy can never silently change how someone signs in (use `user:add` for
  that). New accounts start with an empty life map.

### A showcase account

For demos, set `SHOWCASE_EMAIL` to an existing account and the build fills it
with the worked example in [`prisma/sample-map.ts`](prisma/sample-map.ts) — five
life areas, five journeys mid-flight, a couple of reflections, and several months
of satisfaction history so every screen has something real to show. Dates are
relative to today, so it never looks abandoned.

It only fills an account whose map is **empty**, so whatever you do during a demo
survives the next deploy. To deliberately reset it, run it once with
`SHOWCASE_RESET=1`.

The same data backs `npm run db:seed` locally, so there's only one example to
maintain.

**How sign-in works.** Passwords are hashed with Node's built-in `scrypt`
(`src/lib/password.ts`). Signing in creates a row in `Session` and puts a random
token in an httpOnly cookie; only the SHA-256 of that token is stored, so a copy
of the database can't be replayed as a login. Deleting the row signs that browser
out immediately.

**How your data stays yours.** `LifeArea` and `Project` are the only roots, so
they carry the owner; values, initiatives, epics and reflections inherit it from
their parent. Reads are scoped in `src/lib/data.ts`, which calls `requireUser()`
itself — there is no unscoped way to ask for the data.

Writes matter more. Server actions are ordinary HTTP endpoints, so scoping the
reads alone would leave every write open to anyone who knows an id. Instead of 22
hand-written checks, the ownership test lives *inside the query*
(`src/lib/scope.ts`):

```ts
prisma.epic.update({
  where: { id, initiative: { project: { userId } } },  // wrong owner → no write
  data: { isComplete },
})
```

`src/proxy.ts` also bounces signed-out visitors to `/login`, but that is only a
fast path — it never touches the database, and the real check is always
`requireUser()`.

**Coming from the single-user version?** The life areas and projects that existed
before accounts have no owner, and unowned rows are invisible to everyone. Give
them to their rightful account once:

```bash
OWNER_EMAIL=you@example.com OWNER_PASSWORD="a good password" npm run db:backfill
```

It's idempotent — once every row has an owner it does nothing — and it refuses to
run silently: if it finds unowned rows and no `OWNER_EMAIL`, it fails rather than
let the data quietly disappear.

## Testing

End-to-end tests (Playwright, driving the real UI in Chrome) live in [`e2e/`](e2e/)
and cover the spec's **Final Acceptance Test** from an empty database:

```bash
npm run test:e2e
```

The suite spins up its own dev server against an **isolated** `prisma/test.db`
(it temporarily points `.env` at the test database and restores it afterwards),
so it never touches your local `dev.db`. It verifies the full flow — create life
areas, rate satisfaction, add values, create a project with a required "Why",
connect it to values, open the journey, add initiatives + epics, complete an epic
to move progress, add a reflection — plus drag-to-reschedule on the timeline and
that everything **persists across a reload**.

[`e2e/auth.spec.ts`](e2e/auth.spec.ts) covers accounts: signed-out visitors are
redirected, the login form works, a wrong password says nothing about who has an
account, and — the point of the whole thing — two people never see each other's
map, including when one holds the other's project URL. Tests sign in by minting a
session directly (`e2e/auth.ts`) rather than driving the form each time.

## Project structure

```
prisma/
  schema.prisma          data model (User, Session, LifeArea→Value→Project→Initiative→Epic, Reflection)
  sample-map.ts          the worked example, shared by the seed and the showcase
  seed.ts                seeds it into the local demo account
scripts/
  user-add.ts            create a user / reset a password
  provision-users.ts     create invited accounts from INVITE_USERS (create-only)
  backfill-owner.ts      give pre-auth data an owner (idempotent)
  showcase.ts            fill SHOWCASE_EMAIL's account with the example map
  use-postgres.mjs       swap the datasource to Postgres for the Vercel build
src/
  proxy.ts               optimistic signed-out redirect (edge; no database)
  app/
    page.tsx             Life Map (home)
    login/               sign-in screen
    projects/[id]/       Project Journey
  components/
    lifemap/             React Flow canvas, nodes, project dialog
    journey/             timeline, epics, reflections
    LoginForm.tsx        email + password form
    UserMenu.tsx         who you are, and sign out
    ui.tsx               shared primitives (satisfaction scale, inline edit, button)
  lib/
    prisma.ts            Prisma client singleton
    data.ts              read queries + progress roll-ups (scoped to the user)
    actions.ts           server actions (all writes, all ownership-checked)
    auth.ts              getCurrentUser / requireUser — the authorization front door
    scope.ts             the ownership tree, as query filters
    session.ts           session rows + the cookie
    session-cookie.ts    just the cookie name (safe to import from the edge)
    password.ts          scrypt hashing
```

## What's in scope (per the spec)

- **Life Map** — create/edit/delete life areas, 1–10 satisfaction, values, and a
  visual canvas connecting projects to values (drag a project's dot onto a value;
  click a line to disconnect).
- **Projects** — name + a required "Why", linked to one or more values.
- **Project Journey** — a timeline of initiatives you can drag and resize, each
  broken into epics.
- **Progress** — completing epics rolls up to initiative and project progress.
- **Reflection** — capture _what changed / why / next step_ as plans evolve.
- **Accounts** — sign in to your own private life map (invite-only, see above).

Deliberately **out of scope**: AI, teams, habits, calendar, notifications,
analytics, native mobile, and the Epic→Story→Task layer.

### The natural next step: Google sign-in

The `User` model is already shaped for it — `passwordHash` is optional and
there's an unused `googleId` — so adding Google is roughly 100 lines of OAuth
that ends in the same `startSession(userId)` call, with **no migration and no
change to any of the scoping above**. Password accounts keep working alongside
it. The only prerequisite is external: a Google Cloud OAuth client, with redirect
URIs registered for `localhost:3000` and the deployed domain.

## Deploying to Vercel (shareable link)

Locally the app uses **SQLite** (zero setup). Vercel's servers don't keep files
between requests, so the hosted version uses **Postgres** instead. This switch is
automated — you don't change any code:

- `scripts/use-postgres.mjs` rewrites the Prisma datasource to PostgreSQL **only
  during the Vercel build** (in Vercel's throwaway checkout). Your local schema
  stays SQLite, so `npm run dev` and the tests keep working unchanged.
- The `vercel-build` script (in `package.json`) runs on Vercel: swap to Postgres
  → generate client → create the tables (`prisma db push`) → **create invited
  accounts** (`provision-users`) → **give any unowned data an owner**
  (`backfill-owner`) → **fill the showcase account** (`showcase`) → seed the
  sample map **once** (only if the database is empty) → `next build`. Every step
  after the push is idempotent, so this same sequence runs safely on every
  redeploy.

### One-time setup

1. **Push the repo to GitHub** (`git init` is already done):
   ```bash
   git add -A && git commit -m "Ellie Life Project Assistant PoC"
   gh repo create ellie-life-project-assistant --private --source=. --push   # or create a repo in the GitHub UI and push
   ```
2. **Import it into Vercel** → New Project → pick the repo → Deploy. (The first
   deploy will fail until the database exists — that's expected, do step 3.)
3. **Add Postgres**: in the Vercel project, open **Storage → Create Database →
   Postgres**, and connect it to the project. Vercel adds the connection
   environment variables automatically.
4. **Map two env vars** (Project → Settings → Environment Variables) so Prisma
   finds them — set both to the values the integration created:
   - `DATABASE_URL` → the **pooled** connection string (`...POSTGRES_PRISMA_URL`)
   - `DIRECT_URL` → the **direct / non-pooled** string (`...POSTGRES_URL_NON_POOLING`)
5. **Redeploy** (Deployments → ⋯ → Redeploy). The build creates the schema and
   seeds the sample map, and you get a live
   `https://ellie-life-project-assistant-….vercel.app` link.

Every later `git push` redeploys; the seed won't overwrite real data (it only
runs on an empty database).

### Adding accounts to a deployment that already has data

The hosted app previously had no accounts, so its life areas and projects have no
owner — and unowned rows are invisible to everyone. **Before the first deploy of
this version**, set these environment variables in Vercel (Settings →
Environment Variables):

- `INVITE_USERS` — the accounts to create, as `email:password` pairs
- `OWNER_EMAIL` — which of them inherits the existing map
- `OWNER_PASSWORD` — a fallback, only used if `OWNER_EMAIL` has no account yet

The build creates the accounts, then hands the existing map to `OWNER_EMAIL`.
If you forget, the build **fails on purpose** rather than deploying an app whose
data has silently vanished — set the variables and redeploy.

Leaving the variables in place afterwards is harmless: every step is a no-op once
it has run, and no deploy ever changes an existing password.

> **Once the backfill has run**, `userId` on `LifeArea` and `Project` can become
> required in `prisma/schema.prisma` (drop the two `?`) so the database enforces
> what the app already guarantees. It's left optional only to make this migration
> safe — do it as a separate deploy, after confirming the map still looks right.

### Prefer to keep SQLite?

Deploy to a host with a **persistent volume** (Railway, Fly.io) instead of Vercel,
and skip the Postgres switch entirely.
