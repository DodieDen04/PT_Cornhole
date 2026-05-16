# PT Cornhole: Fixes Round 3 (Handoff for Claude Code)

Complete each phase in order. Do not skip ahead.

---

## Phase A: Gameplay bug

### A1. Allow bag repositioning after the 8th throw

**Bug:** After the 8th (final) throw of a round is placed, the board freezes. No bags can be repositioned. The only workaround is to undo the 8th throw, reposition the affected bag, then re-place the 8th throw.

**Why this is wrong:** In real cornhole, the 8th throw can knock a previously placed bag into the hole or off the board. The player needs to reposition the affected bag AFTER placing the 8th throw, before tapping "End Round".

**Fix:** The board must remain interactive after all 8 throws are placed. Specifically:
- Placing the 8th throw should NOT freeze the board or disable touch/pointer events
- All existing bags (throws 1-8) should remain draggable via the existing tap-hold-drag mechanism
- The "End Round" button becomes active after the 8th throw, but the board stays live
- Only when the user taps "End Round" (triggering the round-end popup) does the round lock

The flow should be: place all 8 bags -> reposition any bags as needed (knocks, bounces) -> tap "End Round" when the board state is correct.

**Verify after fixing:**
1. Place 8 bags in a round
2. Tap and hold any previously placed bag; confirm it enters drag mode
3. Drag it to a new position (board, hole, or gutter); confirm score recalculates
4. Tap "End Round"; confirm the popup shows correct scores reflecting the repositioned bag

---

## Phase B: Scoring screen improvements

### B1. Show live round score in the team header boxes

Currently the team header boxes above the board show the running game score. Add the current round's score alongside it.

**Layout:**

```
┌─────────────────┬─────────────────┐
│  (3)        12  │  (1)         8  │
│  Team 1 (you)   │  Team 2         │
│  ● ● ○ ○        │  ● ○ ○ ○        │
└─────────────────┴─────────────────┘
```

- **(3)** = current round score for this team, shown in parentheses, non-bold, italic. Updates live as bags are placed and repositioned.
- **12** = running game total, bold, right-aligned within the box. This is the existing score display.
- The round score sits on the left, the game score on the right, on the same line. This uses the existing horizontal space without adding a new row.

### B2. Bag indicator icons for misses and cornholes

The bag indicators (small circles below each team's score) currently show as hollow (unthrown) or filled (thrown). Enhance them to reflect the throw result:

- **Unthrown:** hollow circle (as now)
- **Board (1pt):** filled circle in team colour (as now)
- **Off / Miss (0pt):** filled circle with a small red **✕** overlaid on it
- **Cornhole (3pt):** filled circle with a small bullseye icon overlaid (concentric rings, or a simple target symbol)

These indicators should update live. If a bag is repositioned (e.g. dragged from the board to the gutter), its indicator should change from a filled circle to the ✕ miss icon.

Keep the icons small enough that all four fit comfortably in the available space. If the ✕ and bullseye are too detailed at small sizes, simplify: a red diagonal cross for miss, a white dot-in-circle for cornhole.

### B3. Centre-justify content in the team header boxes

All elements within each team's header box (round score, game score, team label, bag indicators) should be centre-justified horizontally. Currently they may be left-aligned or inconsistently aligned.

### B4. Fix Team 1 red bag colour

**Bug:** On the 2v2 Game Setup screen, the Team 1 red bag colour still displays as the old grey-red rather than the correct red (#EF4444).

**Fix:** Find where the red bag colour is rendered on the Game Setup screen and ensure it uses #EF4444 (or the `red` value from the bag colour enum). This may be a different component or colour reference than the one fixed previously on the scoring board.

---

## Phase C: Light mode box styling

Multiple screens have the same problem: blue-tinted boxes that look fine in dark mode but appear as a washed-out bluey-grey in light mode. Fix all of them in one pass.

### C1. Define the light mode box style

In light mode, all info boxes (team score headers, round-complete summary boxes, game-over summary boxes) should use:
- **Background:** cream (#FAEEDA) or white
- **Border:** 1px solid navy (#0C447C)
- **Text:** navy (#0C447C)

In dark mode, keep the current styling (blue-tinted background, white/cream text).

### C2. Apply to all affected screens

Search for and update every instance of these boxes across the app. Known locations:

1. **Scoring screen:** team header boxes above the board (the boxes containing scores and bag indicators)
2. **Round complete popup:** score summary boxes at the top
3. **Game over screen:** final score boxes

There may be others. Search the codebase for the blue box background colour class/value and ensure every instance has the light mode alternative applied.

### C3. Centre-justify round complete popup scores

On the "Round X complete" popup, the score boxes at the top should be centre-justified (same as the scoring screen header boxes in B3).

---

## Phase D: Navigation and usability

### D1. Back navigation for Settings sub-screens

**Bug:** The History, My Stats, and Leaderboard screens (which now live inside Settings) only have a "Home" link in the top right. There is no way to go back to Settings without going all the way to Home first.

**Fix:** Replace the "Home" link with a breadcrumb trail showing the navigation path. Format:

```
Home / Settings / History
```

Each segment is tappable:
- "Home" goes to the dashboard
- "Settings" goes back to the Settings screen
- The final segment (current page) is not tappable, shown in bold or different weight

Apply this breadcrumb pattern to all screens accessed via Settings:
- Home / Settings / History
- Home / Settings / My Stats
- Home / Settings / Leaderboard
- Home / Settings / My Groups
- Home / Settings / Player Management
- (and any other sub-screens within Settings)

If breadcrumbs feel too wide on mobile, an acceptable alternative is a simple back arrow (←) that goes to the parent screen (Settings), plus a small "Home" icon in the top corner.

### D2. Username field hint text

**Problem:** Users are entering their email addresses as usernames because the field just says "Username" with no guidance. This results in names like "ben.tankard@hotmail.com" showing up in game history and scoreboards.

**Fix:** On the account creation screen, update the Username field:
- **Label:** "Username"
- **Placeholder text inside the field:** "e.g. Ben, Benny T, BenTheThrower"
- **Helper text below the field:** "This is your display name in games (at least 3 characters)"
- **Validation:** minimum 3 characters (add this if not already enforced)

This won't fix existing accounts, but it prevents the problem going forward. Existing users can rename themselves via Settings > Edit Profile.

---

## General reminders

- UK English in all user-facing text
- No em dashes
- Do not modify `SplashArt.jsx`
- Test light mode across all affected screens after Phase C
- Test bag repositioning on a real phone after Phase A
