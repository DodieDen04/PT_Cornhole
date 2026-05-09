require('dotenv/config');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

async function main() {
  const usernames = ['Alice', 'Bob', 'Charlie', 'Dana'];
  const pinHash = await bcrypt.hash('1234', 10);

  for (let i = 0; i < usernames.length; i++) {
    const username = usernames[i];
    await prisma.player.upsert({
      where: { username },
      update: {},
      create: {
        username,
        pinHash,
        isAdmin: i === 0,
      },
    });
  }

  const all = await prisma.player.findMany({ orderBy: { createdAt: 'asc' } });
  console.log('Seeded players:');
  for (const p of all) {
    console.log(`  ${p.username}${p.isAdmin ? ' (admin)' : ''}`);
  }
  console.log("All test PINs are '1234'.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
