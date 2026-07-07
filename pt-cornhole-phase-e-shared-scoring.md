# PT Cornhole: Phase E, Shared Scoring (Handoff for Claude Code)

Read and follow the steps below in order. Complete each step before moving to the next.

## Reference

The authoritative spec is `cornhole-scorer-spec-v4.md`. Phases A to D are live, as are Round 3 and Round 4 fixes (throw order modal, referee mode via `Game.createdById`, black bags, leaderboard table, richer stats).

## What shared scoring is

Today exactly one phone drives the live scoring screen. Everyone else can only watch through the spectator view. In a 2v2 game the two throwing pairs are at opposite ends of the court, and the person best placed to enter throws alternates every round (you score at the board end where the bags land). Shared scoring lets every participant, plus the referee who set the game up, open the same live game and enter throws, with all phones staying in sync.

Design principle: **everyone can score, the server referees.** No explicit "scorer token" or lock. Cornhole convention (score at the board end) does the human coordination; the server guarantees the data cannot be corrupted by two phones acting at once.

What already exists and is reused, not rebuilt:
- WebSocket channel `/ws/spectate?gameId=` (`server/lib/spectator.js`) that broadcasts a full round payload and totals on every throw create, move and undo, and the full game on round completion
- Per-throw REST writes (`POST /api/throws`, `PUT /api/throws/:id`, `DELETE /api/throws/:id`, `PUT /api/rounds/:id/complete`)
- Server-side guards: throws rejected on non-active rounds, undo restricted to the most recent throw, round completion rejected if already completed
- Resume: `/api/games/in-progress` already returns live games for participants and the creator

---

## Step 1: Close the throw-order race (server + schema)

`POST /api/throws` computes `throwOrder = round.bagThrows.length + 1` from a read, then writes. Two phones posting at the same moment can both read N and both write N+1, producing duplicate throw orders and a 9th bag slipping past the 8-bag cap.

**Schema:** add a compound unique constraint to BagThrow:

```
@@unique([roundId, throwOrder])
```

Note: `roundId` is nullable (practice throws use practiceSetId). Postgres treats rows with null roundId as always unique, so practice throws are unaffected. One migration, no data backfill needed (existing data has no duplicates; verify with a count query before deploying, and renumber if any are found).

**Server:** wrap the create in a retry. On a unique-constraint violation (Prisma error P2002), re-read the round, re-check the 8-throw cap and active-round guard, recompute throwOrder, and try again. Maximum 3 attempts, then return 409 with error "Throw clashed with another scorer, try again". The client treats a 409 as "refresh and let the user re-place the bag".

**Broadcast attribution:** include who made each change in the WebSocket payload so other phones can show it. Add to every `broadcastGameUpdate` call in `throws.js` and `rounds.js`:

```
by: { id: req.player.id, username: req.player.username }
```

---

## Step 2: Make the scoring screen listen (client)

`ScoringScreen.jsx` currently loads the game once and trusts its own writes. Subscribe it to the same WebSocket the spectator screen uses.

- On mount, open `wss://<host>/ws/spectate?gameId=<id>` (copy the pattern from `SpectatorScreen.jsx`, including the http/ws protocol switch)
- On `update` messages: if the payload has `round` and `totals`, merge them with the existing `mergeRound` helper; if it has `game`, replace game state entirely (this is what round completion and game end send)
- Ignore echoes of your own writes if simpler, or just merge them; the payloads are full snapshots of the round, so merging is idempotent. Full-snapshot merge is the required approach: never append incrementally
- **Reconnection:** iOS Safari kills WebSockets when the PWA is backgrounded. On socket close, retry with a short backoff (1s, 2s, 5s, then every 5s). On every reconnect AND on `visibilitychange` to visible, refetch `/api/games/:id` once to resync anything missed while dead
- **Connection indicator:** small dot near the header, green when the socket is open, grey when reconnecting. Do not block scoring while disconnected (REST writes still work; the response merge keeps the local phone correct)

**Interaction with the offline queue:** the scoring screen already listens for the queue `onFlushed` event and reloads. Keep that. While offline, remote updates are lost (socket dead); the reconnect-refetch above covers it. No special conflict handling: the server's order of arrival wins, which is acceptable at this scale.

---

## Step 3: Multi-phone UX rules

With two or more phones live on the same game:

- **Bags placed remotely** appear on the board with the normal drop-in animation. Show a transient hint under the header: "Bob scored" (from the `by` field), fading after 2 seconds. Do not toast every single bag with a popup; the board updating IS the feedback
- **Undo** stays restricted to the most recent throw (server already enforces this). Any phone may undo it, including a throw entered by another phone. The remote phones see the bag disappear via the broadcast
- **Bag drag/move** (`PUT /api/throws/:id`): no change to rules, merge broadcast as with creates. If two phones drag the same bag, last write wins
- **Round completion:** the phone that taps "End round" sees the existing end-of-round popup. Remote phones receive the `game` payload with the new round: advance them silently to the new round and show the transient hint "Round 3 confirmed by Alice". If the game is over (`winningTeam` present in the payload), all phones navigate to the game-over screen as if they had confirmed it themselves
- **Stale round guard:** if a phone tries to score into a round that was completed remotely a split second earlier, the server already returns "Round is no longer active". On that error, refetch the game instead of showing a raw error banner

---

## Step 4: Who can open the live scoring screen

No new permissions model. The rule is: participants and the creator can score, anyone else who has the link gets the spectator view.

- `GET /api/games/:id` is already open to any authenticated user; keep that
- On the client, when loading a live game into ScoringScreen, check whether the logged-in user is one of `game.players` or `game.createdById`. If neither, redirect to the existing spectator route for that game
- Home screen: the resume banner already surfaces in-progress games for participants and creator. No change needed, but verify a second participant (not the phone that created the game) sees the banner and can jump straight into live scoring mid-game

---

## Step 5: Verify and test

Use two browser windows logged in as two different participants (plus a real iPhone once deployed).

**Sync basics:**
1. Phone A places a bag. It appears on phone B within a second, with the "scored by" hint.
2. Phone B places the next bag. Phone A sees it. Throw order on the server is 1, 2 with no duplicates.
3. Phone A drags a bag to a new spot. Phone B sees it move and the round score change.
4. Phone B undoes the last throw. It vanishes on phone A.

**Race conditions:**
5. Both phones place a bag as near-simultaneously as you can manage. Both bags exist, throw orders are unique and sequential, round has the right count. Repeat several times.
6. With 7 bags placed, both phones race to place the 8th. Exactly one succeeds; the other gets a clean refresh, not a corrupt 9-bag round.
7. Phone A ends the round while phone B is mid-placement. Phone B's late throw is rejected with a game refresh, not a raw error.

**Round and game flow:**
8. Phone A ends the round. Phone B advances silently with the hint. Scores match on both.
9. Play to a win. Both phones land on the game-over screen with the same result.
10. Referee case: creator not playing, two other participants each on their own phone, all three scoring and staying in sync.

**Connection resilience:**
11. Background the PWA on the iPhone mid-game, score two throws from the other phone, foreground the PWA. It resyncs within a couple of seconds (reconnect + refetch).
12. Kill the network on one phone, place a bag (offline queue), restore network. Queue flushes, both phones agree.
13. Connection dot: green when live, grey while airplane mode is on.

**Regression:**
14. Solo scoring (one phone only, 1v1) behaves exactly as before, popup and all.
15. Spectator screen still works unchanged.
16. Practice mode untouched.

---

## General reminders

- UK English in all user-facing text
- No em dashes anywhere
- Do not modify `SplashArt.jsx`
- New migration required (unique constraint): back up prod first (`npm run backup`), apply with `migrate deploy` using the public Railway URL before pushing
- Follow the v4 spec for anything not explicitly changed above
