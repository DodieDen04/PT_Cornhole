const prisma = require('./prisma');

async function recalcRound(roundId) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      bagThrows: true,
      game: { include: { players: true } },
    },
  });
  if (!round) return null;

  const teamByPlayer = {};
  for (const gp of round.game.players) {
    teamByPlayer[gp.playerId] = gp.team;
  }

  let t1 = 0;
  let t2 = 0;
  for (const t of round.bagThrows) {
    const team = teamByPlayer[t.playerId];
    if (team === 1) t1 += t.points;
    else if (team === 2) t2 += t.points;
  }

  const netPoints = Math.abs(t1 - t2);
  let scoringTeam = null;
  if (t1 > t2) scoringTeam = 1;
  else if (t2 > t1) scoringTeam = 2;

  return prisma.round.update({
    where: { id: roundId },
    data: {
      team1RoundScore: t1,
      team2RoundScore: t2,
      netPoints,
      scoringTeam,
    },
  });
}

async function getGameTotals(gameId) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { rounds: { orderBy: { roundNumber: 'desc' } } },
  });
  if (!game) return { team1Score: 0, team2Score: 0, activeRoundId: null };

  const activeRoundId =
    game.status === 'IN_PROGRESS' && game.rounds.length > 0 ? game.rounds[0].id : null;

  let t1 = 0;
  let t2 = 0;
  for (const r of game.rounds) {
    if (r.id === activeRoundId) continue;
    if (r.scoringTeam === 1) t1 += r.netPoints;
    else if (r.scoringTeam === 2) t2 += r.netPoints;
  }
  return { team1Score: t1, team2Score: t2, activeRoundId };
}

module.exports = { recalcRound, getGameTotals };
