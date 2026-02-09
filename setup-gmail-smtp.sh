#!/bin/bash

# Gmail SMTP Setup for ApnaCodex
# This script helps you configure Gmail SMTP for email OTP

echo "📧 Gmail SMTP Setup for ApnaCodex"
echo "=================================="
echo ""

# Check if credentials are provided
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "❌ Error: Gmail credentials not provided"
  echo ""
  echo "Usage: ./setup-gmail-smtp.sh YOUR_GMAIL_ADDRESS YOUR_APP_PASSWORD"
  echo ""
  echo "📝 Steps to get your App Password:"
  echo "1. Enable 2-Factor Authentication on your Gmail"
  echo "2. Go to: https://myaccount.google.com/apppasswords"
  echo "3. Select 'Mail' and 'Other (Custom name)'"
  echo "4. Type: 'ApnaCodex Server'"
  echo "5. Copy the 16-character password (remove spaces)"
  echo ""
  echo "Example:"
  echo "./setup-gmail-smtp.sh your-email@gmail.com abcdabcdabcdabcd"
  echo ""
  exit 1
fi

GMAIL_USER=$1
GMAIL_APP_PASSWORD=$2

echo "✅ Adding Gmail SMTP configuration to .env..."
echo ""

# Backup existing .env
if [ -f .env ]; then
  cp .env .env.backup.$(date +%s)
  echo "📦 Backed up existing .env"
fi

# Add or update Gmail config
cat >> .env << EOF

# ============================================
# EMAIL OTP CONFIGURATION (Gmail SMTP)
# ============================================
EMAIL_PROVIDER=gmail
GMAIL_USER=$GMAIL_USER
GMAIL_APP_PASSWORD=$GMAIL_APP_PASSWORD
EMAIL_FROM=noreply@apnacodex.com
EMAIL_FROM_NAME=ApnaCodex Property

EOF

echo "✅ Gmail SMTP configuration added to .env"
echo ""
echo "📝 Next steps:"
echo "1. (Optional) Configure Gmail to send from noreply@apnacodex.com:"
echo "   - Gmail → Settings → Accounts → Add another email address"
echo "   - Follow the verification steps"
echo ""
echo "2. Run database migration: npx prisma db push"
echo "3. Install dependencies: npm install"
echo "4. Test locally: npm start"
echo ""
echo "🧪 Test the OTP system:"
echo "curl -X POST http://localhost:3000/api/auth/signup/request-otp \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\":\"your-email@example.com\"}'"
echo ""
echo "✨ Setup complete!"
echo ""
echo "💡 Pro Tip: To send from noreply@apnacodex.com instead of your Gmail:"
echo "   1. Go to Gmail → Settings → Accounts and Import"
echo "   2. Click 'Add another email address'"
echo "   3. Enter noreply@apnacodex.com"
echo "   4. Use SMTP: smtp.gmail.com:587 with your Gmail credentials"
echo "   5. Verify the email"
