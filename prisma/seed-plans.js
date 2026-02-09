const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      planName: 'Free',
      price: 0,
      features: JSON.stringify(['7-Day Full Access', '1 WhatsApp Instance', 'Lead Management']),
    },
    {
      planName: 'Basic',
      price: 999,
      features: JSON.stringify(['100 Leads/mo', '1 WhatsApp Instance', '1 Team Member']),
    },
    {
      planName: 'Pro',
      price: 2999,
      features: JSON.stringify(['Unlimited Leads', '3 WhatsApp Instances', '5 Team Members', 'Lead Export']),
    },
  ];

  console.log('🌱 Seeding subscription plans...');

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.planName }, // Using planName as a pseudo-identifier for upsert in this script
      update: plan,
      create: {
        ...plan,
        id: undefined // Let prisma generate UUID
      },
    }).catch(async (e) => {
       // Since 'id' is @id, we can't use planName for 'where' if id is UUID.
       // Let's check by name instead.
       const existing = await prisma.subscriptionPlan.findFirst({
         where: { planName: plan.planName }
       });
       if (existing) {
         await prisma.subscriptionPlan.update({
           where: { id: existing.id },
           data: plan
         });
       } else {
         await prisma.subscriptionPlan.create({ data: plan });
       }
    });
  }

  console.log('✅ Subscription plans seeded!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
