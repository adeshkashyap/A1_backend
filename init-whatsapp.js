const axios = require('axios');

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const API_KEY = process.env.EVOLUTION_API_KEY || 'apikey';
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'MomsKitchen';
const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost';
const WEBHOOK_URL = process.env.INTERNAL_WEBHOOK_URL || (process.env.DOCKER_ENV ? 'http://backend:3001/api/whatsapp/webhook' : 'http://localhost:3001/api/whatsapp/webhook');

async function init(retries = 5) {
  const isReset = process.argv.includes('--reset');
  console.log('🚀 Initializing WhatsApp Integration...');
  
  // 1. Wait for Evolution API to be healthy
  try {
    const instances = await axios.get(`${EVOLUTION_URL}/instance/fetchInstances`, { headers: { apikey: API_KEY } });
    console.log(`✅ Evolution API is healthy. Found ${instances.data?.length || 0} instances.`);
  } catch (e) {
    if (retries > 0) {
      console.log(`⏳ Waiting for Evolution API... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return init(retries - 1);
    }
    console.error('❌ Could not connect to Evolution API. Ensure the container is running.');
  }

  // 2. Wait for Backend to be listening (internal check)
  console.log('⏳ Waiting for local server (backend) to start...');
  for (let i = 0; i < 30; i++) {
    try {
      // Check both port 3001 and a specific API route
      await axios.get('http://localhost:3001/api/stats/today', { timeout: 2000 });
      console.log('✅ Local server is UP!');
      break;
    } catch (e) {
      if (i === 29) console.log('⚠️ Backend check timed out, proceeding anyway...');
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  try {
    // 0. Optional Reset
    if (isReset) {
      console.log(`🗑️ Deleting existing instance "${INSTANCE_NAME}"...`);
      await axios.delete(`${EVOLUTION_URL}/instance/delete/${INSTANCE_NAME}`, {
        headers: { apikey: API_KEY }
      }).catch(() => {});
    }

    // 1. Create Instance
    console.log(`📦 Creating instance "${INSTANCE_NAME}"...`);
    try {
      await axios.post(`${EVOLUTION_URL}/instance/create`, {
        instanceName: INSTANCE_NAME,
        token: API_KEY,
        qrcode: true
      }, { headers: { apikey: API_KEY } });
    } catch (e) {
      // Robust check for nested error messages in v1.x
      const responseData = e.response?.data;
      const errorMsg = JSON.stringify(responseData || "");
      
      if (errorMsg.includes('already in use')) {
        console.log('✅ Instance already exists.');
      } else {
        throw e;
      }
    }

    // 2. Set Webhook
    console.log(`🔗 Setting webhook to: ${WEBHOOK_URL}`);
    const webhookPayload = {
      url: WEBHOOK_URL,
      enabled: true,
      webhook_by_events: false,
      events: ['MESSAGES_UPSERT', 'QRCODE_UPDATED', 'CONNECTION_UPDATE']
    };

    try {
      // Try standard v1.x instance webhook endpoint
      await axios.post(`${EVOLUTION_URL}/webhook/instance`, {
        instanceName: INSTANCE_NAME,
        ...webhookPayload
      }, { headers: { apikey: API_KEY } });
      console.log(`✅ Webhook configured successfully at ${WEBHOOK_URL}`);
    } catch (e) {
      console.log('⚠️ /webhook/instance failed, trying /webhook/set fallback...');
      await axios.post(`${EVOLUTION_URL}/webhook/set/${INSTANCE_NAME}`, webhookPayload, {
        headers: { apikey: API_KEY }
      });
      console.log(`✅ Webhook configured successfully (via fallback) at ${WEBHOOK_URL}`);
    }

    // 3. Final Verification
    console.log('\n🌟 SETUP COMPLETE!');
    console.log(`1. Dashboard: ${PUBLIC_URL}/dashboard/whatsapp`);
    console.log('2. Scan the QR code with your phone.');
    console.log('\nIf you ever need to start fresh, run: node init-whatsapp.js --reset');

  } catch (error) {
    console.error('❌ FATAL ERROR:');
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

init();
