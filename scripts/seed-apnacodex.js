require('dotenv').config({ path: '../.env' });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function seedApnaCodex() {
  console.log('🌱 Starting ApnaCodex database seeding...\n');

  try {
    // 1. Create Admin User
    console.log('👤 Creating Admin User...');
    
    const hashedPassword = await bcrypt.hash('Addy8660179', 10);
    const dealer = await prisma.dealer.upsert({
      where: { email: 'addyky100@gmail.com' },
      update: {
        password: hashedPassword,
        role: 'admin',
        verified: true,
        active: true
      },
      create: {
        email: 'addyky100@gmail.com',
        password: hashedPassword,
        name: 'Adesh Kashyap',
        role: 'admin',
        verified: true,
        active: true
      }
    });
    
    console.log(`✅ Dealer account created: ${dealer.email}`);

    // 1.1 Create Company Profile
    console.log('🏢 Creating Company Profile...');
    const companyProfile = await prisma.companyProfile.upsert({
      where: { dealerId: dealer.id },
      update: {},
      create: {
        dealerId: dealer.id,
        companyName: 'ApnaCodex Property Solutions',
        companyType: 'agency',
        phone: '+919876543200',
        email: 'info@apnacodex.com',
        address: 'Sector 44, Gurgaon',
        city: 'Gurgaon',
        state: 'Haryana',
        botName: 'ApnaCodex Assistant',
        botTone: 'professional'
      }
    });
    console.log('✅ Company profile created');

    // 2. Create Sales Reps
    console.log('\n👥 Creating Sales Reps...');
    
    const salesReps = await Promise.all([
      prisma.salesRep.upsert({
        where: { phone: '+919876543210' },
        update: {},
        create: {
          dealerId: dealer.id,
          name: 'Amit Sharma',
          phone: '+919876543210',
          email: 'amit@apnacodex.com',
          active: true,
          commission: 50000
        }
      }),
      prisma.salesRep.upsert({
        where: { phone: '+919876543211' },
        update: {},
        create: {
          dealerId: dealer.id,
          name: 'Priya Verma',
          phone: '+919876543211',
          email: 'priya@apnacodex.com',
          active: true,
          commission: 45000
        }
      }),
      prisma.salesRep.upsert({
        where: { phone: '+919876543212' },
        update: {},
        create: {
          dealerId: dealer.id,
          name: 'Rahul Gupta',
          phone: '+919876543212',
          email: 'rahul@apnacodex.com',
          active: true,
          commission: 60000
        }
      })
    ]);
    
    console.log(`✅ Created ${salesReps.length} sales reps`);

    // 3. Create Properties
    console.log('\n🏠 Creating Properties...');
    
    const propertyCount = await prisma.property.count();
    let properties = [];
    
    if (propertyCount === 0) {
      properties = await Promise.all([
      prisma.property.create({
        data: {
          title: '3BHK Luxury Apartment - Sector 49',
          bhk: 3,
          sqft: 1800,
          price: 8000000, // ₹80L
          location: 'Sector 49, Gurgaon',
          reraNo: 'HRERA-GGN-2024-001',
          amenities: JSON.stringify(['Gym', 'Swimming Pool', 'Parking', 'Lift', 'Security']),
          images: JSON.stringify(['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800']),
          possession: 'Dec 2026',
          available: true,
          category: '3BHK',
          description: 'Spacious 3BHK apartment with modern amenities in prime location',
          dealerId: dealer.id
        }
      }),
      prisma.property.create({
        data: {
          title: '2BHK Modern Flat - Sector 52',
          bhk: 2,
          sqft: 1200,
          price: 5500000, // ₹55L
          location: 'Sector 52, Gurgaon',
          reraNo: 'HRERA-GGN-2024-002',
          amenities: JSON.stringify(['Parking', 'Lift', 'Security', 'Power Backup']),
          images: JSON.stringify(['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800']),
          possession: 'Ready to Move',
          available: true,
          category: '2BHK',
          description: 'Affordable 2BHK flat near metro station',
          dealerId: dealer.id
        }
      }),
      prisma.property.create({
        data: {
          title: '4BHK Penthouse - Golf Course Road',
          bhk: 4,
          sqft: 3500,
          price: 15000000, // ₹1.5Cr
          location: 'Golf Course Road, Gurgaon',
          reraNo: 'HRERA-GGN-2024-003',
          amenities: JSON.stringify(['Private Pool', 'Gym', 'Clubhouse', 'Parking', 'Lift', 'Security', 'Garden']),
          images: JSON.stringify(['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800']),
          possession: 'Jun 2027',
          available: true,
          category: '4BHK',
          description: 'Ultra-luxury penthouse with panoramic views',
          dealerId: dealer.id
        }
      }),
      prisma.property.create({
        data: {
          title: '3BHK Villa - Sohna Road',
          bhk: 3,
          sqft: 2500,
          price: 12000000, // ₹1.2Cr
          location: 'Sohna Road, Gurgaon',
          reraNo: 'HRERA-GGN-2024-004',
          amenities: JSON.stringify(['Private Garden', 'Parking', 'Security', 'Power Backup']),
          images: JSON.stringify(['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800']),
          possession: 'Mar 2027',
          available: true,
          category: 'Villa',
          description: 'Independent villa with private garden',
          dealerId: dealer.id
        }
      }),
      prisma.property.create({
        data: {
          title: '2BHK Budget Apartment - Sector 70',
          bhk: 2,
          sqft: 950,
          price: 3500000, // ₹35L
          location: 'Sector 70, Gurgaon',
          reraNo: 'HRERA-GGN-2024-005',
          amenities: JSON.stringify(['Parking', 'Lift', 'Security']),
          images: JSON.stringify(['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800']),
          possession: 'Ready to Move',
          available: true,
          category: '2BHK',
          description: 'Budget-friendly apartment for first-time buyers',
          dealerId: dealer.id
        }
      })]);
      console.log(`✅ Created ${properties.length} properties`);
    } else {
      console.log(`ℹ️ Properties already exist (${propertyCount}), skipping creation`);
      properties = await prisma.property.findMany({ take: 5 });
    }

    // 4. Create Leads
    console.log('\n📋 Creating Leads...');
    
    const leadCount = await prisma.lead.count();
    let leads = [];
    
    if (leadCount === 0) {
      leads = await Promise.all([
      prisma.lead.create({
        data: {
          pdId: 'PD-1001',
          buyerName: 'Raj Malhotra',
          buyerPhone: '+919876000001',
          buyerEmail: 'raj@example.com',
          requirements: '3BHK in Sector 49, Budget ₹80L',
          budget: 8000000,
          status: 'NEW',
          location: 'Sector 49, Gurgaon',
          notes: JSON.stringify([]),
          assignedRepId: salesReps[0].id,
          source: 'WhatsApp',
          priority: 'HIGH',
          dealerId: dealer.id
        }
      }),
      prisma.lead.create({
        data: {
          pdId: 'PD-1002',
          buyerName: 'Sneha Kapoor',
          buyerPhone: '+919876000002',
          buyerEmail: 'sneha@example.com',
          requirements: '2BHK near metro, Budget ₹50L',
          budget: 5000000,
          status: 'QUALIFIED',
          location: 'Sector 52, Gurgaon',
          notes: JSON.stringify(['Interested in ready-to-move properties']),
          assignedRepId: salesReps[1].id,
          source: 'Website',
          priority: 'MEDIUM',
          dealerId: dealer.id
        }
      }),
      prisma.lead.create({
        data: {
          pdId: 'PD-1003',
          buyerName: 'Vikram Singh',
          buyerPhone: '+919876000003',
          buyerEmail: 'vikram@example.com',
          requirements: '4BHK Penthouse, Golf Course Road',
          budget: 15000000,
          status: 'VISIT',
          location: 'Golf Course Road, Gurgaon',
          notes: JSON.stringify(['Site visit scheduled for next week']),
          assignedRepId: salesReps[0].id,
          source: 'Referral',
          priority: 'HIGH',
          dealerId: dealer.id
        }
      }),
      prisma.lead.create({
        data: {
          pdId: 'PD-1004',
          buyerName: 'Anita Desai',
          buyerPhone: '+919876000004',
          buyerEmail: 'anita@example.com',
          requirements: '3BHK Villa with garden',
          budget: 12000000,
          status: 'CLOSED',
          location: 'Sohna Road, Gurgaon',
          notes: JSON.stringify(['Deal closed successfully']),
          assignedRepId: salesReps[2].id,
          source: 'WhatsApp',
          priority: 'HIGH',
          dealerId: dealer.id
        }
      }),
      prisma.lead.create({
        data: {
          pdId: 'PD-1005',
          buyerName: 'Rohit Sharma',
          buyerPhone: '+919876000005',
          buyerEmail: 'rohit@example.com',
          requirements: '2BHK budget friendly',
          budget: 3500000,
          status: 'NEW',
          location: 'Sector 70, Gurgaon',
          notes: JSON.stringify([]),
          assignedRepId: salesReps[1].id,
          source: 'WhatsApp',
          priority: 'LOW',
          dealerId: dealer.id
        }
      }),
      prisma.lead.create({
        data: {
          pdId: 'PD-1006',
          buyerName: 'Meera Patel',
          buyerPhone: '+919876000006',
          buyerEmail: 'meera@example.com',
          requirements: '3BHK with parking, Sector 49',
          budget: 7500000,
          status: 'QUALIFIED',
          location: 'Sector 49, Gurgaon',
          notes: JSON.stringify(['Looking for immediate possession']),
          assignedRepId: salesReps[0].id,
          source: 'Website',
          priority: 'MEDIUM',
          dealerId: dealer.id
        }
      }),
      prisma.lead.create({
        data: {
          pdId: 'PD-1007',
          buyerName: 'Arjun Mehta',
          buyerPhone: '+919876000007',
          buyerEmail: 'arjun@example.com',
          requirements: '4BHK luxury apartment',
          budget: 18000000,
          status: 'NEW',
          location: 'DLF Phase 5, Gurgaon',
          notes: JSON.stringify([]),
          assignedRepId: salesReps[2].id,
          source: 'Referral',
          priority: 'HIGH',
          dealerId: dealer.id
        }
      })]);
      console.log(`✅ Created ${leads.length} leads`);
    } else {
      console.log(`ℹ️ Leads already exist (${leadCount}), skipping creation`);
      leads = await prisma.lead.findMany({ take: 5 });
    }

    // 5. Create Referral Codes
    console.log('\n🎁 Creating Referral Codes...');
    
    const referralCodes = await Promise.all([
      prisma.referralCode.upsert({
        where: { code: 'FIRST10' },
        update: {},
        create: {
          code: 'FIRST10',
          discount: 10,
          type: 'percentage',
          active: true,
          usageLimit: 100,
          usedCount: 5
        }
      }),
      prisma.referralCode.upsert({
        where: { code: 'REFER50K' },
        update: {},
        create: {
          code: 'REFER50K',
          discount: 50000,
          type: 'fixed',
          active: true,
          usageLimit: 50,
          usedCount: 12
        }
      }),
      prisma.referralCode.upsert({
        where: { code: 'LUXURY20' },
        update: {},
        create: {
          code: 'LUXURY20',
          discount: 20,
          type: 'percentage',
          active: true,
          usageLimit: 25,
          usedCount: 3
        }
      })
    ]);
    
    console.log(`✅ Created ${referralCodes.length} referral codes`);

    // 6. Create Agency Settings
    console.log('\n⚙️ Creating Agency Settings...');
    
    const settings = await prisma.agencySettings.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        agencyName: 'ApnaCodex Property Solutions',
        phone: '+919876543200',
        address: 'Sector 44, Gurgaon, Haryana',
        upiId: 'apnacodex@upi',
        radius: 25.0,
        lat: 28.4595,
        lng: 77.0266,
        salesReps: JSON.stringify(salesReps.map(r => r.id)),
        ownerContact: '+919876543200'
      }
    });
    
    console.log('✅ Agency settings created');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ApnaCodex Database Seeding Complete!');
    console.log('='.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   👤 Admin User: 1`);
    console.log(`   👥 Sales Reps: ${salesReps.length}`);
    console.log(`   🏠 Properties: ${properties.length}`);
    console.log(`   📋 Leads: ${leads.length}`);
    console.log(`   🎁 Referral Codes: ${referralCodes.length}`);
    console.log(`   ⚙️ Settings: Updated`);
    
    console.log(`\n🎯 Database: gharbot`);
    console.log(`   Collections created and populated!`);
    
    console.log(`\n✅ You can now:`);
    console.log(`   1. Login: addyky100@gmail.com / Addy8660179`);
    console.log(`   2. View ${leads.length} leads in dashboard`);
    console.log(`   3. Browse ${properties.length} properties`);
    console.log(`   4. Manage ${salesReps.length} sales reps`);
    console.log(`   5. Use referral codes: ${referralCodes.map(c => c.code).join(', ')}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedApnaCodex()
  .then(() => {
    console.log('✅ Seeding completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
