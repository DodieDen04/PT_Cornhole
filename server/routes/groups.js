const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../lib/auth');

const router = express.Router();

function publicMember(gm) {
  return {
    id: gm.id,
    playerId: gm.playerId,
    status: gm.status,
    addedAt: gm.addedAt,
    player: gm.player
      ? {
          id: gm.player.id,
          username: gm.player.username,
          isGuest: gm.player.isGuest || false,
        }
      : undefined,
  };
}

function publicGroup(group) {
  if (!group) return null;
  return {
    id: group.id,
    name: group.name,
    createdBy: group.createdBy,
    createdAt: group.createdAt,
    members: group.members ? group.members.map(publicMember) : undefined,
    memberCount:
      group._count?.members ??
      (group.members ? group.members.filter((m) => m.status === 'MEMBER').length : undefined),
  };
}

async function getMembership(groupId, playerId) {
  return prisma.groupMember.findUnique({
    where: { groupId_playerId: { groupId, playerId } },
  });
}

async function loadGroup(id) {
  return prisma.group.findUnique({
    where: { id },
    include: {
      members: {
        include: { player: true },
        orderBy: [{ status: 'asc' }, { addedAt: 'asc' }],
      },
    },
  });
}

router.post('/', authenticate, async (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Group name required' });
  }
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 30) {
    return res.status(400).json({ error: 'Group name must be 1 to 30 characters' });
  }
  const existing = await prisma.group.findUnique({ where: { name: trimmed } });
  if (existing) return res.status(409).json({ error: 'Name already taken' });

  const group = await prisma.group.create({
    data: {
      name: trimmed,
      createdBy: req.player.id,
      members: {
        create: [{ playerId: req.player.id, status: 'MEMBER' }],
      },
    },
    include: { members: { include: { player: true } } },
  });
  res.json({ group: publicGroup(group) });
});

router.get('/', authenticate, async (req, res) => {
  const memberships = await prisma.groupMember.findMany({
    where: { playerId: req.player.id, status: 'MEMBER' },
    include: {
      group: {
        include: { _count: { select: { members: { where: { status: 'MEMBER' } } } } },
      },
    },
    orderBy: { group: { name: 'asc' } },
  });
  const groups = memberships.map((m) => ({
    ...publicGroup(m.group),
    isAdmin: m.group.createdBy === req.player.id,
  }));
  res.json({ groups });
});

router.get('/:id', authenticate, async (req, res) => {
  const group = await loadGroup(req.params.id);
  if (!group) return res.status(404).json({ error: 'Not found' });
  const me = group.members.find((m) => m.playerId === req.player.id);
  if (!me || me.status !== 'MEMBER') {
    return res.status(403).json({ error: 'Not a member' });
  }
  const out = publicGroup(group);
  out.isAdmin = group.createdBy === req.player.id;
  res.json({ group: out });
});

router.put('/:id', authenticate, async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: 'Not found' });
  if (group.createdBy !== req.player.id) {
    return res.status(403).json({ error: 'Admin only' });
  }
  const { name } = req.body || {};
  const trimmed = (name || '').trim();
  if (trimmed.length < 1 || trimmed.length > 30) {
    return res.status(400).json({ error: 'Group name must be 1 to 30 characters' });
  }
  const clash = await prisma.group.findFirst({
    where: { name: trimmed, NOT: { id: group.id } },
  });
  if (clash) return res.status(409).json({ error: 'Name already taken' });
  const updated = await prisma.group.update({
    where: { id: group.id },
    data: { name: trimmed },
  });
  res.json({ group: publicGroup(updated) });
});

router.delete('/:id', authenticate, async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: 'Not found' });
  if (group.createdBy !== req.player.id) {
    return res.status(403).json({ error: 'Admin only' });
  }
  await prisma.group.delete({ where: { id: group.id } });
  res.json({ ok: true });
});

router.post('/:id/invite', authenticate, async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: 'Not found' });
  if (group.createdBy !== req.player.id) {
    return res.status(403).json({ error: 'Admin only' });
  }
  const { playerIds } = req.body || {};
  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    return res.status(400).json({ error: 'playerIds required' });
  }
  const candidates = await prisma.player.findMany({
    where: { id: { in: playerIds }, isGuest: false },
  });
  const existing = await prisma.groupMember.findMany({
    where: { groupId: group.id, playerId: { in: candidates.map((p) => p.id) } },
  });
  const skip = new Set(existing.map((m) => m.playerId));
  const toCreate = candidates
    .filter((p) => !skip.has(p.id) && p.id !== req.player.id)
    .map((p) => ({ groupId: group.id, playerId: p.id, status: 'INVITED' }));
  if (toCreate.length > 0) {
    await prisma.groupMember.createMany({ data: toCreate });
  }
  res.json({ invited: toCreate.length });
});

router.post('/:id/add-guests', authenticate, async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: 'Not found' });
  if (group.createdBy !== req.player.id) {
    return res.status(403).json({ error: 'Admin only' });
  }
  const { playerIds } = req.body || {};
  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    return res.status(400).json({ error: 'playerIds required' });
  }
  const candidates = await prisma.player.findMany({
    where: { id: { in: playerIds }, isGuest: true },
  });
  const existing = await prisma.groupMember.findMany({
    where: { groupId: group.id, playerId: { in: candidates.map((p) => p.id) } },
  });
  const skip = new Set(existing.map((m) => m.playerId));
  const toCreate = candidates
    .filter((p) => !skip.has(p.id))
    .map((p) => ({ groupId: group.id, playerId: p.id, status: 'MEMBER' }));
  if (toCreate.length > 0) {
    await prisma.groupMember.createMany({ data: toCreate });
  }
  res.json({ added: toCreate.length });
});

router.post('/:id/accept', authenticate, async (req, res) => {
  const membership = await getMembership(req.params.id, req.player.id);
  if (!membership || membership.status !== 'INVITED') {
    return res.status(404).json({ error: 'No pending invitation' });
  }
  await prisma.groupMember.update({
    where: { id: membership.id },
    data: { status: 'MEMBER' },
  });
  res.json({ ok: true });
});

router.post('/:id/decline', authenticate, async (req, res) => {
  const membership = await getMembership(req.params.id, req.player.id);
  if (!membership || membership.status !== 'INVITED') {
    return res.status(404).json({ error: 'No pending invitation' });
  }
  await prisma.groupMember.delete({ where: { id: membership.id } });
  res.json({ ok: true });
});

router.post('/:id/leave', authenticate, async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: 'Not found' });
  if (group.createdBy === req.player.id) {
    return res.status(400).json({ error: 'Admin cannot leave; delete the group instead' });
  }
  const membership = await getMembership(group.id, req.player.id);
  if (!membership) return res.status(404).json({ error: 'Not a member' });
  await prisma.groupMember.delete({ where: { id: membership.id } });
  res.json({ ok: true });
});

router.delete('/:id/members/:playerId', authenticate, async (req, res) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: 'Not found' });
  if (group.createdBy !== req.player.id) {
    return res.status(403).json({ error: 'Admin only' });
  }
  if (req.params.playerId === group.createdBy) {
    return res.status(400).json({ error: 'Cannot remove the admin' });
  }
  const membership = await getMembership(group.id, req.params.playerId);
  if (!membership) return res.status(404).json({ error: 'Not a member' });
  await prisma.groupMember.delete({ where: { id: membership.id } });
  res.json({ ok: true });
});

module.exports = router;
