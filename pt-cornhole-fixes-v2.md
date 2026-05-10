# PT Cornhole: Fixes and Changes (Handoff for Claude Code)

Read and follow the phasing below strictly. Complete each phase before moving to the next. Do not jump ahead.

## Reference

The authoritative spec is `cornhole-scorer-spec-v4.md`. All existing behaviour not mentioned below should remain unchanged. All four build phases from the v4 spec are already implemented and deployed.

\---

## Phase A: Scoring screen layout and round-end popup

The scoring screen currently requires scrolling to see round details and action buttons below the board. On mobile, this conflicts with the board's touch handling (any touch on the board places a bag, making scroll impossible). Rather than changing the board's touch behaviour, fix the layout so there is nothing to scroll to.

### A1. Restructure the scoring screen layout (no scroll)

The scoring screen must fit entirely within the viewport with no vertical scrolling. Everything the player needs during active play appears above the board. Everything else moves into the round-end popup (A2 below).

**New layout (portrait mobile, single viewport, no scroll):**

```
┌──────────────────────────────────┐
│ \[PT]              Round 3        │  Header: PT logo (small), round number
├──────────────────────────────────┤
│  Team 1: 12    │    Team 2: 8   │  Running match score, large, team colours
│  ● ● ● ●      │    ● ● ● ●    │  Bag indicators (filled = thrown, hollow = remaining)
├──────────────────────────────────┤
│  Now throwing: Alice  🟡        │  Current player + bag colour
├──────────────────────────────────┤
│                                  │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐  │
│  ╎        GUTTER             ╎  │
│  ╎  ┌─────────────────────┐  ╎  │
│  ╎  │                     │  ╎  │
│  ╎  │    BOARD SURFACE    │  ╎  │
│  ╎  │       ( O )         │  ╎  │
│  ╎  │                     │  ╎  │
│  ╎  └─────────────────────┘  ╎  │
│  ╎        GUTTER             ╎  │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  │
│                                  │
├──────────────────────────────────┤
│  \[Undo Last]       \[End Round]  │  Action bar (fixed at bottom)
└──────────────────────────────────┘
```

Key changes from the current layout:

* **Remove** the inline round summary panel that previously sat below the board (the "This round: T1: Board(1) Cornhole(3)..." section and the "Round: T1: 4 | T2: 0 / Cancellation: +4 to Team 1" section). That detail now appears only in the round-end popup.
* **Remove** the "Quit Game" button from the scoring screen. Move it into the round-end popup as a tertiary action.
* **Add bag indicators** below each team's score: small dots showing how many bags have been thrown vs remaining in this round (e.g. 4 filled dots = 4 thrown, 4 hollow = 4 remaining). This replaces the "Throw 3 of 8" text and is more compact.
* The board SVG should fill all available vertical space between the header area and the action bar. Use flexbox or similar to make it expand.
* "Undo Last" is available during the round (removes last throw, steps back one turn).
* "End Round" is available only when all 8 throws are placed.

The board's touch behaviour does NOT change. Tapping on the board still places a bag. Since nothing exists below the board, there is no reason to scroll.

### A2. Round-end popup overlay

When the user taps "End Round" after all 8 throws are placed, show a popup overlay centred on the screen (over the board).

**Popup contents:**

1. **Match score** (running total for each team after this round's cancellation is applied, large text, team colours)
2. **This round** (raw points per team, then the cancellation result, e.g. "T1: 7 | T2: 4 = +3 to Team 1")
3. **Bag details** (all 8 throws in throw order, each showing: player name, result (Cornhole / Board / Off), points)
4. **Action buttons:**

   * **"Next Round"** (primary, prominent): banks the round, applies cancellation to game totals, starts the next round
   * **"Undo Last"** (secondary): removes the last throw and closes the popup, returning to the board for correction. The player can then re-throw and tap "End Round" again.
   * **"Quit Game"** (tertiary, small, bottom of popup): opens the existing confirm dialog ("End this game without finishing?"), sets ABANDONED status

Semi-transparent dark backdrop behind the popup. Tapping outside the popup does nothing; force a deliberate button press.

If the round results in a win (team >= target score), replace "Next Round" with "Finish Game" which goes to the game completion screen. Remove "Undo Last" from the win popup; the game is over.

### A3. Fix 1v1 opponent selection

**Bug:** There is no working way to select an opponent for a 1v1 competitive match.

The v4 spec (Section 5, Game Setup) says all registered players should appear as tappable cards, and the user assigns them to Team 1 or Team 2. Verify this works:

* All registered players (and guest players, once Phase C is built) appear in the selection list
* The logged-in user is pre-assigned to Team 1
* Tapping another player assigns them to Team 2
* Game can start once at least one player is on each team

\---

## Phase B: Menu and navigation changes

Quick, low-risk UI changes. Do as a batch.

### B1. Menu label changes

On the Home / Dashboard screen:

* Rename "New Game" to "Start Match"
* Rename "Practice" to "Practice Mode"

### B2. Remove Tournaments from the menu

If a "Tournaments" option is showing on the Home / Dashboard, remove it entirely. Tournaments are a future feature. No UI entry point should exist for unbuilt features.

### B3. Simplify the main menu

Move the following items OFF the Home / Dashboard and into the Settings screen:

* History
* My Stats
* Leaderboard

The Home / Dashboard should show only:

* Start Match (button)
* Practice Mode (button)
* Resume Game (shown prominently only if a game is in progress)
* Settings (gear icon)

Inside Settings, add a section (e.g. "Stats and History") containing links to History, My Stats, and Leaderboard.

### B4. PT logo in header

Replace the "PT Cornhole" text in the top-left with the PT monogram graphic. Create a small `PTLogo.jsx` component containing only the P and T SVG path data copied from `SplashArt.jsx`. Do NOT modify `SplashArt.jsx` itself. Size the logo to roughly match the height of adjacent navigation elements (\~28-32px).

\---

## Phase C: Guest players

This adds a new player type so the logged-in user can record matches against people who are not registered users.

### C1. Guest player model

Add a boolean field `isGuest` to the Player model (default `false`). Guest players:

* Have a display name (required, must be unique across all players including guests)
* Do NOT have a PIN (pinHash is null)
* Cannot log in
* Appear in player selection lists alongside registered players (visually distinguished, e.g. a small "Guest" badge)
* Accumulate stats, bag throw data, and heatmap data like any other player
* Can be "upgraded" to a full account later via Settings > Player Management by setting a PIN

### C2. Quick Add from Game Setup

On the Game Setup screen (for Start Match), add a "Quick Add" or "+" button near the player list. Tapping it shows a minimal inline form:

* Display name field (required)
* "Create" button

On submit: creates a guest player via the API and immediately adds them to the player selection list for this game. No PIN entry, no confirmation screen, no login flow. One tap, one field, done.

API: `POST /api/players/guest { displayName }` (auth required; any logged-in user can create a guest)

### C3. Guest management

In Settings > Player Management (admin section), guest players should:

* Be listed with a "Guest" badge
* Support renaming
* Support "Upgrade to full account" (set a PIN, clears isGuest flag)
* Support deletion (with confirmation; warn if the guest has game history)

\---

## Phase D: Groups (future, do not build yet)

Parking this for a future session. The intent is:

* Named groups of players (e.g. "Sunday crew") for quick selection during game setup
* Filter the player list by group when setting up a match
* Any player (registered or guest) can be in a group

This depends on Phase C (guest players) being complete first. Do not build this now.

\---

## General reminders (apply to all phases)

* UK English in all user-facing text
* No em dashes anywhere
* Do not modify `SplashArt.jsx`
* Follow the v4 spec for anything not explicitly changed above
* Test touch interactions on a real phone after Phase A
* Seed script should bcrypt-hash PINs, not store them raw

