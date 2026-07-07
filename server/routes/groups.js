const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { authenticate } = require('../lib/auth');

const router = express.Router();

async function requireGroupAdmin(req, res) {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  if (group.createdBy !== req.player.id) {
    res.status(403).json({ error: 'Admin only' });
    return null;
  }
  return group;
}

function publicLink(link) {
  return {
    id: link.id,
    token: link.token,
    expiresAt: link.expiresAt,
    maxUses: link.maxUses,
    useCount: link.useCount,
    createdAt: link.createdAt,
  };
}

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

router.post('/:id/invite-username', authenticate, async (req, res) => {
  const group = await requireGroupAdmin(req, res);
  if (!group) return;
  const username = (req.body?.username || '').trim();
  if (!username) return res.status(400).json({ error: 'Username required' });

  const target = await prisma.player.findUnique({ where: { username } });
  if (!target || target.isGuest || !target.pinHash) {
    return res.status(404).json({ error: 'No registered user with that exact name' });
  }
  if (target.id === req.player.id) {
    return res.status(400).json({ error: 'You are already in the group' });
  }
  const existing = await getMembership(group.id, target.id);
  if (existing) {
    return res.status(409).json({
      error: existing.status === 'MEMBER' ? 'Already a member' : 'Already invited',
    });
  }
  await prisma.groupMember.create({
    data: { groupId: group.id, playerId: target.id, status: 'INVITED' },
  });
  res.json({ invited: 1, username: target.username });
});

router.post('/:id/links', authenticate, async (req, res) => {
  const group = await requireGroupAdmin(req, res);
  if (!group) return;
  const days = Math.min(90, Math.max(1, Number(req.body?.expiresInDays) || 7));
  let maxUses = null;
  if (req.body?.maxUses != null && req.body.maxUses !== '') {
    maxUses = Math.min(500, Math.max(1, Number(req.body.maxUses) || 1));
  }
  const link = await prisma.groupInvite.create({
    data: {
      token: crypto.randomBytes(18).toString('base64url'),
      groupId: group.id,
      createdBy: req.player.id,
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      maxUses,
    },
  });
  res.json({ link: publicLink(link) });
});

router.get('/:id/links', authenticate, async (req, res) => {
  const group = await requireGroupAdmin(req, res);
  if (!group) return;
  const links = await prisma.groupInvite.findMany({
    where: {
      groupId: group.id,
      revoked: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
  const usable = links.filter((l) => l.maxUses == null || l.useCount < l.maxUses);
  res.json({ links: usable.map(publicLink) });
});

router.delete('/:id/links/:linkId', authenticate, async (req, res) => {
  const group = await requireGroupAdmin(req, res);
  if (!group) return;
  const link = await prisma.groupInvite.findUnique({ where: { id: req.params.linkId } });
  if (!link || link.groupId !== group.id) return res.status(404).json({ error: 'Not found' });
  await prisma.groupInvite.update({ where: { id: link.id }, data: { revoked: true } });
  res.json({ ok: true });
});

router.post('/:id/transfer-admin', authenticate, async (req, res) => {
  const group = await requireGroupAdmin(req, res);
  if (!group) return;
  const { playerId } = req.body || {};
  if (!playerId) return res.status(400).json({ error: 'playerId required' });
  if (playerId === req.player.id) {
    return res.status(400).json({ error: 'You are already the admin' });
  }
  const membership = await getMembership(group.id, playerId);
  if (!membership || membership.status !== 'MEMBER') {
    return res.status(400).json({ error: 'New admin must be a member of the group' });
  }
  const target = await prisma.player.findUnique({ where: { id: playerId } });
  if (!target || target.isGuest || !target.pinHash) {
    return res.status(400).json({ error: 'New admin must be a registered user' });
  }
  await prisma.group.update({ where: { id: group.id }, data: { createdBy: playerId } });
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
