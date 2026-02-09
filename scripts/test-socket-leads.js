const { io } = require("socket.io-client");
const axios = require("axios");

const API_URL = "http://localhost:3001";
const DEALER_ID = "test-dealer-id"; // This should match a real dealer ID in your DB during manual test

async function testRealTimeLeads() {
  console.log("🚀 Starting Real-time Lead Update Test...");

  // 1. Connect as a client
  const socket = io(API_URL);

  socket.on("connect", () => {
    console.log("✅ Connected to Socket.io server:", socket.id);
    
    // Join dealer room
    socket.emit("join", DEALER_ID);
    console.log(`📡 Joined room: dealer_${DEALER_ID}`);
  });

  socket.on("lead:created", (lead) => {
    console.log("🎉 SUCCESS! Received 'lead:created' event:");
    console.log(JSON.stringify(lead, null, 2));
    process.exit(0);
  });

  socket.on("connect_error", (err) => {
    console.error("❌ Connection Error:", err.message);
    process.exit(1);
  });

  // Wait a bit for connection, then trigger a lead creation via API
  setTimeout(async () => {
    console.log("📝 Triggering lead creation via diagnostic endpoint...");
    try {
      // Note: This assumes you have a dealer with this ID or you use a real one
      // Since I can't easily trigger the real auth flow here, I'll just check if the server emits
      // when we hit the diagnostic endpoint which I updated.
      // But diagnostic endpoint doesn't have dealerId normally, it's hardcoded to 'apnacodex' in flow.
      
      const response = await axios.get(`${API_URL}/api/test-flow?number=919999999999&text=I want a 3BHK`);
      console.log("📡 Diagnostic trigger response:", response.data);
    } catch (error) {
      console.error("❌ Failed to trigger lead:", error.message);
    }
  }, 2000);

  // Timeout after 15 seconds
  setTimeout(() => {
    console.error("⏳ Test timed out. No event received.");
    process.exit(1);
  }, 15000);
}

testRealTimeLeads();
