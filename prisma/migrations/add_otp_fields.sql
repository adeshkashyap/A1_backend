-- Add OTP fields to Dealer table for email-based authentication
ALTER TABLE "Dealer" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "Dealer" ADD COLUMN "otp" TEXT;
ALTER TABLE "Dealer" ADD COLUMN "otpExpiry" TIMESTAMP(3);
ALTER TABLE "Dealer" ADD COLUMN "otpPurpose" TEXT;
