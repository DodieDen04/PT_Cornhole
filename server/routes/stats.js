const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../lib/auth');
const { canSeePlayer } = require('../lib/visibility');

const router = express.Router();

function pct(n, total) {
  if (!total) return 0;
  return Math.round((n / total) * 1000) / 10;
}

async function loadPlayerCompetitiveGames(playerId, groupId) {
  return prisma.game.findMany({
    where: {
      mode: 'COMPETITIVE',
      status: 'COMPLETED',
      players: { some: { playerId } },
      ...(groupId ? { groupId } : {}),
    },
    orderBy: { completedAt: 'desc' },
    include: {
      players: true,
      result: true,
      rounds: { include: { bagThrows: true } },
    },
  });
}

router.get('/player/:id', authenticate, async (req, res) => {
  const playerId = req.params.id;
  const groupId = req.query.groupId || null;
  if (!(await canSeePlayer(req.player.id, playerId))) {
    return res.status(403).json({ error: 'You do not share a group with this player' });
  }
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return res.status(404).json({ error: 'Player not found' });

  const competitiveGames = await loadPlayerCompetitiveGames(playerId, groupId);

  let won = 0;
  let lost = 0;
  let totalCompetitiveThrows = 0;
  let cornholes = 0;
  let boards = 0;
  let offs = 0;
  let totalRoundPoints = 0;
  let totalRoundsWithThrows = 0;
  const streakHistory = [];

  for (const g of competitiveGames) {
    const myGp = g.players.find((gp) => gp.playerId === playerId);
    if (!myGp) continue;
    const myTeam = myGp.team;
    const winningTeam = g.result?.winningTeam;
    if (winningTeam) {
      const isWin = winningTeam === myTeam;
      if (isWin) won += 1;
      else lost += 1;
      streakHistory.push(isWin ? 'W' : 'L');
    }
    for (const r of g.rounds) {
      let didThrow = false;
      for (const t of r.bagThrows) {
        if (t.playerId !== playerId) continue;
        didThrow = true;
        totalCompetitiveThrows += 1;
        if (t.result === 'CORNHOLE') cornholes += 1;
        else if (t.result === 'BOARD') boards += 1;
        else offs += 1;
        totalRoundPoints += t.points;
      }
      if (didThrow) totalRoundsWithThrows += 1;
    }
  }

  let currentStreak = 0;
  let currentStreakType = null;
  for (const r of streakHistory) {
    if (currentStreakType == null) {
      currentStreakType = r;
      currentStreak = 1;
    } else if (r === currentStreakType) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  const practiceThrows = await prisma.bagThrow.findMany({
    where: { playerId, practiceSetId: { not: null } },
    select: { result: true },
  });
  const practiceSets = await prisma.practiceSet.count({ where: { playerId } });

  let pCornholes = 0;
  let pBoards = 0;
  let pOffs = 0;
  for (const t of practiceThrows) {
    if (t.result === 'CORNHOLE') pCornholes += 1;
    else if (t.result === 'BOARD') pBoards += 1;
    else pOffs += 1;
  }

  const compTotal = totalCompetitiveThrows;
  const competitive = {
    gamesPlayed: won + lost,
    won,
    lost,
    winPct: pct(won, won + lost),
    currentStreak,
    currentStreakType,
    totalThrows: compTotal,
    cornholes,
    boards,
    offs,
    cornholePct: pct(cornholes, compTotal),
    boardPct: pct(boards, compTotal),
    offPct: pct(offs, compTotal),
    avgPointsPerRound:
      totalRoundsWithThrows > 0
        ? Math.round((totalRoundPoints / totalRoundsWithThrows) * 10) / 10
        : 0,
  };

  const pTotal = practiceThrows.length;
  const practice = {
    totalSets: practiceSets,
    totalThrows: pTotal,
    cornholes: pCornholes,
    boards: pBoards,
    offs: pOffs,
    cornholePct: pct(pCornholes, pTotal),
    boardPct: pct(pBoards, pTotal),
    offPct: pct(pOffs, pTotal),
  };

  const trend = [];
  for (const g of competitiveGames) {
    const myGp = g.players.find((gp) => gp.playerId === playerId);
    let throws = 0;
    let gCornholes = 0;
    let gBoards = 0;
    let gOffs = 0;
    for (const r of g.rounds) {
      for (const t of r.bagThrows) {
        if (t.playerId !== playerId) continue;
        throws += 1;
        if (t.result === 'CORNHOLE') gCornholes += 1;
        else if (t.result === 'BOARD') gBoards += 1;
        else gOffs += 1;
      }
    }
    if (throws === 0) continue;
    const winningTeam = g.result?.winningTeam;
    trend.push({
      mode: 'COMPETITIVE',
      completedAt: g.completedAt,
      throws,
      cornholes: gCornholes,
      boards: gBoards,
      offs: gOffs,
      won: winningTeam && myGp ? winningTeam === myGp.team : null,
    });
  }
  const practiceSessions = await prisma.game.findMany({
    where: {
      mode: 'PRACTICE',
      status: 'COMPLETED',
      players: { some: { playerId } },
      ...(groupId ? { groupId } : {}),
    },
    orderBy: { completedAt: 'desc' },
    include: { practiceSets: { where: { playerId }, include: { bagThrows: true } } },
    take: 200,
  });
  for (const g of practiceSessions) {
    let throws = 0;
    let gCornholes = 0;
    let gBoards = 0;
    let gOffs = 0;
    for (const s of g.practiceSets) {
      for (const t of s.bagThrows) {
        throws += 1;
        if (t.result === 'CORNHOLE') gCornholes += 1;
        else if (t.result === 'BOARD') gBoards += 1;
        else gOffs += 1;
      }
    }
    if (throws === 0) continue;
    trend.push({
      mode: 'PRACTICE',
      completedAt: g.completedAt,
      throws,
      cornholes: gCornholes,
      boards: gBoards,
      offs: gOffs,
      won: null,
    });
  }
  trend.sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));

  res.json({
    stats: {
      player: { id: player.id, username: player.username },
      competitive,
      practice,
      trend,
    },
  });
});

router.get('/heatmap', authenticate, async (req, res) => {
  const { playerId, mode, dateFrom, dateTo, result, groupId, format } = req.query;
  if (!playerId) return res.status(400).json({ error: 'playerId required' });
  if (!(await canSeePlayer(req.player.id, playerId))) {
    return res.status(403).json({ error: 'You do not share a group with this player' });
  }

  const where = { playerId };
  if (result && ['CORNHOLE', 'BOARD', 'OFF'].includes(result)) {
    where.result = result;
  }
  if (mode === 'COMPETITIVE') where.roundId = { not: null };
  else if (mode === 'PRACTICE') where.practiceSetId = { not: null };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }
  if (groupId) where.game = { groupId };
  if (format === '1v1' || format === '2v2') {
    const wantPlayers = format === '1v1' ? 2 : 4;
    const compGames = await prisma.game.findMany({
      where: { mode: 'COMPETITIVE', ...(groupId ? { groupId } : {}) },
      select: { id: true, _count: { select: { players: true } } },
    });
    where.gameId = {
      in: compGames.filter((g) => g._count.players === wantPlayers).map((g) => g.id),
    };
  }

  const throws = await prisma.bagThrow.findMany({
    where,
    select: { boardX: true, boardY: true, result: true, createdAt: true },
    take: 5000,
  });
  res.json({
    throws: throws.map((t) => ({ x: t.boardX, y: t.boardY, result: t.result })),
  });
});

router.get('/head-to-head', authenticate, async (req, res) => {
  const { player1Id, player2Id, groupId } = req.query;
  if (!player1Id || !player2Id) {
    return res.status(400).json({ error: 'player1Id and player2Id required' });
  }
  if (player1Id === player2Id) {
    return res.status(400).json({ error: 'Players must be different' });
  }
  if (
    !(await canSeePlayer(req.player.id, player1Id)) ||
    !(await canSeePlayer(req.player.id, player2Id))
  ) {
    return res.status(403).json({ error: 'You do not share a group with these players' });
  }

  const games = await prisma.game.findMany({
    where: {
      mode: 'COMPETITIVE',
      status: 'COMPLETED',
      AND: [
        { players: { some: { playerId: player1Id } } },
        { players: { some: { playerId: player2Id } } },
      ],
      ...(groupId ? { groupId } : {}),
    },
    include: { players: true, result: true },
  });

  let p1Wins = 0;
  let p2Wins = 0;
  let totalGames = 0;
  for (const g of games) {
    const p1 = g.players.find((p) => p.playerId === player1Id);
    const p2 = g.players.find((p) => p.playerId === player2Id);
    if (!p1 || !p2) continue;
    if (p1.team === p2.team) continue;
    const winning = g.result?.winningTeam;
    if (!winning) continue;
    totalGames += 1;
    if (winning === p1.team) p1Wins += 1;
    else if (winning === p2.team) p2Wins += 1;
  }
  res.json({ player1Id, player2Id, player1Wins: p1Wins, player2Wins: p2Wins, totalGames });
});

router.get('/leaderboard', authenticate, async (req, res) => {
  const minGames = Math.max(1, Number(req.query.minGames) || 1);
  const groupId = req.query.groupId || null;
  if (!groupId) return res.status(400).json({ error: 'groupId required' });
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_playerId: { groupId, playerId: req.player.id } },
  });
  if (!membership || membership.status !== 'MEMBER') {
    return res.status(403).json({ error: 'Not a member of that group' });
  }

  const games = await prisma.game.findMany({
    where: {
      mode: 'COMPETITIVE',
      status: 'COMPLETED',
      groupId,
    },
    include: {
      players: { include: { player: true } },
      result: true,
      rounds: { include: { bagThrows: true } },
    },
  });

  // Rows are built from the group's games, so only players who actually
  // appear in them are listed.
  const summary = {};
  function rowFor(gp) {
    if (!summary[gp.playerId]) {
      summary[gp.playerId] = {
        id: gp.playerId,
        username: gp.player?.username || 'Player',
        games: 0,
        wins: 0,
        points: 0,
        roundsThrown: 0,
        throws: 0,
        cornholes: 0,
        boards: 0,
        offs: 0,
      };
    }
    return summary[gp.playerId];
  }

  for (const g of games) {
    const winning = g.result?.winningTeam;
    if (!winning) continue;
    for (const gp of g.players) {
      const s = rowFor(gp);
      s.games += 1;
      if (gp.team === winning) s.wins += 1;
    }
    for (const r of g.rounds) {
      const threwThisRound = new Set();
      for (const t of r.bagThrows) {
        const s = summary[t.playerId];
        if (!s) continue;
        threwThisRound.add(t.playerId);
        s.throws += 1;
        s.points += t.points;
        if (t.result === 'CORNHOLE') s.cornholes += 1;
        else if (t.result === 'BOARD') s.boards += 1;
        else s.offs += 1;
      }
      for (const id of threwThisRound) summary[id].roundsThrown += 1;
    }
  }

  const leaderboard = Object.values(summary)
    .map((s) => ({
      id: s.id,
      username: s.username,
      games: s.games,
      wins: s.wins,
      losses: s.games - s.wins,
      winPct: pct(s.wins, s.games),
      lossPct: pct(s.games - s.wins, s.games),
      points: s.points,
      avgPointsPerRound:
        s.roundsThrown > 0 ? Math.round((s.points / s.roundsThrown) * 10) / 10 : 0,
      cornholes: s.cornholes,
      cornholePct: pct(s.cornholes, s.throws),
      boards: s.boards,
      boardPct: pct(s.boards, s.throws),
      accuracy: s.cornholes + s.boards,
      accuracyPct: pct(s.cornholes + s.boards, s.throws),
    }))
    .filter((s) => s.games >= minGames)
    .sort((a, b) => {
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      return b.wins - a.wins;
    });

  res.json({ leaderboard, minGames });
});

module.exports = router;
