# PT Cornhole: Phase D — Groups (Handoff for Claude Code)

Read and follow the steps below in order. Complete each step before moving to the next.

## Reference

The authoritative spec is `cornhole-scorer-spec-v4.md`. Phases A, B, C from `pt-cornhole-fixes-v2.md` are already implemented. Guest players (isGuest flag on Player) are live.

## What groups are

Groups are named collections of players (e.g. "Sunday crew") used for two things:
1. **Quick game setup:** filter the player list to your usual opponents
2. **Group stats:** see how you stack up against your friends (leaderboard, head-to-head, filtered by group)

Groups are invite-based. The creator is the group admin. Registered users must accept an invitation before they become members. Guest players are added directly by the admin (they cannot log in to accept invitations).

Games started from a group filter are tagged with that group, so stats and leaderboards can be filtered by group context.

---

## Step 1: Data model

Add new tables and modify the Game table. Run `prisma migrate dev` and verify before writing frontend code.

```
Group
  id          String   @id @default(uuid())
  name        String   (unique, max 30 characters, trimmed)
  createdBy   String   (FK -> Player.id)
  createdAt   DateTime @default(now())

GroupMember
  id          String   @id @default(uuid())
  groupId     String   (FK -> Group.id, onDelete: Cascade)
  playerId    String   (FK -> Player.id, onDelete: Cascade)
  status      String   (enum: MEMBER | INVITED)
  addedAt     DateTime @default(now())

  @@unique([groupId, playerId])
```

**Modify existing Game table:**

Add one nullable field:
```
Game
  ...existing fields...
  groupId     String?  (FK -> Group.id, nullable, onDelete: SetNull)
```

`onDelete: SetNull` means if a group is deleted, games previously played under that group keep their records but lose the group link. This is intentional: deleting a group is an organisational action, not a data purge.

**Status values explained:**
- `MEMBER`: fully joined. Either a guest player added directly by the admin, or a registered user who accepted an invitation.
- `INVITED`: a registered user who has been invited but has not yet accepted. They cannot see or use the group until they accept.

**Cascade rules:**
- Deleting a group removes all GroupMember rows (cascade)
- Deleting a player removes them from all groups (cascade)
- Deleting a group sets groupId to null on any linked games (SetNull)

---

## Step 2: API endpoints

```
Groups
  POST   /api/groups                         Create group { name }
  GET    /api/groups                         List all groups where the logged-in user is a MEMBER (with member count)
  GET    /api/groups/:id                     Group detail (members with status, admin info)
  PUT    /api/groups/:id                     Rename group { name } (admin only)
  DELETE /api/groups/:id                     Delete group (admin only)

Members
  POST   /api/groups/:id/invite              Invite registered users { playerIds[] } (admin only)
  POST   /api/groups/:id/add-guests          Add guest players directly { playerIds[] } (admin only; sets status = MEMBER immediately)
  POST   /api/groups/:id/accept              Accept invitation (logged-in user accepts their own pending invite)
  POST   /api/groups/:id/decline             Decline invitation (logged-in user declines; removes the GroupMember row)
  POST   /api/groups/:id/leave               Leave group (logged-in user removes themselves; admin cannot leave their own group)
  DELETE /api/groups/:id/members/:playerId   Remove a member (admin only)

Invitations
  GET    /api/invitations                    List pending invitations for the logged-in user (all groups where their status = INVITED)

Games (modification to existing endpoint)
  POST   /api/games                          Add optional groupId to the create-game payload. If provided, stored on the Game record.

Stats (modifications to existing endpoints)
  GET    /api/stats/leaderboard              Add optional query param: ?groupId=xxx (filters to games tagged with that group)
  GET    /api/stats/player/:id               Add optional query param: ?groupId=xxx (filters stats to group games only)
  GET    /api/stats/head-to-head             Add optional query param: ?groupId=xxx
  GET    /api/stats/heatmap                  Add optional query param: ?groupId=xxx
```

**Auth and permissions:**
- Any logged-in user can create a group (they become its admin)
- Only the group admin (creator) can: invite, add guests, remove members, rename, delete
- Any member can: view the group, leave the group, use the group filter in game setup
- The admin cannot leave their own group. To get rid of it, they delete it.
- Invited (not yet accepted) users cannot see or use the group. They only see it in their invitations list.

**Validation:**
- Group name: required, 1-30 characters, trimmed, unique (case-insensitive if practical)
- Invite: playerIds must be registered users (isGuest = false); skip any already invited or already members
- Add guests: playerIds must be guest players (isGuest = true); set status = MEMBER immediately
- Cannot invite yourself (the creator is already a member)

---

## Step 3: Invitation notifications

Registered users need to know when they have been invited to a group. Since the app has no push notifications, this is handled via a badge and an invitations screen.

### A. Dashboard badge

On the Home / Dashboard screen, if the logged-in user has any pending invitations (status = INVITED), show a notification badge. Options (pick whichever fits the existing layout best):
- A red dot/count badge on the Settings gear icon
- A small banner below the main menu buttons: "You have 2 group invitations" (tappable, goes to invitations)
- A badge on a dedicated "Invitations" row if one exists

The badge should show the count of pending invitations. It should disappear when all invitations are accepted or declined.

### B. Invitations screen

Accessible from the dashboard badge or from Settings. Shows a list of pending group invitations:

```
┌──────────────────────────────────┐
│  Group Invitations               │
│                                  │
│  ┌────────────────────────────┐  │
│  │  Sunday crew               │  │
│  │  Invited by: Alice         │  │
│  │  4 members                 │  │
│  │  [Accept]  [Decline]       │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │  Work league               │  │
│  │  Invited by: Charlie       │  │
│  │  6 members                 │  │
│  │  [Accept]  [Decline]       │  │
│  └────────────────────────────┘  │
│                                  │
│  No more invitations.            │
└──────────────────────────────────┘
```

- Accept: calls POST /api/groups/:id/accept, removes the invitation from the list, shows a brief confirmation ("Joined Sunday crew")
- Decline: calls POST /api/groups/:id/decline, removes the invitation from the list

---

## Step 4: Group management screen

In Settings, add a "My Groups" section. This is where users manage groups they belong to and where admins manage groups they created.

### Groups list view

- Show all groups where the logged-in user is a MEMBER
- Each row: group name, member count, "Admin" badge if the user is the creator
- "Create Group" button at the top
- Tap a group row to open the group detail view

### Create Group flow

1. Screen or modal with:
   - Text field: "Group name" (required, max 30 characters)
   - "Create" button
2. On success: the logged-in user is automatically added as a MEMBER and is the admin. Navigate to the new group's detail view so they can immediately invite people.

Note: member selection happens AFTER creation, via the invite/add flow in the detail view. Do not combine creation and member selection into one step; it is simpler to create first, then manage members.

### Group detail view (admin perspective)

```
┌──────────────────────────────────┐
│  ← Back          Sunday crew     │
│                                  │
│  Members (4)                     │
│  ┌────────────────────────────┐  │
│  │  Alice (Admin)             │  │
│  │  Bob                       │  │
│  │  Charlie          [✕]     │  │
│  │  Dave (Guest)     [✕]     │  │
│  └────────────────────────────┘  │
│                                  │
│  Pending invitations (1)         │
│  ┌────────────────────────────┐  │
│  │  Eve (waiting)    [✕]     │  │
│  └────────────────────────────┘  │
│                                  │
│  [Invite Players]                │
│  [Add Guest Players]             │
│                                  │
│  [Rename Group]                  │
│  [Delete Group]                  │
└──────────────────────────────────┘
```

- Admin cannot remove themselves (they must delete the group to leave)
- [✕] removes a member or cancels a pending invitation
- "Invite Players" opens a player picker showing registered users not already in the group or invited. Multi-select, then confirm.
- "Add Guest Players" opens a player picker showing guest players not already in the group. Multi-select, then confirm. These are added as MEMBER immediately (no approval needed).
- "Rename Group" inline edit or modal. Admin only.
- "Delete Group" with confirm dialog: "Delete Sunday crew? This will remove all members. Games played in this group will keep their records but will no longer be linked to a group." Admin only.

### Group detail view (non-admin member perspective)

Same as above but without: [✕] buttons, Invite/Add buttons, Rename, Delete. Only action available is "Leave Group" at the bottom.

---

## Step 5: Game Setup integration

On the Game Setup screen (accessed via "Start Match"), add a group filter above the player list.

### Filter chips

- Horizontal row of tappable chips: **"All" | "Sunday crew" | "Work league" | ...**
- Only show groups where the logged-in user is a MEMBER
- "All" is selected by default, showing every player (current behaviour)
- Tapping a group name filters the player list to show only members of that group (status = MEMBER only, not INVITED)
- If no groups exist, do not show the filter row at all
- The filter resets to "All" every time Game Setup is opened

### Linking games to groups

When the user starts a match with a group filter active (i.e. any chip other than "All" is selected), store that group's ID on the Game record (`Game.groupId`).

If the filter is on "All" (or no groups exist), `Game.groupId` is null.

This linking is automatic and silent. Do not ask the user to confirm which group the game belongs to. The active filter determines it.

Note: the user can still add players outside the filtered group (by switching to "All" temporarily). The game is still tagged with the group that was active when "Start Match" was tapped. If the user switches the filter during setup and then starts the match, use whatever filter is active at the moment they tap "Start Match". If "All" is active at that moment, groupId is null.

### Quick Add interaction

"Quick Add" (creating a guest player) should still work when a group filter is active. The new guest appears in the player list but is NOT automatically added to the active group. The admin can add them to the group separately via the group management screen.

---

## Step 6: Stats filtered by group

Modify the existing stats screens to support group filtering.

### Leaderboard

- Add a group filter dropdown or chip row at the top of the Leaderboard screen
- Options: "All Games" | [list of groups the user is a MEMBER of]
- "All Games" shows the existing leaderboard (all games, no group filter)
- Selecting a group filters to games where Game.groupId matches that group
- The leaderboard ranking, win rates, and game counts all recalculate based on the filtered set

### Player Stats (My Stats)

- Add the same group filter
- When a group is selected, all stats (win rate, accuracy, average points per round, streaks, etc.) reflect only games played within that group

### Head-to-Head

- Add the same group filter
- When a group is selected, H2H records reflect only games played within that group

### Heatmap

- Add the same group filter
- When a group is selected, heatmap data includes only throws from games within that group

For all stats screens: if a group filter is active, show a subtle label like "Filtered: Sunday crew" so the user knows they are not looking at their global stats.

---

## Step 7: Verify and test

Complete these checks after all steps are done:

**Group creation and invitations:**
1. Create a group "Test crew". Confirm the creator is automatically a member and admin.
2. Invite a registered user. Confirm they see a pending invitation on their dashboard and in the invitations screen.
3. Accept the invitation as the invited user. Confirm they now appear as a member and the invitation badge clears.
4. Decline a different invitation. Confirm it disappears and the user is not added.
5. Add a guest player to the group. Confirm they appear as a member immediately (no invitation flow).

**Group management:**
6. As admin, remove a member. Confirm they disappear from the group but still exist as a player.
7. As a non-admin member, leave the group. Confirm you no longer see it in your groups list or in the game setup filter.
8. As admin, rename the group. Confirm the new name appears everywhere.
9. As admin, delete the group. Confirm it disappears from all members' groups lists and game setup filters. Confirm games previously linked to the group still exist (groupId set to null).

**Game setup integration:**
10. Start a match with a group filter active. Confirm the created game has groupId set to that group.
11. Start a match with "All" filter active. Confirm groupId is null.
12. Switch filters during setup and verify the groupId matches the filter active at the moment "Start Match" is tapped.

**Stats filtering:**
13. Play two games: one with group filter active, one without. Go to Leaderboard, filter by the group. Confirm only the group game's results appear.
14. Check Player Stats with group filter. Confirm stats reflect only group games.
15. Check Head-to-Head with group filter. Confirm it reflects only group games.

**Edge cases:**
16. Delete a player who is in a group. Confirm they are removed from the group (cascade) and the group still functions.
17. Delete a group that has linked games. Confirm games remain but groupId is null.
18. A user with zero groups: confirm no filter chips appear in game setup, and stats screens show no group filter options (or show the dropdown but it only has "All Games").

---

## General reminders

- UK English in all user-facing text
- No em dashes anywhere
- Do not modify `SplashArt.jsx`
- Follow the v4 spec for anything not explicitly changed above
