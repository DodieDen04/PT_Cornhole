const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../lib/auth');
const { getGameTotals } = require('../lib/scoring');
const { visiblePlayerIdSet } = require('../lib/visibility');

const router = express.Router();

const VALID_COLOURS = ['YELLOW', 'RED', 'BLUE', 'GREEN', 'BLACK'];

const ABANDONED_PRACTICE_AGE_MS = 24 * 60 * 60 * 1000;
const CLEANUP_DEBOUNCE_MS = 5 * 60 * 1000;
let lastCleanupAt = 0;

async function cleanupAbandonedPractices() {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_DEBOUNCE_MS) return;
  lastCleanupAt = now;
  await prisma.game.deleteMany({
    where: {
      mode: 'PRACTICE',
      status: 'IN_PROGRESS',
      updatedAt: { lt: new Date(now - ABANDONED_PRACTICE_AGE_MS) },
    },
  });
}

function isTwoVsTwo(gamePlayers) {
  return gamePlayers.length === 4;
}

function nextThrowingPair(prevPair, gamePlayers) {
  if (!isTwoVsTwo(gamePlayers)) return 1;
  return prevPair === 1 ? 2 : 1;
}

function nextStartingTeam(prevRound) {
  if (!prevRound) return 1;
  return prevRound.scoringTeam || prevRound.startingTeam;
}

async function loadGameDetail(gameId) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: { include: { player: true } },
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: { bagThrows: { orderBy: { throwOrder: 'asc' } } },
      },
      practiceSets: {
        orderBy: { setNumber: 'asc' },
        include: { bagThrows: { orderBy: { throwOrder: 'asc' } }, player: true },
      },
      result: true,
    },
  });
  if (!game) return null;
  const totals = await getGameTotals(gameId);
  return { ...game, ...totals };
}

async function validateGroupId(groupId, playerId) {
  if (!groupId) return { ok: true, groupId: null };
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_playerId: { groupId, playerId } },
  });
  if (!membership || membership.status !== 'MEMBER') {
    return { ok: false, error: 'Not a member of that group' };
  }
  return { ok: true, groupId };
}

router.post('/', authenticate, async (req, res) => {
  const body = req.body || {};
  const { mode } = body;

  const groupCheck = await validateGroupId(body.groupId, req.player.id);
  if (!groupCheck.ok) return res.status(400).json({ error: groupCheck.error });

  if (Array.isArray(body.players)) {
    const visible = await visiblePlayerIdSet(req.player.id);
    for (const p of body.players) {
      if (!visible.has(p.playerId)) {
        return res.status(400).json({ error: 'You can only add players from your groups' });
      }
    }
  }

  if (mode === 'COMPETITIVE') {
    const { players, team1Colour, team2Colour, targetScore } = body;
    if (!Array.isArray(players) || (players.length !== 2 && players.length !== 4)) {
      return res.status(400).json({ error: 'Need 2 or 4 players' });
    }
    if (!VALID_COLOURS.includes(team1Colour) || !VALID_COLOURS.includes(team2Colour)) {
      return res.status(400).json({ error: 'Invalid team colour' });
    }
    if (team1Colour === team2Colour) {
      return res.status(400).json({ error: 'Teams must have different colours' });
    }
    const target = Number(targetScore) || 21;
    if (target < 5 || target > 99) return res.status(400).json({ error: 'Invalid target score' });
    const startingTeam = body.startingTeam === 2 ? 2 : 1;

    const is2v2 = players.length === 4;
    const t1 = players.filter((p) => p.team === 1);
    const t2 = players.filter((p) => p.team === 2);
    if (t1.length !== t2.length) {
      return res.status(400).json({ error: 'Teams must be the same size' });
    }
    if (is2v2) {
      for (const team of [t1, t2]) {
        const positions = team.map((p) => p.position).sort();
        if (positions[0] !== 1 || positions[1] !== 2) {
          return res.status(400).json({ error: 'In 2v2, each team needs one position 1 and one position 2 player' });
        }
      }
    }

    const game = await prisma.game.create({
      data: {
        mode: 'COMPETITIVE',
        status: 'IN_PROGRESS',
        targetScore: target,
        team1Colour,
        team2Colour,
        startingTeam,
        groupId: groupCheck.groupId,
        createdById: req.player.id,
        players: {
          create: players.map((p) => ({
            playerId: p.playerId,
            team: p.team,
            position: is2v2 ? p.position : 1,
          })),
        },
        rounds: {
          create: [{ roundNumber: 1, startingTeam, throwingPair: 1 }],
        },
      },
    });
    const detail = await loadGameDetail(game.id);
    return res.json({ game: detail });
  }

  if (mode === 'PRACTICE') {
    const { players, practiceThrowsPerSet, tag } = body;
    if (!Array.isArray(players) || players.length < 1 || players.length > 2) {
      return res.status(400).json({ error: 'Practice needs 1 or 2 players' });
    }
    const throwsPerSet = Number(practiceThrowsPerSet) || 4;
    if (throwsPerSet !== 4 && throwsPerSet !== 8) {
      return res.status(400).json({ error: 'Throws per set must be 4 or 8' });
    }
    for (const p of players) {
      if (!VALID_COLOURS.includes(p.bagColour)) {
        return res.status(400).json({ error: 'Each practice player needs a bag colour' });
      }
    }
    if (players.length === 2 && players[0].bagColour === players[1].bagColour) {
      return res.status(400).json({ error: 'Practice partners must use different colours' });
    }

    const game = await prisma.game.create({
      data: {
        mode: 'PRACTICE',
        status: 'IN_PROGRESS',
        groupId: groupCheck.groupId,
        createdById: req.player.id,
        practiceThrowsPerSet: throwsPerSet,
        practiceTag: tag || null,
        players: {
          create: players.map((p) => ({
            playerId: p.playerId,
            bagColour: p.bagColour,
          })),
        },
      },
    });
    const detail = await loadGameDetail(game.id);
    return res.json({ game: detail });
  }

  return res.status(400).json({ error: 'Invalid mode' });
});

router.get('/', authenticate, async (req, res) => {
  await cleanupAbandonedPractices().catch(() => {});
  const { status, mode } = req.query;
  const where = {
    OR: [
      { players: { some: { playerId: req.player.id } } },
      { createdById: req.player.id },
    ],
  };
  if (status) where.status = status;
  if (mode) where.mode = mode;
  const games = await prisma.game.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      players: { include: { player: true } },
      result: true,
    },
    take: 100,
  });
  res.json({ games });
});

router.get('/in-progress', authenticate, async (req, res) => {
  const game = await prisma.game.findFirst({
    where: {
      status: 'IN_PROGRESS',
      OR: [
        { players: { some: { playerId: req.player.id } } },
        { createdById: req.player.id },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!game) return res.json({ game: null });
  const detail = await loadGameDetail(game.id);
  res.json({ game: detail });
});

router.get('/:id', authenticate, async (req, res) => {
  const detail = await loadGameDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: 'Not found' });
  res.json({ game: detail });
});

router.put('/:id/status', authenticate, async (req, res) => {
  const { status } = req.body || {};
  if (!['COMPLETED', 'ABANDONED', 'IN_PROGRESS'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const data = { status };
  if (status === 'COMPLETED' || status === 'ABANDONED') {
    data.completedAt = new Date();
  }
  await prisma.game.update({ where: { id: req.params.id }, data });
  const detail = await loadGameDetail(req.params.id);
  res.json({ game: detail });
});

module.exports = router;
