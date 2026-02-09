-- Migration: Add phone verification fields
-- This migration adds phoneVerified and phoneVerifiedAt to the Dealer model

-- Add phoneVerified column (default false)
ALTER TABLE "Dealer" ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN NOT NULL DEFAULT false;

-- Add phoneVerifiedAt column (nullable timestamp)
ALTER TABLE "Dealer" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3);

-- Create index on phone for faster lookups
CREATE INDEX IF NOT EXISTS "Dealer_phone_idx" ON "Dealer"("phone");
