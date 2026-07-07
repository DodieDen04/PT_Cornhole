const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../lib/auth');

const router = express.Router();

async function loadUsableLink(token) {
  const link = await prisma.groupInvite.findUnique({
    where: { token },
    include: {
      group: {
        include: { _count: { select: { members: { where: { status: 'MEMBER' } } } } },
      },
    },
  });
  if (!link) return { link: null, reason: 'unknown' };
  if (link.revoked) return { link, reason: 'revoked' };
  if (link.expiresAt < new Date()) return { link, reason: 'expired' };
  if (link.maxUses != null && link.useCount >= link.maxUses) return { link, reason: 'exhausted' };
  return { link, reason: null };
}

// Unauthenticated by design: someone opening an invite link has no account
// yet. Reveals only the group name and member count.
router.get('/:token', async (req, res) => {
  const { link, reason } = await loadUsableLink(req.params.token);
  if (reason) {
    return res.json({ valid: false, reason });
  }
  res.json({
    valid: true,
    group: {
      name: link.group.name,
      memberCount: link.group._count.members,
    },
  });
});

router.post('/:token/accept', authenticate, async (req, res) => {
  const { link, reason } = await loadUsableLink(req.params.token);
  if (reason) {
    return res.status(400).json({ error: 'This invite link is no longer valid', reason });
  }

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_playerId: { groupId: link.groupId, playerId: req.player.id } },
  });
  if (existing && existing.status === 'MEMBER') {
    return res.json({ ok: true, groupId: link.groupId, alreadyMember: true });
  }

  if (existing) {
    await prisma.groupMember.update({
      where: { id: existing.id },
      data: { status: 'MEMBER' },
    });
  } else {
    await prisma.groupMember.create({
      data: { groupId: link.groupId, playerId: req.player.id, status: 'MEMBER' },
    });
  }
  await prisma.groupInvite.update({
    where: { id: link.id },
    data: { useCount: { increment: 1 } },
  });
  res.json({ ok: true, groupId: link.groupId });
});

module.exports = router;
