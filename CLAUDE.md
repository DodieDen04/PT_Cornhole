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
- DB migrations: railway run npx prisma migrate deploy
"@ | Out-File -Encoding utf8 CLAUDE.md