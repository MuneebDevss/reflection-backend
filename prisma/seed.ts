import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create a test user
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
    },
  });

  console.log('Created user:', user);

  // Create some sample goals
  const goals = await Promise.all([
    prisma.goal.create({
      data: {
        userId: user.id,
        title: 'Learn to meditate daily',
        deadline: new Date('2024-12-31'),
        progress: 45,
      },
    }),
    prisma.goal.create({
      data: {
        userId: user.id,
        title: 'Read 24 books this year',
        deadline: new Date('2024-12-31'),
        progress: 25,
      },
    }),
    prisma.goal.create({
      data: {
        userId: user.id,
        title: 'Run a half marathon',
        deadline: new Date('2024-09-15'),
        progress: 60,
      },
    }),
  ]);

  console.log('Created goals:', goals.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
