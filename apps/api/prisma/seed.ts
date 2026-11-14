import { prisma } from '../src/config/prisma.js';
import { seedDatabase } from '../src/config/seed.js';

seedDatabase()
  .then(async () => {
    console.log('Seeded Sure PostgreSQL database successfully.');
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
