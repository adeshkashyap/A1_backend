#!/bin/bash

# SendGrid Setup Instructions for ApnaCodex
# Run this after you get your SendGrid API key

echo "🔐 SendGrid Email OTP Setup"
echo "================================"
echo ""

# Check if API key is provided
if [ -z "$1" ]; then
  echo "❌ Error: SendGrid API key not provided"
  echo ""
  echo "Usage: ./setup-sendgrid.sh YOUR_SENDGRID_API_KEY"
  echo ""
  echo "📝 Steps to get your API key:"
  echo "1. Sign up at: https://signup.sendgrid.com"
  echo "2. Go to: Settings → API Keys"
  echo "3. Click 'Create API Key'"
  echo "4. Choose 'Full Access' or 'Restricted Access' (with Mail Send permission)"
  echo "5. Copy the API key (you'll only see it once!)"
  echo ""
  exit 1
fi

SENDGRID_API_KEY=$1

echo "✅ Adding SendGrid configuration to .env..."
echo ""

# Backup existing .env
if [ -f .env ]; then
  cp .env .env.backup.$(date +%s)
  echo "📦 Backed up existing .env"
fi

# Add or update SendGrid config
cat >> .env << EOF

# ============================================
# EMAIL OTP CONFIGURATION (SendGrid)
# ============================================
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=$SENDGRID_API_KEY
EMAIL_FROM=noreply@apnacodex.com
EMAIL_FROM_NAME=ApnaCodex Property

EOF

echo "✅ SendGrid configuration added to .env"
echo ""
echo "📝 Next steps:"
echo "1. Verify sender email in SendGrid dashboard"
echo "2. Run database migration: npx prisma db push"
echo "3. Install dependencies: npm install"
echo "4. Test locally: npm start"
echo "5. Deploy to production"
echo ""
echo "🧪 Test the OTP system:"
echo "curl -X POST http://localhost:3000/api/auth/signup/request-otp \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\":\"your-email@example.com\"}'"
echo ""
echo "✨ Setup complete!"
