const emailService = require('./lib/email-service');

async function test() {
  console.log('----------------------------------------');
  console.log('📧 Sending Test Email to: addyky100@gmail.com');
  // Log masked credentials to verify env loading
  const user = process.env.SMTP_USER || 'undefined';
  const pass = process.env.SMTP_PASSWORD ? '********' : 'undefined';
  console.log(`Using SMTP: ${user} / ${pass}`);
  console.log('----------------------------------------');

  try {
    const result = await emailService.sendOTP('addyky100@gmail.com', '123456', 'verification');
    console.log('✅ Email Sent Successfully!');
    console.log('Message ID:', result.messageId);
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    if (error.response) {
      console.error('SMTP Response:', error.response);
    }
  }
  console.log('----------------------------------------');
}

test();
