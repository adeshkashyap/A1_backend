const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const coupon = await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      discount: 10,
      type: 'percentage',
      usageLimit: 100,
    },
  });
  console.log('Seed successful:', coupon);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
