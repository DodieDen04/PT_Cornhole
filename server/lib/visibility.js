const prisma = require('./prisma');

// Phase F rule: two players can see each other only if they share a group
// (both MEMBER), or one created the other (guests).
async function visiblePlayerIdSet(playerId) {
  const ids = new Set([playerId]);

  const memberships = await prisma.groupMember.findMany({
    where: { playerId, status: 'MEMBER' },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);
  if (groupIds.length > 0) {
    const fellows = await prisma.groupMember.findMany({
      where: { groupId: { in: groupIds }, status: 'MEMBER' },
      select: { playerId: true },
    });
    for (const f of fellows) ids.add(f.playerId);
  }

  const created = await prisma.player.findMany({
    where: { createdById: playerId },
    select: { id: true },
  });
  for (const c of created) ids.add(c.id);

  return ids;
}

async function canSeePlayer(viewerId, targetId) {
  if (viewerId === targetId) return true;
  const visible = await visiblePlayerIdSet(viewerId);
  return visible.has(targetId);
}

module.exports = { visiblePlayerIdSet, canSeePlayer };
