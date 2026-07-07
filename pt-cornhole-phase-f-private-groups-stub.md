# PT Cornhole: Phase F, Private-by-Default Groups (STUB, decisions made)

This is a stub: it records the goal, the shape of the work and the decisions taken. The open questions below were answered by Dodie on 2026-07-07; expand this into a full step-by-step spec before building. Do not implement from this document.

## Goal

Make the app safe and useful for people who do not know each other. Today every logged-in user can see every player, every player's stats and heatmap, and can add anyone to a game. That is right for one club and wrong for strangers. After Phase F, the app works as many independent clubs: you see only the people you share a group with, and joining a group is self-serve via an invite link.

This phase deliberately does NOT include: matchmaking, public discovery, venues, or open tournaments. Those only matter if the ambition becomes a community product, and they sit cleanly on top of this work later.

## The core change: visibility scoping

One rule applied everywhere: **two players can see each other only if they share a group.**

Endpoints that must change from global to scoped:
- `GET /api/players` (currently returns every player to any user)
- `GET /api/stats/player/:id`, `/head-to-head`, `/heatmap` (currently any player's stats are viewable by anyone)
- `GET /api/stats/leaderboard` (currently global by default; becomes per-group, with "all my groups combined" as the personal default view)
- Game creation: can only add players you share a group with (server-validated, not just client-filtered)
- Game detail / spectator: decide (open question below)

Existing single-club users (us) should notice almost nothing: everyone ends up in one shared group and the app behaves as today within it.

## Self-serve joining: invite links

Replace "admin types your username" with a shareable link:

- Admin generates an invite link for a group; it encodes a random token (new `GroupInvite` table: token, groupId, createdBy, expiresAt, maxUses, useCount, revoked)
- Share it by any channel (WhatsApp etc.) or show it as a QR code on screen for someone standing next to you
- Opening the link: logged-in user gets "Join Sunday crew?"; a new user goes through registration first, then lands in the group
- Admin can revoke links and set expiry; default expiry 7 days
- Existing username-based invitations can stay for convenience inside a club, or be retired (open question)

## Admin and safety minimums

- Group admin can already remove members, rename, delete (Phase D). Add: transfer admin, and "leave" allowed for an admin once transferred
- A removed member loses visibility of the group's players and stats immediately
- Games already played keep their records (same principle as group deletion in Phase D)

## Knock-on effects to check during full spec

- Guests: guest players are currently global; they should belong to the group whose admin created them
- Tournaments: player pickers must respect scoping
- Admin routes (`server/routes/admin.js`): review what a club admin vs app admin can see
- The WebSocket spectate channel has no auth today; decide whether game links remain "anyone with the link can watch"
- Performance: leaderboard and stats endpoints load every game with every throw into memory; fine per group, but revisit when any group is large (Phase H)

## Decisions (made 2026-07-07)

1. **Spectator links:** KEEP OPEN. Anyone with the link can watch a live game (good for sharing a final with non-players).
2. **Default leaderboard:** PICK A GROUP FIRST. No combined view; the Leaderboard screen shows nothing until a group is selected.
3. **Invitations flow:** BOTH. Username-based invites stay (handy inside a club) alongside new invite links/QR.
4. **Usernames:** GLOBALLY UNIQUE. Accept the small "name taken" privacy leak at registration.
5. **Migration of current data:** AUTO-CREATE one group containing all current players when scoping flips on, so existing users notice nothing.
6. **Relationship to Phase G:** F SHIPS FIRST. Auth hardening follows as its own phase.

## Sequencing note

Phase E (shared scoring) is independent of this and should ship first. Phase G (email/password or magic-link auth, rate limiting, guest claiming) follows F. Phase H (stats aggregation in SQL) waits for real growth.
