require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
  const email = 'addyky100@gmail.com';
  const password = 'Addy8660179';
  const name = 'Adesh Kashyap';
  const phone = '+919717871621';

  console.log('🌱 Seeding dealer...');

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await prisma.$transaction(async (tx) => {
    const dealer = await tx.dealer.upsert({
      where: { email },
      update: {
        password: hashedPassword,
        name,
        phone,
      },
      create: {
        email,
        password: hashedPassword,
        name,
        phone,
        role: 'dealer',
      },
    });

    const profile = await tx.companyProfile.upsert({
      where: { dealerId: dealer.id },
      update: {},
      create: {
        dealerId: dealer.id,
        companyName: `${name}'s Agency`,
        phone: phone,
        email: email,
        address: '',
        botName: 'Property Assistant',
      },
    });

    return { dealer, profile };
  });

  console.log('✅ Dealer created/updated:', result.dealer.email);
  console.log('🎉 You can now log in with:');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
