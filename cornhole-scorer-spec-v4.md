# Cornhole Scorer App — Requirements Spec v4

## Overview

A Progressive Web App (PWA) for scoring cornhole games with visual bag placement tracking, drag-to-reposition bags, and heatmaps across all game modes. Deployed to Railway. Designed mobile-first but functional on desktop. Built for flexible player counts (not hardcoded to 4).

**Why PWA:** Installable to Android/iOS home screen via browser. No app store submission, no fees, one codebase. Offline support is deferred to Phase 4 (see Build Phases).

\---

## Tech Stack

|Layer|Choice|Rationale|
|-|-|-|
|Frontend|React + Vite + react-router-dom|Familiar stack; fast builds; good PWA tooling|
|Styling|Tailwind CSS v4|Utility-first, responsive, minimal custom CSS. v4 config lives in `client/src/index.css` via `@theme` and `@theme inline` blocks - no `tailwind.config.js`.|
|Backend|Node.js + Express|Simple REST API; same language front and back|
|Realtime|`ws` (WebSocket server attached to the Express HTTP server)|Pushes live game state to spectator clients with no auth, no Redis, no extra infrastructure|
|Database|PostgreSQL|Railway has native Postgres; relational fits score/round/bag data well|
|ORM|Prisma|Type-safe, good migration story, works well with Postgres on Railway|
|Auth|Username + PIN (4-digit password) hashed with `bcryptjs`|Simple but proper auth; JWT sessions (30 day expiry); guest players have `pinHash=null` and cannot log in|
|Hosting|Railway|Frontend + API + Postgres all on one platform|
|PWA|vite-plugin-pwa (Workbox) + custom InstallContext|Service worker for app-shell caching; one-shot install banner; always-available Install entry in Settings|

\---

## Key design decisions (write these down so they don't drift)

1. **Bag colours are per-game, not per-player.** Players don't register a colour. Teams pick a colour at competitive game setup. Practice players pick a colour at session start. Client remembers last-used colour in localStorage.
2. **First-throw rule:** Round 1 starts with Team 1. Subsequent rounds start with the team that scored in the previous round. If a round is tied (zero net points), the same team that started the previous round starts the next.
3. **Bag repositioning is allowed at any point during a round**, not only at the end. Players will need to reposition mid-round when later throws knock earlier bags into or off the board.
4. **No bust rule.** Reaching or exceeding the target score wins.
5. **No rate limiting on login.** This is a friends-and-family app, not a security boundary. Brute-forcing a 4-digit PIN is theoretically possible but irrelevant for the threat model.
6. **JWT expiry: 30 days, no refresh tokens.** Long-lived login that survives the time between games.
7. **Offline sync is Phase 4, not Phase 3.** PWA install and app-shell caching are still in Phase 3, but the IndexedDB sync queue is parked until everything else works online.
8. **Practice throws-per-set is configurable: 4 (default) or 8.** Set at session start, fixed for the session.
9. **Cancellation scoring is computed and displayed live**, updating after every throw and every bag reposition. The round summary panel always shows the current state, not just at round end.
10. **2v2 throw order follows real cornhole rules.** Partners stand at opposite ends. One pair throws a full round, then the other pair throws the next round. See "Throw flow" section for the explicit sequence.
11. **History is per-user, enforced server-side.** `GET /api/games` always filters to games where the requesting player is a `GamePlayer`. The endpoint ignores any client-supplied `playerId` query param, so a user cannot inspect someone else's history by editing the URL. Admin status grants no extra visibility on this endpoint.
12. **Abandoned practice sessions auto-clean after 24h.** A practice game with `mode=PRACTICE`, `status=IN_PROGRESS`, and `updatedAt` more than 24 hours old is hard-deleted on the next `GET /api/games` hit (debounced to once per 5 minutes per server instance). Cascade rules in the schema remove its `PracticeSet` and `BagThrow` rows. Abandoned competitive games are never auto-cleaned; the user must explicitly Quit them.
13. **Tournaments are round-robin 1v1 only today.** At creation, the server generates every pairwise match. Each `TournamentMatch` spawns a regular `Game` when started, so all scoring/replay/spectator/stats code is reused. The round-complete handler also writes `TournamentMatch.winnerId` and auto-flips the tournament to COMPLETED when no undecided matches remain. Bracket play, 2v2, byes, and seeding are not implemented and would require new format enums plus pair-generation logic.
14. **Spectator is unauthenticated and WebSocket-driven.** The `/spectate/:gameId` route bypasses `RequireAuth`; any URL holder can watch. `GET /api/games/:id` is intentionally readable without auth to support this. Updates push from a `ws` server attached to the same HTTP server at `/ws/spectate`. There is no rate limit and no obscurity guarantee beyond UUID unguessability.
15. **Guest players are first-class Player rows.** They have `isGuest=true` and `pinHash=null`, so they cannot log in but they fully participate in games and accumulate stats. Any authenticated user can create a guest (`POST /api/players/guest`); only an admin can upgrade a guest to a full account (`POST /api/players/:id/upgrade` with a PIN). Guests are added to groups directly as MEMBER (no invitation flow, since there's no one to accept).

\---

## Data Model

```
Player
  id              UUID (PK)
  username        String (unique, display name)
  pinHash         String (nullable; hashed 4-digit PIN, bcrypt; null for guest players who cannot log in)
  isAdmin         Boolean (default false; first registered player set true)
  isGuest         Boolean (default false; guest players are added by an admin and play without an account until they are upgraded)
  createdAt       DateTime

Game
  id                   UUID (PK)
  mode                 Enum: COMPETITIVE | PRACTICE
  status               Enum: IN\_PROGRESS | COMPLETED | ABANDONED
  targetScore          Int (default 21, competitive only)
  team1Colour          Enum: YELLOW | RED | BLUE | GREEN (nullable, competitive only)
  team2Colour          Enum: YELLOW | RED | BLUE | GREEN (nullable, competitive only)
  practiceThrowsPerSet Int (nullable, 4 or 8, practice only)
  practiceTag          String (nullable, practice only; session-wide tag set at practice creation, e.g. "left hand", "after beers")
  startingTeam         Int (nullable, 1 or 2, who starts each round; updated as game progresses)
  groupId              UUID (FK -> Group, nullable; tags the game with the group filter that was active at setup, drives group-scoped stats/leaderboard; ON DELETE SET NULL so the game survives if the group is deleted)
  createdAt            DateTime
  updatedAt            DateTime (auto-updated; drives the abandoned-practice cleanup)
  completedAt          DateTime (nullable)

GamePlayer
  id            UUID (PK)
  gameId        UUID (FK -> Game)
  playerId      UUID (FK -> Player)
  team          Int (nullable, 1 or 2, null for practice)
  position      Int (nullable, 1 or 2; in 2v2 indicates which end the player throws from)
  bagColour     Enum (nullable, used for practice players; null in competitive because team colour is on Game)

Round
  id                UUID (PK)
  gameId            UUID (FK -> Game)
  roundNumber       Int (starts at 1)
  team1RoundScore   Int (raw points before cancellation, recomputed on every bag change)
  team2RoundScore   Int (raw points before cancellation, recomputed on every bag change)
  netPoints         Int (cancellation result: absolute difference; 0 if tied)
  scoringTeam       Int (nullable, 1 or 2, null if tied)
  startingTeam      Int (1 or 2, who threw first this round)
  throwingPair      Int (1 or 2; in 2v2, which pair of players is throwing this round)
  createdAt         DateTime

PracticeSet
  id            UUID (PK)
  gameId        UUID (FK -> Game)
  playerId      UUID (FK -> Player)
  setNumber     Int (sequential per player within session)
  tag           String (nullable, e.g. "left hand", "15ft")
  createdAt     DateTime

BagThrow
  id            UUID (PK)
  gameId        UUID (FK -> Game)
  playerId      UUID (FK -> Player)
  roundId       UUID (FK -> Round, nullable, null for practice)
  practiceSetId UUID (FK -> PracticeSet, nullable, null for competitive)
  throwOrder    Int (1-8 within a round for competitive; 1-4 or 1-8 within a set for practice)
  boardX        Float (normalised, see coordinate system below)
  boardY        Float (normalised, see coordinate system below)
  result        Enum: CORNHOLE | BOARD | OFF
  points        Int (3, 1, or 0)
  createdAt     DateTime
  updatedAt     DateTime (tracks repositioning)

GameResult
  gameId        UUID (PK, FK -> Game, 1:1 with Game)
  winningTeam   Int (nullable, 1 or 2)
  team1Score    Int (final)
  team2Score    Int (final)

Group
  id          UUID (PK)
  name        String (unique, max 30 characters, trimmed)
  createdBy   UUID (FK -> Player; the group creator/admin)
  createdAt   DateTime

GroupMember
  id          UUID (PK)
  groupId     UUID (FK -> Group, ON DELETE CASCADE)
  playerId    UUID (FK -> Player, ON DELETE CASCADE)
  status      Enum: MEMBER | INVITED (registered users start INVITED and become MEMBER on accept; guest players are added directly as MEMBER)
  addedAt     DateTime
  -- @@unique([groupId, playerId])

Tournament
  id           UUID (PK)
  name         String (nullable, free-text title)
  format       Enum: ROUND_ROBIN (only format implemented today)
  status       Enum: IN_PROGRESS | COMPLETED | ABANDONED
  targetScore  Int (default 21, applied to each match)
  createdAt    DateTime
  completedAt  DateTime (nullable; set automatically when the last match is decided)

TournamentPlayer
  id           UUID (PK)
  tournamentId UUID (FK -> Tournament, ON DELETE CASCADE)
  playerId     UUID (FK -> Player, ON DELETE CASCADE)
  seedNumber   Int (1-based seed/order; used as the participant ordering)
  -- @@unique([tournamentId, playerId])

TournamentMatch
  id           UUID (PK)
  tournamentId UUID (FK -> Tournament, ON DELETE CASCADE)
  player1Id    UUID (FK -> Player)
  player2Id    UUID (FK -> Player)
  matchOrder   Int (1-based order in which matches were generated)
  gameId       UUID (FK -> Game, nullable, unique; set when the match is started, ON DELETE SET NULL so deleting the game doesn't drop the match)
  winnerId     UUID (FK -> Player, nullable; populated when the linked Game completes)
```

**Coordinate system for boardX / boardY:**

The board SVG includes both the board AND a surrounding "off-board" gutter zone. Coordinates are normalised to this full area:

```
  0.0                          1.0   (boardX)
   ┌──────────────────────────────┐  0.0 (boardY)
   │         GUTTER ZONE          │
   │   ┌──────────────────────┐   │
   │   │                      │   │
   │   │     BOARD SURFACE    │   │
   │   │                      │   │
   │   │        (  O  )       │   │  hole
   │   │                      │   │
   │   └──────────────────────┘   │
   │         GUTTER ZONE          │
   └──────────────────────────────┘  1.0 (boardY)
```

* Taps on the board surface: result = BOARD (1pt), or CORNHOLE (3pt) if inside the hole
* Taps in the gutter zone: result = OFF (0pt)
* ALL taps store x,y coordinates, including off-board throws
* This means heatmaps show miss patterns (consistently long, pulling left, etc.)

**Hole detection:** Hole centre and radius are stored as constants in normalised coordinates (e.g. centre at x=0.5, y=0.275; radius=0.04). A throw is CORNHOLE if its distance from the hole centre is less than the hole radius.

**Drag-off-canvas behaviour:** If a user drags a bag past the SVG edge, snap it back to the gutter at the point where the drag crossed the edge. Bag becomes OFF (0 points).

**Key relationships:**

* A Game has many Rounds (competitive) or PracticeSets (practice)
* A Round has 8 BagThrows in competitive (alternating between the two players in the active pair)
* A PracticeSet has 4 or 8 BagThrows (depending on Game.practiceThrowsPerSet)
* GamePlayer is a join table allowing flexible team sizes and player counts
* Heatmap data: query BagThrows by playerId with boardX/boardY, filter by game mode
* `Group` collects players into named circles ("Sunday crew") used to filter the Game Setup player list and to scope stats/leaderboard. Group membership is via `GroupMember`; registered users join via an invitation (status INVITED -> MEMBER on accept), guests are added directly as MEMBER. When a game is started with a group filter active, `Game.groupId` is set so the game counts toward that group's stats.
* `Tournament` is a round-robin schedule of 1v1 matches over 3-16 selected players. At creation, the server generates every pairwise match (`TournamentMatch`). Starting a match creates a regular `Game` linked via `TournamentMatch.gameId`; when that game completes (Round.complete handler), the match's `winnerId` is filled in and the tournament auto-completes once no matches remain undecided. Tournaments do not currently support brackets, byes, or 2v2 - those would need new format enums and pair-generation logic.

**Live score recalculation rule:** Whenever a BagThrow is created, updated (repositioned), or deleted (undo), the following cascade runs immediately:

1. Recalculate the throw's `result` and `points` from its new `boardX`/`boardY` (hole detection, board bounds check)
2. Recompute the parent Round's `team1RoundScore` and `team2RoundScore` (sum of points for each team's throws in this round)
3. Recompute `netPoints` = |team1RoundScore - team2RoundScore|
4. Recompute `scoringTeam` (whichever team has the higher raw score, or null if tied)
5. Push updated round scores to the client so the UI reflects the change instantly

This cascade applies to bag repositioning (drag-to-move), new throw placement, and undo. The client must show the live cancellation state at all times during a round.

\---

## Screens \& Features

### 1\. Splash Screen

**`SplashArt.jsx` is a finished asset. Do not modify or regenerate it.** It contains the bespoke PT monogram and cornhole board illustration as hand-crafted SVG paths. Import it as-is.

Build `SplashScreen.jsx` that imports `SplashArt` from `./SplashArt.jsx`.

**Purpose:** In-app splash rendered on app mount while auth check and initial data fetch complete. This is the in-app splash, not the OS-level PWA splash defined in `manifest.json` (though they share a background colour for a seamless transition).

**Design tokens:**

|Name|Hex|Use|
|-|-|-|
|navy|`#0C447C`|Page background|
|cream|`#FAEEDA`|Tagline, loading dots|
|brand-red|`#DC2127`|PT mark fill (inside SplashArt)|
|black|`#000000`|PT mark outline (inside SplashArt)|

Additional colours inside `SplashArt.jsx` (board tan, wood grain, decorative bag colours, hole shadow) are self-contained and do not need Tailwind tokens. The decorative bag colours in the splash art are intentionally different from the in-game bag palette; they are illustrative, not functional.

**Typography:**

|Element|Style|
|-|-|
|Tagline|system sans, 13px, font-weight 500, letter-spacing 0.2em, uppercase, cream|
|Version|system sans, 9px, font-weight 400, letter-spacing 0.1em, cream at 40% opacity|
|PT mark|inline SVG paths (not a font); do not substitute a Google Font|

**Layout:** Mobile-first, full viewport. Everything centred horizontally. Vertical stack, top to bottom:

1. **SplashArt** (PT mark and cornhole board, imported from `./SplashArt.jsx`)
2. **Tagline** reading `PT FOR YOUR CORNHOLE`
3. **Loading dots** (three cream circles, sequential fade animation)
4. **Version label** at the bottom edge, faint

Background: solid navy (`#0C447C`). No gradients, no images. SplashArt occupies the top \~60% of screen height, tagline and dots in the middle \~25%, version in the bottom \~5%, with breathing room between. **The splash does not honour the light/dark theme toggle** \- it is always navy with cream text, because the PT mark artwork is tuned for a dark background and the splash is a brand moment, not a UI moment.

**Behaviour:**

* Show on app mount, full viewport, fixed positioning
* Minimum visible duration of 1.2s (prevents a flash if auth resolves instantly)
* Fade out over 250ms once auth is complete AND initial data is loaded
* If auth takes longer than 5 seconds, dismiss the splash anyway and let the app handle loading state per-route
* Loading dots animate continuously while the splash is visible
* Component accepts an optional `onComplete` prop, called after fade-out finishes

**Loading-dot animation:** Three cream dots in a row. Opacity oscillates 0.9 to 0.2 to 0.9 over 1.2s, with a 0.2s stagger between adjacent dots. CSS `@keyframes` or Tailwind `animate-pulse` with manual `animation-delay`.

**Manifest.json:** Set `background\_color` to `#0C447C` and `theme\_color` to `#0C447C` so the OS launch splash matches the in-app splash. No colour jump between the two.

**Suggested component structure (sketch, not a contract):**

```jsx
import SplashArt from './SplashArt.jsx';

export default function SplashScreen({ onComplete }) {
  // local state for fade-out, useEffect for the 1.2s minimum timer
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-\[#0C447C]">
      <SplashArt className="w-64 max-w-\[60vw]" />
      <p className="mt-8 text-\[13px] font-medium tracking-\[0.2em] text-\[#FAEEDA]">
        PT FOR YOUR CORNHOLE
      </p>
      <LoadingDots className="mt-6" />
      <span className="absolute bottom-6 text-\[9px] tracking-wider text-\[#FAEEDA]/40">
        v0.1
      </span>
    </div>
  );
}
```

The project runs on Tailwind v4. Reusable colours and theme tokens are defined in `client/src/index.css` via `@theme` and `@theme inline` blocks (no `tailwind.config.js`). Splash uses literal hex (`bg-\[#0C447C]`, `text-\[#FAEEDA]`) rather than the `bg-page` / `text-ink` semantic tokens because it deliberately ignores the theme toggle. Should work full-bleed on iOS Safari (account for safe-area inset at bottom if needed).

### 2\. Login Screen

* Username field + 4-digit PIN field
* "Login" button
* "Create Account" link for new players
* Session stored via JWT in localStorage (30 day expiry, no refresh)
* First-run: if no players exist, redirect to account creation
* "Forgotten PIN" link: shows a message "Ask the admin to reset your PIN" (admin handles via Settings)

### 3\. Account Creation

* Username (must be unique)
* 4-digit PIN (entered twice for confirmation)
* "Create Account" button, auto-login on success
* First account created becomes admin

### 4\. Home / Dashboard

* **Start Match** (competitive) and **Practice Mode** as the two primary buttons
* Logged-in player name plus a **Settings** cog icon top-right
* If the caller has an `IN_PROGRESS` game (competitive or practice), a **Resume banner** appears above the main buttons with a description of the game state, a **Resume** primary button and a **Discard** action that PUTs status=ABANDONED
* If the caller has pending group invitations, a yellow-tinted button appears below the main buttons showing the invitation count and routing to the Invitations screen
* History, My Stats, Leaderboard, and Manage Groups are accessed from Settings rather than Home

### 5\. Game Setup (Competitive)

* Format selector: 1 vs 1 or 2 vs 2
* **Group filter chips** (only rendered if the caller is in at least one group): "All" plus one chip per group. Selecting a group filters the player list to that group's MEMBERs (including guests). Whatever chip is active when **Start Match** is tapped becomes the new Game's `groupId`; "All" means `groupId = null`. The user can still pick non-members by switching to "All" temporarily.
* Player list: the logged-in user is auto-assigned to Team 1 and locked. Other players appear as tappable cards. For 2v2, a "Pick teammate" sub-list assigns the second Team 1 player.
* Opponent picker: a tap assigns to Team 2 (single in 1v1, two slots in 2v2). The opponent section header reads "Opponent" in 1v1 and "Opponents (Team 2)" in 2v2.
* **Quick-add guest:** "+ Add guest" toggle opens an inline form to create a guest player by display name via `POST /api/players/guest`. The new guest is auto-selected as the opponent. Guests are full Player rows with `isGuest=true` and no PIN.
* In 2v2, each player must have a position (1 or 2) so the pair-rotation logic works
* **Team colour pickers:** two colour selectors. The Team 1 row is labelled "Team 1 (you)" since the logged-in player is always on Team 1; the Team 2 row is just "Team 2". Default to last-used colour from localStorage if available. Two teams must have different colours. Available colours: Yellow, Red, Blue, Green.
* Target score: 11, 15, or 21 (default 21)
* **Start Match** posts to `/api/games` with the selected `groupId` and routes to the scoring screen

### 6\. Scoring Screen (Core, Competitive Mode)

This is the main screen. Must be dead simple on a phone.

**Layout (portrait mobile):**

```
┌─────────────────────────────────┐
│  Team 1: 12     │     Team 2: 8 │   Large font, team colours
├─────────────────────────────────┤
│  Round 5, Throw 3 of 8          │
│  Now throwing: \[Player Name]    │
│  Bag colour: 🟡                 │
├─────────────────────────────────┤
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐  │
│  ╎  GUTTER (tap = off-board) ╎  │
│  ╎  ┌─────────────────────┐  ╎  │
│  ╎  │                     │  ╎  │
│  ╎  │    BOARD SURFACE    │  ╎  │
│  ╎  │                     │  ╎  │
│  ╎  │       ( O )         │  ╎  │
│  ╎  │                     │  ╎  │
│  ╎  └─────────────────────┘  ╎  │
│  ╎  GUTTER (tap = off-board) ╎  │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  │
│                                  │
│  This round:                     │
│  🟡 T1: Board(1) Cornhole(3)    │
│  🔴 T2: Off(0)                  │
│                                  │
│  \[Undo Last]  \[End Round]        │
├──────────────────────────────────┤
│  Round: T1: 4 | T2: 0           │
│  Cancellation: +4 to Team 1     │
└──────────────────────────────────┘

\[Quit Game] (small, bottom of screen, opens confirm dialog)
```

**The "Round: T1: 4 | T2: 0" and "Cancellation: +4 to Team 1" display is LIVE.** It updates after every throw placement, every bag reposition, and every undo. It is not a summary that only appears at round end.

**Board visual design:**

* Board surface: beige/cream (#D4B58F or similar warm wood tone)
* Hole: black circle with subtle ring
* Gutter zone: red-tinted background (#7F1D1D at low opacity, or similar) so it is visually distinct from the board and clearly communicates "miss zone"
* High contrast for outdoor/sunlight use

**Board interaction:**

* SVG rendering of cornhole board (top-down view) with surrounding gutter zone
* Board proportions: 2:1 ratio (standard 2ft x 4ft). Hole is 6 inches diameter, centred 9 inches from the top edge.
* **Tap on board surface:** bag placed there in the active player's TEAM colour, scores 1 point
* **Tap in/near hole:** bag placed there, scores 3 points
* **Tap in gutter zone:** bag placed in gutter, scores 0 points (OFF)
* ALL placements store x,y coordinates for heatmap data
* Each bag dot is 40-50px diameter with border/shadow so overlapping bags are distinguishable
* **Bag throw-order numbers** (1-4 within a round) are rendered centred on each bag using `dominantBaseline="central"`. Font size is ~90% of bag radius, font weight 800. White fill with a 0.4-wide black `paint-order="stroke fill"` outline on red, blue, and green bags (the stroke sits behind the fill so the digit stays crisp). Yellow bags use a solid black fill and no stroke, because white on yellow is unreadable in sunlight.

**Bag repositioning (drag to move):**

* **Tap and hold** a placed bag (200ms hold threshold) to enter "drag mode" (slight scale-up + glow)
* **Drag** the bag to a new position on the board, into the hole, or into the gutter
* **Release** to snap bag to new position; score recalculates automatically via the live cascade (see Data Model section)
* **Drag past SVG edge:** bag snaps to the gutter at the edge crossing point and becomes OFF
* **Reposition is allowed at any time during a round**, including mid-round between throws
* Use case: "bag was sitting on the rim, then got knocked into the hole by a later throw"
* Use case: "bag was on the board, got knocked off by opponent"
* Visual feedback: dragged bag has a subtle trail/shadow; landing zone highlights (board = blue outline, hole = green outline, gutter = red outline)
* Score for that throw updates instantly in the round summary

**Throw flow (alternating), with explicit 2v2 example:**

In 2v2, partners stand at opposite ends of the board. One pair (Position 1 from each team) throws a full round, then the other pair (Position 2 from each team) throws the next round.

**1v1 example:**
Every round is the same two players. 8 throws per round, alternating:

```
Round N: P-T1, P-T2, P-T1, P-T2, P-T1, P-T2, P-T1, P-T2
```

**2v2 example (Team A = Alice + Andy, Team B = Bob + Beth):**
Alice and Bob are Position 1 (End A). Andy and Beth are Position 2 (End B).

```
Round 1 (Position 1 pair): Alice, Bob, Alice, Bob, Alice, Bob, Alice, Bob
Round 2 (Position 2 pair): Andy, Beth, Andy, Beth, Andy, Beth, Andy, Beth
Round 3 (Position 1 pair): Alice, Bob, Alice, Bob, Alice, Bob, Alice, Bob
Round 4 (Position 2 pair): Andy, Beth, Andy, Beth, Andy, Beth, Andy, Beth
...and so on until a team reaches the target score.
```

Each round has 8 throws (4 per player in the active pair). The `Round.throwingPair` field tracks which pair is active.

**First-throw rule within each round:** Round 1 starts with Team 1. At round end, set `Game.startingTeam` to the round's `scoringTeam` (or leave unchanged if the round was tied). The starting team's player throws first in the round. `Round.startingTeam` captures who actually threw first that round, for replay/audit.

**Full throw flow:**

1. Round starts. Active pair determined by alternating `throwingPair` (1, 2, 1, 2...). Starting team determined by first-throw rule.
2. Throw order: starting team's player, other team's player, starting team's player, other team's player... (8 throws total, 4 per player)
3. Header shows whose turn it is and the team's bag colour
4. Active player taps the board/gutter to place their bag
5. After each placement, turn automatically advances to the next player. Live cancellation score updates.
6. After all 8 throws placed, "End Round" button becomes active. Repositioning is allowed throughout (steps 4-6).
7. Tap "End Round": final cancellation calculated as |T1 round score - T2 round score| awarded to higher team; if tied, no points awarded. Net points added to running game totals.
8. Round summary overlay: shows net points, updated running totals, who starts next round
9. Check win condition (either team >= target score). If met, game over screen. If not, next round.

**Undo:** "Undo Last" removes the most recent bag placement and steps back one throw. Multiple undos allowed within the current round. Live scores recalculate on each undo.

**Quit Game:** Small button at bottom. Tapping shows a confirm dialog ("End this game without finishing? This cannot be undone."). On confirm, sets Game.status = ABANDONED and returns to home.

### 7\. Scoring Screen (Practice Mode)

**Setup:**

* Default: single player (the logged-in user)
* Option: "Add practice partner" to select a second player (separate heatmaps tracked)
* **Bag colour picker:** each player picks their colour for this session. Defaults to last-used from localStorage.
* **Throws per set:** choose 4 (default) or 8. Fixed for the session.
* Optional session tag (text field, e.g. "left hand", "15ft distance", "after beers")

**Single-player "Bank" flow:**

1. Board SVG shown (same as competitive, with gutter zone)
2. Player places bags by tapping board/gutter (up to the chosen set size: 4 or 8)
3. Bags appear as coloured dots in the player's session bag colour
4. Can reposition bags via drag (same as competitive, including drag-off-canvas snapping)
5. When ready, tap **"Bank"** button (active once at least 1 throw is placed)
6. Bags are saved as a PracticeSet, board clears, set counter increments
7. Repeat

**Two-player practice flow:**

When two players are practising, they alternate throws within each set, just like a competitive round:

```
Set 1: Player 1, Player 2, Player 1, Player 2... (4 bags each = 8 throws total)
```

1. Player 1 taps board to place a bag
2. Player 2 taps board to place a bag
3. Alternate until both players have placed all their bags (4 each if throws-per-set is 4; 8 each if throws-per-set is 8)
4. Either player taps **"Bank"** to save
5. On Bank: a PracticeSet is created for EACH player containing their respective throws. Board clears.
6. Repeat

Each player's throws are stored separately in their own PracticeSet, so heatmaps and stats are tracked independently.

**Running stats shown during practice:**

```
Sets: 5 | Total throws: 20
Cornholes: 6 (30%) | Board: 9 (45%) | Off: 5 (25%)
```

(In two-player mode, show each player's stats separately.)

**Heatmap toggle:** Button to overlay the session's heatmap on the board in real time. Updates after each banked set. (Phase 2.)

**End session:** Tap "End Practice" to save the session to history with all sets, stats, and tag.

### 8\. Heatmap View

Available from multiple entry points:

* During practice (live, session-only)
* Player Stats screen (filtered aggregate)
* Post-game review (single game)
* Standalone "My Heatmap" accessible from Stats

**Filters:**

* **Mode:** All Time | Competitive Only | Practice Only
* **Player:** Select one or compare two side-by-side
* **Date range:** Last 7 days, 30 days, All time, Custom
* **Result type:** All | Cornholes only | Board only | Off-board only

**Rendering:**

* SVG overlay on the full board+gutter area
* Divide the entire area into a 26x46 grid (cells stay roughly square given the board+gutter aspect ratio of approximately 1.77)
* Count bag placements per cell
* Colour gradient: transparent (zero) to blue (few) to yellow to red (many)
* Semi-transparent overlay so board outline/hole remain visible underneath
* Off-board zones included in the grid, so miss clustering is visible
* The gutter background uses the same solid `#DC2626` as the scoring board (no opacity modifier) so the two views read as the same physical space. Data cells with one or more throws paint on top of this base.

**What this tells you:**

* "I'm consistently landing short and left" = visible cluster in bottom-left of board
* "My misses always go long" = cluster in the top gutter
* "I'm getting closer to the hole over time" = compare last-7-days vs all-time

### 9\. Game History

* List of completed games and practice sessions (most recent first), scoped server-side to games the logged-in user was a participant in. A user with no plays sees an empty history regardless of role.
* Tabs: **Matches | Practice** (no "All"). Default is **Matches**, i.e. competitive games. Tapping Practice swaps in completed practice sessions.
* Competitive row: date, teams (with team colours), final score, winner badge
* Practice row: date, player(s), sets completed, accuracy %, session tag
* Tap to expand:

  * Competitive: round-by-round breakdown, board state replay per round (show bag positions)
  * Practice: set-by-set breakdown, session heatmap

### 10\. Player Stats

* **Summary card:** Games played, won, lost, win %, current streak
* **Throwing accuracy:** Cornhole %, Board %, Off %, shown as a donut chart or bar
* **Average points per round** (competitive only)
* **Best game:** highest personal point contribution in a single game
* **Head-to-head records:** against each other player (wins/losses when on opposing teams)
* **Heatmap:** aggregate heatmap with All Time / Competitive / Practice filters
* **Trend chart:** accuracy over last 10/20 games/sessions (line chart)
* **Practice stats:** total practice sets, practice accuracy vs competitive accuracy comparison

### 11\. Settings

* **Edit profile:** change username, PIN
* **My groups:** routes to the Groups list screen (Section 12)
* **Stats and history:** quick links to History, My Stats, Leaderboard
* **Player management (admin only):**

  * Create players directly with name + PIN
  * Reset another player's PIN (admin sets a new PIN, communicates it out of band)
  * Rename or upgrade a guest to a full account (admin sets a PIN; `isGuest` flips false)
  * Make admin: tap a player and "Make admin"; transfers the `isAdmin` flag in a single transaction (the current admin loses it)
  * Delete a player (cascades to their GamePlayer/PracticeSet/BagThrow rows)
* **Theme:** Dark (default) / Light. Dark mode is optimised for outdoor use in sunlight. Light mode fully inverts: the page goes cream, cards go white, and all text flips to navy. The splash screen is exempt and stays dark in both modes (see Section 1).
* **Install app:** always-visible entry under an "App" section. Behaviour adapts to platform and install state:
  * If the app is already running standalone (`display-mode: standalone` or iOS `navigator.standalone`), the row reads "Installed on this device." with no button.
  * On Android/desktop Chromium where a `beforeinstallprompt` event has been captured, the button reads "Install app" and tapping it fires the native installer.
  * Otherwise the button reads "How to install" and opens a platform-specific instruction sheet: Safari Share menu on iOS, browser menu on Android, address-bar install icon on desktop. This covers the case where the user dismissed the one-shot install banner and the browser will not refire `beforeinstallprompt` for ages.
* **Reset all data (admin only):** nuclear option with double confirmation. Wipes all games, rounds, sets, throws across all players. Player accounts and groups retained.

### 12\. Groups

Groups are named circles of players ("Sunday crew") used as a Game Setup filter and a stats/leaderboard scope. Each group has one admin (the creator), with member statuses `MEMBER` or `INVITED`.

**Groups list (`/groups`):**

* Lists the caller's groups (where `status=MEMBER`) with member count and an admin badge if the caller is the creator
* "Create group" button -> Groups create screen
* Empty state explains what groups are for

**Group create (`/groups/new`):**

* Single name field (1-30 chars, must be unique)
* Submit creates the group via `POST /api/groups`; the creator is automatically added as MEMBER + recorded as `Group.createdBy`

**Group detail (`/groups/:id`):**

* Header: group name (renamable inline if caller is the group admin), member count
* Members list:
  * Registered members and guests rendered together, with a status pill (MEMBER vs INVITED) and a "(you)" badge on the caller
  * Group admin can remove any member except themselves (`DELETE /api/groups/:id/members/:playerId`)
* **Invite registered players** modal: shows registered players not currently in the group, multi-select, posts `{ playerIds }` to `/api/groups/:id/invite` (creates INVITED rows)
* **Add guests** modal: shows guest players not in the group, posts `{ playerIds }` to `/api/groups/:id/add-guests` (creates MEMBER rows directly - guests can't accept invitations)
* **Leave group** button (non-admin members only). Admins must delete the group instead - they cannot leave because they'd orphan it.
* **Delete group** (group admin only) - destroys GroupMember rows; linked games' `Game.groupId` is set to null but the games themselves remain

### 13\. Invitations

Reached via the Home invitations badge or directly at `/invitations`.

* Lists pending invitations for the caller via `GET /api/invitations`: `{ groupId, groupName, invitedBy, memberCount, invitedAt }`
* Each row has **Accept** (POST `/api/groups/:id/accept`, flips INVITED -> MEMBER) and **Decline** (POST `/api/groups/:id/decline`, deletes the row)
* Empty state with a link back to Home

### 14\. Tournaments

Round-robin tournaments over 3-16 selected players. Each pairwise match becomes a regular 1v1 Game so all scoring, replay, and stats flows are reused.

**Tournament list (`/tournaments`):**

* Recent tournaments with participant chips, status badge (IN_PROGRESS / COMPLETED / ABANDONED)
* "New tournament" button -> setup screen

**Tournament setup (`/tournaments/new`):**

* Optional free-text name
* Select 3-16 players (registered or guest)
* Target score (default 21)
* Submit posts to `/api/tournaments`; server generates every pairwise match in `matchOrder` and routes to detail

**Tournament detail (`/tournaments/:id`):**

* **Standings table:** wins, losses, points for/against, point differential; sorted by wins then differential
* **Matches list:** pairings in match order, each row shows the linked Game's score if completed, or a **Start match** button if not yet started (creates the linked Game via `POST /api/tournaments/:id/matches/:matchId/start` and routes into the scoring screen with `team1Colour`/`team2Colour` defaults)
* When the last match completes, the server auto-flips `Tournament.status` to COMPLETED and sets `completedAt`
* Match completion is driven by the existing round-complete handler (`PUT /api/rounds/:id/complete`), which also writes `TournamentMatch.winnerId`

### 15\. Spectator view

A read-only live scoreboard, shareable by link.

* Route `/spectate/:gameId` - **unauthenticated**, share-by-URL
* Loads the game via `GET /api/games/:id` (this endpoint does not require auth; the spectator route was deliberately wired outside `RequireAuth`)
* Opens a WebSocket to `/ws/spectate?gameId=<id>`; receives `{ type:'connected' }` on open, then `{ type:'update', ... }` payloads when:
  * a throw is placed, repositioned, or undone (`POST/PUT/DELETE /api/throws`)
  * a round completes (`PUT /api/rounds/:id/complete`)
* UI shows team names with their bag colours, running totals, current round, and the live board with placed bags
* No interaction - the spectator can only watch
* Falls back to the most recent fetched state if the WebSocket drops; reconnects automatically

\---

## API Endpoints

All endpoints are JSON over HTTP. Auth uses `Authorization: Bearer <jwt>` (30d expiry). Unauthenticated calls to authenticated endpoints return 401. The `(admin)` marker means `req.player.isAdmin` must be true.

```
Health
  GET    /api/health                 { ok: true }

Auth
  POST   /api/auth/register          { username, pin } -> { token, player } (first registered player becomes admin)
  POST   /api/auth/login             { username, pin } -> { token, player }
  GET    /api/auth/me                -> { player } for the bearer
  GET    /api/auth/first-run         -> { firstRun: boolean } - true when the players table is empty (drives the post-login redirect to Register)

Players
  GET    /api/players                List all players, each annotated with gamesPlayed count
  GET    /api/players/:id            Public player detail
  PUT    /api/players/:id            Update username/pin (own profile or admin)
  POST   /api/players/guest          Create a guest player { displayName } -> { player } (no PIN, isGuest=true; any authenticated user can create)
  POST   /api/players/:id/upgrade    Upgrade a guest to a full account by setting a PIN (admin); { pin } -> { player }
  POST   /api/players/:id/reset-pin  Admin reset of another player's PIN { newPin }
  POST   /api/players/:id/make-admin Transfer admin to this player; clears isAdmin on caller in the same transaction (admin)
  DELETE /api/players/:id            Delete player; cascades to GamePlayer/PracticeSet/BagThrow rows (admin; cannot delete self)

Games
  POST   /api/games                  Create game.
                                       competitive: { mode:'COMPETITIVE', players:[{playerId,team,position?}], team1Colour, team2Colour, targetScore, groupId? }
                                       practice:    { mode:'PRACTICE', players:[{playerId,bagColour}], practiceThrowsPerSet:4|8, tag?, groupId? }
                                       groupId is rejected with 400 if the caller is not a MEMBER of that group.
  GET    /api/games                  List games the requesting user participated in. Filters: status, mode. Server scopes to req.player.id; any client-supplied playerId is ignored. Opportunistically runs the abandoned-practice cleanup before listing (debounced 5min per server instance).
  GET    /api/games/:id              Full game detail (players, rounds, sets, throws, result, computed totals)
  GET    /api/games/in-progress      The single most recent IN_PROGRESS game the requester is in (drives the Home resume banner)
  PUT    /api/games/:id/status       Update status to COMPLETED, ABANDONED, or IN_PROGRESS

Rounds (Competitive)
  PUT    /api/rounds/:id/complete    End round: triggers final cancellation, awards net points, creates the next Round if no team has reached targetScore (otherwise finalises Game + GameResult + cascades to TournamentMatch.winnerId if applicable). Broadcasts to spectators.

Practice Sets
  POST   /api/games/:id/sets         Bank a practice set { throws:[{playerId,boardX,boardY}], tag? }; in two-player mode, creates one PracticeSet per playerId
  GET    /api/games/:id/sets         List sets in a practice session

Throws
  POST   /api/throws                 Place a competitive throw { gameId, roundId, playerId, boardX, boardY } - server classifies the result/points, recalcs the round, broadcasts. Rejects if round is not active or already has 8 throws.
  PUT    /api/throws/:id             Reposition a placed throw (any throw, competitive or practice); server re-classifies and (if competitive) recalcs the parent round
  DELETE /api/throws/:id             Undo a throw; for competitive, must be the most recent throw in the active round

Stats
  GET    /api/stats/player/:id       Player aggregate stats - games, wins/losses, accuracy, streak, trend (last 20 sessions across modes). Optional ?groupId= filter.
  GET    /api/stats/heatmap          Bag-throw heatmap data: ?playerId required, optional mode (COMPETITIVE|PRACTICE), dateFrom/dateTo (ISO), result (CORNHOLE|BOARD|OFF), groupId
  GET    /api/stats/head-to-head     H2H between two players ?player1Id&player2Id (both required); only counts games where they were on opposing teams. Optional ?groupId=
  GET    /api/stats/leaderboard      All players ranked by win rate; ?minGames= floor (default 1), ?groupId= filter

Groups
  POST   /api/groups                 Create group { name }; creator is added as MEMBER + recorded as Group.createdBy (admin of that group)
  GET    /api/groups                 List groups the caller is a MEMBER of, with memberCount and isAdmin flag
  GET    /api/groups/:id             Group detail with full member list (MEMBER must be the caller, else 403)
  PUT    /api/groups/:id             Rename group { name } (group admin only)
  DELETE /api/groups/:id             Delete group (group admin only); cascades to GroupMember rows; Game.groupId set to null on linked games
  POST   /api/groups/:id/invite      Invite registered players { playerIds }; creates GroupMember rows with status INVITED (group admin)
  POST   /api/groups/:id/add-guests  Add guest players directly as MEMBER { playerIds } (group admin)
  POST   /api/groups/:id/accept      Accept a pending invitation (the caller's own); flips INVITED -> MEMBER
  POST   /api/groups/:id/decline     Decline a pending invitation (the caller's own); deletes the row
  POST   /api/groups/:id/leave       Leave the group (non-admin members only; group admin must delete the group)
  DELETE /api/groups/:id/members/:playerId  Remove a member (group admin; cannot remove self)

Invitations
  GET    /api/invitations            All pending invitations for the caller -> [{ groupId, groupName, invitedBy, memberCount, invitedAt }]

Tournaments
  POST   /api/tournaments            Create tournament { name?, playerIds:[3..16], targetScore? }; generates every pairwise match in matchOrder
  GET    /api/tournaments            List tournaments (most recent 50) with participants
  GET    /api/tournaments/:id        Full detail: matches + computed standings (wins, losses, points for/against; tiebreak by point differential)
  POST   /api/tournaments/:id/matches/:matchId/start   { team1Colour?, team2Colour? } -> { gameId }; creates the linked Game and routes the user into the standard scoring screen

Admin
  POST   /api/admin/reset-data       Wipe all games, rounds, sets, throws, GamePlayer rows in one transaction (admin). Player accounts and groups retained. Double-confirmation enforced client-side.

Spectator (WebSocket, not HTTP)
  WS     /ws/spectate?gameId=<id>    Subscribe to live updates for a game. Server pushes { type:'connected', gameId } on connect, then { type:'update', gameId, ... } payloads when a throw is placed, repositioned, or undone, or when a round completes. No auth - spectator URL is share-by-link.
```

\---

## PWA Requirements (Phase 3)

* **Service worker:** Cache app shell + static assets for offline use (vite-plugin-pwa, `registerType: 'autoUpdate'`)
* **Manifest:** App name ("PT Cornhole Scorer"), icons (192px + 512px), theme colour `#0C447C`, standalone display mode, orientation portrait
* **Install prompt (one-shot banner):** `<InstallPrompt>` listens for `beforeinstallprompt`, caches the event, and renders a bottom banner with "Install" / "Not now". Dismissal sets `pt_cornhole_install_dismissed=1` in localStorage; the banner does not reappear.
* **Always-available Install entry in Settings:** Section 11 covers the fallback path for users who dismissed the banner, or whose browser never fires `beforeinstallprompt` (iOS). Both paths consume the same `InstallContext`.

**Offline data sync is Phase 4** (deferred and not yet shipped). MVP and Phase 3 are online-only for game state. The PWA install and app-shell caching shipped in Phase 3 because they're cheap; the IndexedDB sync queue is its own beast.

\---

## Deployment (Railway)

```
Project structure:
  /client                  React + Vite frontend (PWA)
  /server                  Express API
    /server/prisma         Prisma schema + migrations
    /server/routes         Express route modules (auth, players, games, ...)
    /server/lib            Auth helpers, scoring cascade, spectator WS, prisma client
    /server/scripts/seed.js  Dev seed script (creates 5 test players)
  package.json             Root - orchestrates dev/build/start across /client and /server

Railway services:
  1. PT_Cornhole web service: serves built frontend (Vite build -> /client/dist) + API on the same Express process. WebSocket spectator endpoint /ws/spectate is attached to the same HTTP server.
  2. Postgres: Railway Postgres plugin (DATABASE_URL is the unsuffixed `Postgres` instance; the project happens to host other Postgres services that are not wired to PT_Cornhole)

Environment variables:
  DATABASE_URL       (auto-set by Railway Postgres plugin; postgres.railway.internal in production, localhost:5433 locally via Docker)
  JWT_SECRET         (random 32+ char string; throws at startup if missing)
  JWT_EXPIRY         "30d" (default if unset)
  PORT               (Railway-supplied in production; defaults to 3001 in dev)
```

Build command: `npm run build` (root) - runs `npm install && vite build` in /client, then `npm install && prisma generate` in /server. The Prisma generate is prefixed with a stub `DATABASE_URL` because Prisma 6 validates the env var at config-load time even when generate doesn't connect.

Start command: `npm run start` (root) - launches the Express server which serves `/client/dist` as static files plus the `/api/*` routes.

Dev command (from project root): `docker start pt-cornhole-db && npm run dev`. `npm run dev` uses `concurrently` to launch the Vite dev server (port 5173, proxies /api -> localhost:3001) and the Express API under nodemon (port 3001).

**Railway should auto-detect build and start commands.** Do not include a `railway.toml` unless auto-detection fails. The Express server serves `/client/dist` as static files and includes a catch-all route that returns `index.html` for all non-API paths (client-side routing).

**Production migrations:** run via `railway run npx prisma migrate deploy` from /server, OR pull the public `DATABASE_PUBLIC_URL` from the `Postgres` service and prefix it inline (the internal hostname is unreachable from a local machine). The latter pattern is captured in the operational gotchas memory.

\---

## Build Phases

### Phase 1, MVP (get playing ASAP)

**Status: Shipped.**

Core scoring loop with alternating throws, bag placement, and drag-to-reposition. No heatmaps, no stats, no PWA, no offline.

* \[ ] Project scaffolding (Vite + React + Tailwind + Express + Prisma + Postgres, npm workspaces)
* \[ ] `npm run dev` working end-to-end (client + server + DB)
* \[ ] Database schema + migrations (all tables including `position` on GamePlayer and `throwingPair` on Round)
* \[ ] Seed script: 4 test players with PIN "1234" (bcrypt-hashed), first one as admin
* \[ ] Auth: register + login (username + 4-digit PIN, JWT 30d)
* \[ ] Splash screen: `SplashScreen.jsx` importing existing `SplashArt.jsx` (do not regenerate SplashArt)
* \[ ] Game setup: select players, assign teams (and positions in 2v2), pick team colours, set target score
* \[ ] Board SVG: board (beige/cream surface) + gutter zone (red-tinted) + hole (black), tap-to-place bags
* \[ ] Hole detection logic (distance from centre)
* \[ ] Bag rendering: coloured dots in team colour (competitive) or player colour (practice)
* \[ ] Drag-to-reposition: tap-hold + drag, snap to new position, auto-recalculate score via live cascade
* \[ ] Drag-off-canvas: snap to gutter at edge crossing point, mark OFF
* \[ ] Alternating throw flow with correct 2v2 pair rotation and first-throw rule
* \[ ] Live cancellation scoring: round summary panel updates after every throw, reposition, and undo
* \[ ] Round completion: final cancellation applied to game totals, round summary overlay
* \[ ] Win detection: team >= target score
* \[ ] Game completion screen (winner, final score)
* \[ ] Quit Game flow (sets ABANDONED status)
* \[ ] Practice mode: single player, choose 4 or 8 throws per set, bank-and-clear flow, running accuracy stats
* \[ ] Two-player practice mode: alternating throws within each set, separate PracticeSets per player
* \[ ] Basic game history list (competitive + practice)
* \[ ] Deploy to Railway

**Estimate:** 4-6 Claude Code sessions (12-20 hours of prompting/iteration). The board SVG plus touch/drag interaction is the longest individual piece. Test on a real phone early.

### Phase 2, Heatmaps \& Stats

**Status: Shipped.**

* \[ ] Heatmap rendering engine (SVG 26x46 grid overlay, colour gradient, includes gutter zone)
* \[ ] Heatmap filters: All Time / Competitive / Practice, date range, result type
* \[ ] Practice session live heatmap (updates after each banked set)
* \[ ] Player stats page: win rate, accuracy breakdown, avg points/round, streaks
* \[ ] Head-to-head records
* \[ ] Leaderboard (all players ranked)
* \[ ] Game detail view: round replay showing bag positions on board
* \[ ] Practice detail view: set-by-set breakdown + session heatmap

**Estimate:** 2-3 Claude Code sessions (5-8 hours)

### Phase 3, Polish \& PWA Install

**Status: Shipped.** Plus a follow-up Settings "Install app" entry so users who dismissed the one-shot install banner can still install later (see Section 11).

* \[ ] PWA manifest + service worker + install prompt + app-shell caching
* \[ ] Dark/light theme toggle (default dark)
* \[ ] Session tagging in practice mode (if not already in Phase 1)
* \[ ] Accuracy trend charts (line chart over last N games/sessions)
* \[ ] Admin: player management UI, PIN reset, admin transfer, data reset
* \[ ] Responsive desktop layout (side-by-side board + stats)

**Estimate:** 1-2 Claude Code sessions (3-6 hours)

### Phase 4, Nice to Have (v2)

**Status: Partially shipped.**

Shipped:
* \[x] Spectator view / live scoreboard via WebSocket (see Section 15)
* \[x] Tournament mode: round-robin only (see Section 14)
* \[x] Export stats to CSV (download button on History)
* \[x] Bag placement animation on tap (`bag-drop-in` keyframe in `index.css`)
* \[x] Groups: invite-based player circles with scoped stats/leaderboard (see Section 12; not in the original Phase 4 list but built in the same period)
* \[x] Guest players: name-only accounts that don't log in but accumulate stats; upgradeable to full accounts (admin sets a PIN)

Still to come:
* \[ ] **Offline scoring with IndexedDB sync queue** (deferred from Phase 3)
* \[ ] Push notifications ("Your turn!")
* \[ ] "Replay" mode: animated playback of a completed round
* \[ ] Social: share game results (screenshot generation or share link)
* \[ ] Tournament: elimination bracket, byes, 2v2 (current implementation is round-robin 1v1 only)

**Estimate:** Each item independent; 1-3 sessions per item depending on scope.

### Phase 5, Post-launch iteration log

Maintenance and polish carried out after the initial Phase 1-4 build. Each item is live in production.

* **Bug fix - history scoping:** `GET /api/games` was returning every game in the DB to any authenticated user. Now enforced server-side to the requesting player; query-param overrides ignored. (See Key design decision #11.)
* **Light mode rebuild:** introduced semantic theme tokens (`bg-page`, `bg-surface`, `bg-surface-2`, `text-ink`, `bg-ink`, `border-ink`) driven by `[data-theme]` and Tailwind v4 `@theme inline`. Cards now fully invert in light mode rather than staying dark on a cream page. Splash screen exempt. (See Design Notes.)
* **History UI:** tabs reduced to Matches / Practice (no "All"), default Matches.
* **Abandoned-practice cleanup:** `Game.updatedAt` added; in-progress practice games older than 24h are hard-deleted on the next `GET /api/games` request (debounced 5min per server instance). (See Key design decision #12.)
* **Heatmap colour fix:** off-board zone now uses the same solid `#DC2626` as the scoring board's gutter so the two views read as the same physical space.
* **Bag-number legibility:** larger, bolder digits with `paintOrder="stroke fill"` outline for white-on-coloured-bag readability; black-on-yellow.
* **Install entry in Settings:** always-available install row in Settings adapts to platform + install state. Solves the "I dismissed the banner and now can't install" dead-end.

\---

## Cost Estimate

|Item|Cost|
|-|-|
|Railway Hobby plan|\~$5/month (includes Postgres, web service)|
|Domain (optional)|\~$10/year if wanted later|
|**Total**|**\~$5/month**|

\---

## Design Notes

* **Mobile-first:** All layouts designed for 375px+ viewport (iPhone SE minimum)
* **Large tap targets:** Board bags = 40-50px diameter. Buttons = 44px minimum height. Gutter zone wide enough for a finger tap (\~60px minimum each side).
* **High contrast:** Outdoor use in sunlight. Dark mode default with bold bag colours.
* **Theme tokens (not raw hex) for surfaces and ink.** The two themes are driven by `[data-theme="dark"]` / `[data-theme="light"]` on `<html>` and a small set of CSS variables (`--pt-page`, `--pt-surface`, `--pt-surface-2`, `--pt-ink`) exposed to Tailwind v4 via `@theme inline` as `bg-page`, `bg-surface`, `bg-surface-2`, `text-ink`, `bg-ink`, `border-ink`, etc. New UI should use these tokens rather than hardcoded `#FAEEDA` / `#082F58` / `#0C447C`; otherwise it will look correct in dark mode and broken in light mode. SVG elements that need to flow with the theme use `fill="currentColor"` and inherit from the body's `color: var(--color-page-text)`.
* **Minimal navigation:** 2 taps max from home to actively scoring
* **Bag colours (hex values for rendering):** Yellow (#FFD700), Red (#EF4444), Blue (#3B82F6), Green (#22C55E). Bags have a dark border/shadow for visibility on both light and dark backgrounds.
* **Board SVG proportions:** Board area is 2:1 (matching real 2ft x 4ft). Gutter zone adds \~15% padding on each side. Hole is circular, positioned at correct proportional location (centre-x of board, 75% up from bottom edge of board).
* **Board surface colour:** Beige/cream (#D4B58F or similar warm wood tone)
* **Gutter zone colour:** Red-tinted (#7F1D1D at low opacity, or similar) to clearly signal "off-board / miss zone"
* **Hole colour:** Black circle with a subtle ring
* **Drag interaction:** 200ms hold to activate. Slight haptic feedback if browser supports it. Clear visual states: idle, hold-activated (glow), dragging (shadow trail), drop zone highlighting.
* **Typography:** System font stack. Scores in 32px+. Player names in 16px. Round details in 14px.

\---

## Notes for Claude Code

When building this project, follow this order strictly:

1. **Scaffold first.** Get the Vite + Express + Prisma + Postgres project running locally before writing any features. Use npm workspaces with /client and /server as workspace packages and a shared root package.json. Verify `npm run dev` from the root starts both the React app (Vite, port 5173) and the API (Express + nodemon, port 3001) concurrently. The Vite dev server should proxy /api requests to the Express server.
2. **Database schema second.** Run `prisma migrate dev` and verify all tables exist before touching frontend code. Then write `server/scripts/seed.js` that creates the test players (current seed: Alice as admin plus Bob, Charlie, Dana, Dodie) with PIN "1234" bcrypt-hashed, not raw. Wire it as `npm run seed` from the root.
3. **`SplashArt.jsx` is a finished asset.** Do not modify, regenerate, or recreate it. Copy it into the project as-is. Build `SplashScreen.jsx` that imports it.
4. **Board SVG is the critical path.** Get the board rendering (beige/cream surface, black hole, red-tinted gutter), tap detection (board vs hole vs gutter), and bag placement working before building any game logic around it. This is the component everything else depends on.
5. **Touch events need explicit handling.** Use pointer events (`pointerdown`/`pointermove`/`pointerup`) for cross-platform compatibility. Prevent default scroll behaviour during drag. Test the 200ms hold detection against iOS Safari's native long-press behaviour (context menu, text selection). The board must work on both touch and mouse.
6. **Drag-to-reposition is Phase 1.** Do not defer this. It is core gameplay, not polish. Players WILL need to move bags during a round (knocked in/off by subsequent throws). Drag-off-canvas snaps to gutter at the edge crossing point.
7. **Test on a real phone early.** Touch events behave differently from mouse events. Test tap, hold, and drag on both Android and iOS Safari before building out the full scoring flow. iOS Safari is the harder target.
8. **Keep the API simple.** REST endpoints, no GraphQL. Prisma handles the query complexity. Don't over-engineer auth; it's 4-digit PINs, not bank security. No rate limiting on login.
9. **Live score cascade is mandatory.** Every bag placement, reposition, and undo must trigger the full score recalculation chain: throw points -> round raw scores -> cancellation net -> scoring team. The client must display updated cancellation at all times during a round. See the "Live score recalculation rule" in the Data Model section.
10. **2v2 throw order: pairs alternate rounds, not players within rounds.** In 2v2, each round involves one player from each team (the pair at one end). The other pair throws the next round. See the explicit example in the Scoring Screen section. The `Round.throwingPair` and `GamePlayer.position` fields support this. Do not interleave all four players within a single round.
11. **Heatmap rendering approach (Phase 2):** SVG rect grid overlay. Do NOT use canvas (SVG is easier to theme and scale). Divide the full board+gutter area into a 26x46 grid (gives roughly square cells given the \~1.77 aspect ratio), count throws per cell, map count to colour opacity using a quantile-based scale so the gradient stays useful regardless of total throw volume.
12. **Coordinate system:** boardX and boardY are normalised 0-1 over the FULL board+gutter area, not just the board surface. Bag placements, hole detection, drag-snap-back, and heatmap rendering all use this same coordinate space. Constants for hole centre and radius live in a shared module.
13. **First-throw rule:** Round 1 starts with Team 1 (Game.startingTeam = 1). At round end, set Game.startingTeam to the round's scoringTeam (or leave unchanged if the round was tied). Round.startingTeam captures who actually threw first that round, for replay/audit.
14. **No em dashes** in any code comments, error messages, button labels, or UI text. Use commas, semicolons, or full stops.
15. **UK English** in user-facing text where it shows up (e.g. "Bag colour" not "Bag color"). Code identifiers can be US English where the ecosystem expects it (e.g. CSS `color`).
16. **Railway auto-detection.** Do not include a `railway.toml`. Let Railway auto-detect build and start commands. Express must serve `/client/dist` as static files with a catch-all route returning `index.html` for client-side routing.

