-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Dealer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'dealer',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dealer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyType" TEXT NOT NULL DEFAULT 'agency',
    "tagline" TEXT,
    "description" TEXT,
    "logo" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Delhi',
    "state" TEXT NOT NULL DEFAULT 'Delhi',
    "website" TEXT,
    "botName" TEXT NOT NULL DEFAULT 'Property Assistant',
    "botTone" TEXT NOT NULL DEFAULT 'professional',
    "welcomeMessage" TEXT,
    "operatingHours" TEXT NOT NULL DEFAULT '{"mon":"9-6","tue":"9-6","wed":"9-6","thu":"9-6","fri":"9-6","sat":"10-4","sun":"closed"}',
    "serviceAreas" TEXT NOT NULL DEFAULT '["Delhi","Noida","Gurgaon"]',
    "languages" TEXT NOT NULL DEFAULT '["English","Hindi"]',
    "whatsappNumber" TEXT,
    "whatsappConnected" BOOLEAN NOT NULL DEFAULT false,
    "whatsappInstance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bhk" INTEGER,
    "sqft" DOUBLE PRECISION,
    "price" DOUBLE PRECISION NOT NULL,
    "location" TEXT,
    "reraNo" TEXT,
    "amenities" TEXT NOT NULL DEFAULT '[]',
    "images" TEXT NOT NULL DEFAULT '[]',
    "possession" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dealerId" TEXT,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "pdId" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerPhone" TEXT NOT NULL,
    "buyerEmail" TEXT,
    "requirements" TEXT NOT NULL,
    "budget" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "location" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '[]',
    "assignedRepId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'WhatsApp',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dealerId" TEXT,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesRep" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "commission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesRep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'percentage',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "usageLimit" INTEGER NOT NULL DEFAULT 100,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppSession" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'idle',
    "data" TEXT NOT NULL DEFAULT '{}',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencySettings" (
    "id" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL DEFAULT 'ApnaCodex Property Solutions',
    "phone" TEXT NOT NULL DEFAULT '+91 98765 43210',
    "address" TEXT NOT NULL DEFAULT 'Sector 44, Gurgaon, Haryana',
    "upiId" TEXT NOT NULL DEFAULT 'apnacodex@upi',
    "radius" DOUBLE PRECISION NOT NULL DEFAULT 25.0,
    "lat" DOUBLE PRECISION NOT NULL DEFAULT 28.4595,
    "lng" DOUBLE PRECISION NOT NULL DEFAULT 77.0266,
    "logo" TEXT,
    "salesReps" TEXT NOT NULL DEFAULT '[]',
    "ownerContact" TEXT NOT NULL DEFAULT '+91 98765 43210',

    CONSTRAINT "AgencySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'DEALER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dealer_email_key" ON "Dealer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProfile_dealerId_key" ON "CompanyProfile"("dealerId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_pdId_key" ON "Lead"("pdId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesRep_phone_key" ON "SalesRep"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppSession_dealerId_phoneNumber_key" ON "WhatsAppSession"("dealerId", "phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedRepId_fkey" FOREIGN KEY ("assignedRepId") REFERENCES "SalesRep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRep" ADD CONSTRAINT "SalesRep_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

