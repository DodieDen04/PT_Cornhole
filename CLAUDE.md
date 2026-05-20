## Project
Cornhole Scoring App

## Stack
- Frontend: React + Vite + Tailwind (in /client)
- Backend: Express + Prisma (in /server)
- Database: PostgreSQL (Railway in prod, Docker locally)
- Auth: JWT
- Deployment: Railway

## Conventions
- UK English everywhere
- Component-per-file in React
- REST API, routes in server/routes/
- Prisma client imported from server/lib/prisma.js
- Mobile-first design
- No em dashes

## Running locally
1. `docker start my-project-db`
2. `npm run dev` from root
3. Client: http://localhost:5173 | Server: http://localhost:3001

## Deploying
- Push to main. Railway auto-deploys.
- DB migrations: from `server/`, run `DATABASE_URL="<public Railway URL>" npx prisma migrate deploy`. Don't use `railway run` for migrations - it injects the internal `*.railway.internal` URL which is unreachable from a laptop.

## Backups
- Manual production DB backup: `npm run backup` from repo root.
- Reads `DATABASE_URL` from `.env.backup` (gitignored) or inline env var. Writes `backups/cornhole-YYYY-MM-DD-HHMM.sql` via `pg_dump` in a Docker container.
- Always run a backup before destructive operations: schema migrations, deleting a Postgres service, restoring from a dump, etc.
- Restore: `docker run --rm -i postgres:18-alpine psql "<DATABASE_URL>" < backups/<file>.sql`