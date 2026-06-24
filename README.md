# Ellie Life Project Assistant

A meaning-first life planning tool. Instead of starting with tasks, Ellie starts
with your **life areas**, the **values** that matter in them, and the
**projects** that serve those values — then turns each project into an adaptable
**journey** of initiatives and epics.

> Calm, intentional, spacious, supportive, non-judgmental — not performance-driven.

This is the **v0 proof-of-concept**: a single-user web app with no auth, built to
validate the core experience (`Life Area → Value → Project → Journey → Reflection`).

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** for the design language
- **Prisma 6** + **SQLite** for persistence (single file, zero setup)
- **React Flow** for the Life Map canvas
- Custom pointer-based timeline for the Project Journey (drag + resize)

All mutations go through **Next server actions** (`src/lib/actions.ts`) — there is
no separate API layer.

## Getting started

```bash
npm install
npm run db:push     # create the SQLite database from the schema
npm run db:seed     # load a sample life map + project journey
npm run dev         # http://localhost:3000
```

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Run the app locally |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:push` | Sync the Prisma schema to the database |
| `npm run db:seed` | Reset + seed sample data |
| `npm run db:studio` | Browse the data in Prisma Studio |
| `npm run test:e2e` | Run the Playwright end-to-end suite |

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

## Project structure

```
prisma/
  schema.prisma          data model (LifeArea→Value→Project→Initiative→Epic, Reflection)
  seed.ts                sample data
src/
  app/
    page.tsx             Life Map (home)
    projects/[id]/       Project Journey
  components/
    lifemap/             React Flow canvas, nodes, project dialog
    journey/             timeline, epics, reflections
    ui.tsx               shared primitives (satisfaction scale, inline edit, button)
  lib/
    prisma.ts            Prisma client singleton
    data.ts              read queries + progress roll-ups
    actions.ts           server actions (all writes)
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

Deliberately **out of scope** for v0: auth, AI, teams, habits, calendar,
notifications, analytics, native mobile, and the Epic→Story→Task layer.

## Deploying to Vercel (shareable link)

Locally the app uses **SQLite** (zero setup). Vercel's servers don't keep files
between requests, so the hosted version uses **Postgres** instead. This switch is
automated — you don't change any code:

- `scripts/use-postgres.mjs` rewrites the Prisma datasource to PostgreSQL **only
  during the Vercel build** (in Vercel's throwaway checkout). Your local schema
  stays SQLite, so `npm run dev` and the tests keep working unchanged.
- The `vercel-build` script (in `package.json`) runs on Vercel: swap to Postgres
  → generate client → create the tables (`prisma db push`) → seed the sample map
  **once** (only if the database is empty) → `next build`.

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

> **Heads up — no accounts yet.** Login was intentionally out of scope, so anyone
> with the link shares the **same** life map. That's fine for letting one person
> explore the concept; it's not multi-tenant.

### Prefer to keep SQLite?

Deploy to a host with a **persistent volume** (Railway, Fly.io) instead of Vercel,
and skip the Postgres switch entirely.
