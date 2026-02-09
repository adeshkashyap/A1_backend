# Gmail SMTP Setup for ApnaCodex Domain

## Option 1: Gmail with Custom Domain (Recommended - FREE)

If you have `apnacodex.com` domain, you can use Gmail to send emails from `noreply@apnacodex.com` for FREE!

### Setup Steps:

#### 1. Enable Gmail SMTP

1. Go to your Gmail account (the one you want to use)
2. Enable **2-Factor Authentication**:
   - Google Account → Security → 2-Step Verification → Turn On

#### 2. Create App Password

1. Go to: https://myaccount.google.com/apppasswords
2. Select:
   - App: **Mail**
   - Device: **Other (Custom name)** → Type: "ApnaCodex Server"
3. Click **Generate**
4. Copy the 16-character password (format: `xxxx xxxx xxxx xxxx`)

#### 3. Configure Email Forwarding (Optional but Professional)

To send from `noreply@apnacodex.com` using Gmail:

1. In Gmail → Settings → **Accounts and Import**
2. Click **"Add another email address"**
3. Enter:
   - Name: `ApnaCodex Property`
   - Email: `noreply@apnacodex.com`
4. SMTP Settings:
   - SMTP Server: `smtp.gmail.com`
   - Port: `587`
   - Username: Your Gmail address
   - Password: App password from step 2
5. Verify the email (Gmail will send a confirmation)

#### 4. Add to GitHub Secrets

Go to: https://github.com/adeshkashyap/apnacodex-core-api/settings/secrets/actions

Add these secrets:

- **GMAIL_USER**: Your Gmail address (e.g., `your-email@gmail.com`)
- **GMAIL_APP_PASSWORD**: The 16-char app password (remove spaces: `xxxxxxxxxxxxxxxx`)

#### 5. Update Deployment Config

The code is already configured! Just add the secrets and it will work.

---

## Option 2: Google Workspace SMTP (If you have Workspace)

If you have Google Workspace (paid), you can directly use:

```env
EMAIL_PROVIDER=gmail
GMAIL_USER=noreply@apnacodex.com
GMAIL_APP_PASSWORD=your-workspace-app-password
EMAIL_FROM=noreply@apnacodex.com
```

---

## Option 3: GCP Email API (Advanced - Not Recommended)

GCP doesn't have a native email sending service. You'd need to:

- Use **SendGrid** (Twilio SendGrid on GCP Marketplace)
- Use **Mailgun**
- Use **AWS SES** (cross-cloud)

**Recommendation**: Stick with Gmail SMTP - it's free, reliable, and professional!

---

## 🎯 What I'll Do Next

I'll update the deployment to use Gmail SMTP instead of SendGrid. You just need to:

1. **Create App Password** (2 minutes)
2. **Add GitHub Secrets** (1 minute)
3. **Deploy!**

Sound good?

---

## 📊 Comparison

| Service          | Cost       | Limit     | Setup Time | Professional Email   |
| ---------------- | ---------- | --------- | ---------- | -------------------- |
| **Gmail SMTP**   | FREE       | 500/day   | 3 min      | ✅ Yes (with domain) |
| SendGrid         | FREE       | 100/day   | 5 min      | ✅ Yes               |
| Google Workspace | $6/user/mo | 2000/day  | 10 min     | ✅ Yes               |
| AWS SES          | $0.10/1000 | Unlimited | 30 min     | ✅ Yes               |

**Winner**: Gmail SMTP with your domain! 🏆
