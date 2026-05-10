const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../lib/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const memberships = await prisma.groupMember.findMany({
    where: { playerId: req.player.id, status: 'INVITED' },
    include: {
      group: {
        include: {
          creator: true,
          _count: { select: { members: { where: { status: 'MEMBER' } } } },
        },
      },
    },
    orderBy: { addedAt: 'desc' },
  });
  const invitations = memberships.map((m) => ({
    groupId: m.group.id,
    groupName: m.group.name,
    invitedBy: m.group.creator?.username || 'Unknown',
    memberCount: m.group._count?.members ?? 0,
    invitedAt: m.addedAt,
  }));
  res.json({ invitations });
});

module.exports = router;
