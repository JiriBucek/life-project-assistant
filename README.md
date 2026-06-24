# Ellie — Life Project Assistant

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

## Deploying a shared demo

SQLite is perfect locally, but serverless hosts (like Vercel) have an ephemeral,
read-only filesystem — so for a **hosted, shared** instance use a managed Postgres.

1. Create a free Postgres database (e.g. [Neon](https://neon.tech) or Vercel
   Postgres) and copy its connection string.
2. In `prisma/schema.prisma`, change the datasource provider:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Set `DATABASE_URL` to the Postgres string (locally in `.env`, and as an env var
   in your host).
4. `npx prisma db push` (and `npm run db:seed` if you want sample data), then
   deploy. `postinstall` already runs `prisma generate` on the host.

For a Postgres-free option, deploy to a host with a **persistent volume**
(Railway, Fly.io) and keep SQLite.
