# PT Cornhole: Phase F, Private-by-Default Groups (Handoff for Claude Code)

Read and follow the steps below in order. Complete each step before moving to the next.

## Reference

The authoritative spec is `cornhole-scorer-spec-v4.md`. Phases A to E are live. This spec supersedes `pt-cornhole-phase-f-private-groups-stub.md`; the six decisions recorded there (2026-07-07) are baked in below:

1. Spectator links stay open to anyone with the link
2. Leaderboard requires picking a group; no combined or global view
3. Username-based invites stay, alongside new invite links
4. Usernames remain globally unique
5. Migration auto-creates one founding group containing all current players
6. Phase F ships before Phase G (auth hardening)

## What this phase is

One rule, applied everywhere: **two players can see each other only if they share a group** (or one created the other, for guests). The app becomes many independent clubs. A stranger who registers sees nobody and nothing until they join a group via an invite link or a username invite. Existing users notice almost nothing because the migration puts everyone into one founding group.

---

## Step 1: Data model

```
Player (modify)
  createdById  String?   (FK -> Player.id, SetNull; who created this guest)

GroupInvite (new)
  id          String    @id uuid
  token       String    @unique (random, URL-safe, ~24 chars)
  groupId     String    (FK -> Group.id, Cascade)
  createdBy   String    (FK -> Player.id, Cascade)
  expiresAt   DateTime
  maxUses     Int?      (null = unlimited)
  useCount    Int       @default(0)
  revoked     Boolean   @default(false)
  createdAt   DateTime  @default(now())
```

**Data backfill, same migration:** create one group named "PT Cornhole" (admin = the earliest app admin player) containing every existing player as MEMBER. Skip if a group with that name already exists. This keeps current users' experience unchanged when scoping flips on.

---

## Step 2: Visibility helper (server)

`server/lib/visibility.js`:
- `visiblePlayerIdSet(playerId)`: the player themselves, plus every MEMBER of every group the player is a MEMBER of, plus every player they created (guests)
- `canSeePlayer(viewerId, targetId)`

Apply it server-side (client filtering is not enough):
- `GET /api/players`: return only visible players
- `GET /api/stats/player/:id`, `/heatmap`: 403 unless self or visible
- `GET /api/stats/head-to-head`: 403 unless both players visible to the requester
- `POST /api/games` (both modes): every player in the payload must be visible to the creator
- `POST /api/tournaments`: same for playerIds
- Once a player is visible, their full stats are shown (not cut down to shared-group games). Deliberate simplicity: within a club, stats were always open.

**Deliberately NOT scoped** (decision 1): `GET /api/games/:id`, the spectator screen and the `/ws/spectate` channel. Anyone with a game link can watch.

Guests: `POST /api/players/guest` stamps `createdById`. It accepts an optional `groupId`; if the requester is that group's admin the guest is also added to the group as MEMBER. Game setup passes the active group filter's id.

---

## Step 3: Invite links (server)

New endpoints:

```
POST   /api/groups/:id/links            Create link (admin) { expiresInDays?=7 (1-90), maxUses? (1-500) }
GET    /api/groups/:id/links            List usable links (admin)
DELETE /api/groups/:id/links/:linkId    Revoke (admin)

GET    /api/invite/:token               NO AUTH. { valid, reason?, group: { name, memberCount } }
POST   /api/invite/:token/accept        Auth. Join the group as MEMBER; increments useCount
```

Rules:
- Token: crypto-random, URL-safe
- A link is usable when: not revoked, not expired, useCount < maxUses (when set)
- Accept is idempotent: already a MEMBER returns ok without incrementing; INVITED upgrades to MEMBER
- The unauthenticated GET deliberately reveals only group name and member count

Username invites (decision 3): `POST /api/groups/:id/invite-username { username }` (admin only). Exact match on a registered, non-guest user; creates an INVITED membership feeding the existing invitations screen. This lets an admin invite someone they cannot see; the "name taken" style leak is accepted (decision 4).

Transfer admin: `POST /api/groups/:id/transfer-admin { playerId }` (admin only; target must be a registered MEMBER). Sets Group.createdBy. The old admin becomes a normal member and can then leave.

---

## Step 4: Join flow (client)

New route `/join/:token` (works logged out):
- Shows group name, member count, Join button
- Logged in: Join calls accept, then goes to the group detail screen
- Logged out: stash the token in localStorage, send them to Register (or Log in); after auth, the Home screen sees the stash and bounces them back to `/join/:token` to finish
- Invalid/expired/revoked links get a clear message, not an error dump

Register screen: when a stashed invite exists, show a small hint that they will join the group after registering.

---

## Step 5: Group detail screen additions (admin)

- **Invite link section:** create link button; each usable link shows the URL, Copy button, a QR code (generated client-side, `qrcode` package), uses so far / limit, expiry date, and a revoke button
- **Invite by username:** small input + button, exact username, feedback on success/not found
- **Transfer admin:** pick a registered member, confirm; after transfer the screen re-renders with the new admin badge and the old admin gains the Leave option
- Existing picker-based invite still works but now only lists players the admin can already see

## Step 6: Leaderboard requires a group (client)

- Remove the "All Games" option from the leaderboard screen; the server rejects requests without groupId
- No group selected: show "Pick a group to see its leaderboard"
- If the user belongs to exactly one group, auto-select it
- User in no groups: explain that leaderboards are per group, link to Groups

Player stats screens keep their existing group filter ("All Games" there means all of that player's games, which stays fine).

---

## Step 7: Verify and test

**Stranger isolation:**
1. Register a fresh user in a private window. Player list is empty (no other players offered in game setup), leaderboard shows the no-groups message, and fetching another player's stats/heatmap by id returns 403.
2. The stranger cannot create a game against an existing player id (400 from the server even if crafted by hand).

**Invite links:**
3. Admin creates a link. Open it logged out: group name shows. Register via the flow: user lands in the group, appears as MEMBER, and can now see fellow members in game setup.
4. useCount incremented; a maxUses=1 link rejects a second joiner; a revoked link and an expired link both show the invalid message.
5. Accepting a link twice does not duplicate membership.

**Username invites:** invite an exact username the admin cannot see; the invitee gets the normal invitation banner and can accept.

**Transfer admin:** transfer, confirm old admin can leave and new admin has full controls.

**Migration:** all pre-existing players are MEMBERs of "PT Cornhole"; their player lists, stats and leaderboard (after picking the group) look the same as before.

**Regression:** shared scoring (Phase E), spectator links, practice mode, tournaments and history all behave unchanged for members of a shared group.

---

## General reminders

- UK English in all user-facing text
- No em dashes anywhere
- Do not modify `SplashArt.jsx`
- Migration includes a data backfill: back up prod first (`npm run backup`), apply with `migrate deploy` using the public Railway URL before pushing
- Follow the v4 spec for anything not explicitly changed above
