const prisma = require('./prisma');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { askAI } = require('./ai-helper');

// Helper to calculate distance using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// Geocoding helper using Nominatim (OpenStreetMap)
async function geocodeAddress(address) {
  try {
    const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
      params: {
        q: address,
        format: 'json',
        limit: 1
      },
      headers: { 'User-Agent': 'MomsKitchenBot/1.0' }
    });
    
    if (response.data && response.data.length > 0) {
      return {
        lat: parseFloat(response.data[0].lat),
        lng: parseFloat(response.data[0].lon)
      };
    }
    return null;
  } catch (err) {
    console.error('Geocode API Error:', err.message);
    return null;
  }
}

async function notifyChefs(order) {
  const evolution = require('./whatsapp-client');
  try {
    const chefs = await prisma.chef.findMany({ where: { active: true } });
    if (chefs.length === 0) return;

    const chefMessage = `👨‍🍳 *New Kitchen Order!*
ID: *${order.shortId}*
Items: ${order.items}
Qty: ${order.quantity}
Customer: ${order.customerName}

Please start preparing immediately! 🔥`;

    for (const chef of chefs) {
      await evolution.sendMessage(chef.phone, chefMessage);
    }
  } catch (err) {
    console.error('[Chef Notification Error]', err.message);
  }
}

async function notifyDeliveryBoy(order) {
  const evolution = require('./whatsapp-client');
  try {
    if (!order.assignedBoyId) return;

    const orderBoy = await prisma.deliveryBoy.findUnique({ where: { id: order.assignedBoyId } });
    if (!orderBoy) return;

    const boyMessage = `🛵 *Delivery Job Assigned!*
ID: *${order.shortId}*
Address: ${order.address}
Customer: ${order.customerName}
Phone: ${order.customerPhone}
Amount to Collect: ₹${order.amount}

Please deliver as soon as it's ready! 🚀`;

    await evolution.sendMessage(orderBoy.phone, boyMessage);
  } catch (err) {
    console.error('[Delivery Notification Error]', err.message);
  }
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Momskitchen@2026';
const PAYMENT_QR_PATH = path.join(__dirname, '../assets/paymentqr.jpeg');

async function handleWhatsAppMessage(fullJid, messageText, messageType = 'text', mediaData = null, actualPhone = null) {
  const evolution = require('./whatsapp-client');
  
  // Ignore status updates, broadcasts, and groups
  if (fullJid.includes('@broadcast') || fullJid.includes('@g.us')) {
    return;
  }

  const lowerText = (messageText || "").trim().toLowerCase();
  
  console.log(`[Flow Engine] Input: ${fullJid} | Phone: ${actualPhone || 'N/A'} | Text: "${messageText?.substring(0, 30)}"`);
  
  // 1. Get or Create Session (using FULL JID)
  let session = await prisma.whatsAppSession.upsert({
    where: { phoneNumber: fullJid },
    update: { lastUpdate: new Date() },
    create: { phoneNumber: fullJid, state: 'idle' }
  });

  const sessionData = JSON.parse(session.data || '{}');
  
  // Store actual phone number in session if available
  if (actualPhone && !sessionData.actualPhone) {
    sessionData.actualPhone = actualPhone;
    await prisma.whatsAppSession.update({
      where: { phoneNumber: fullJid },
      data: { data: JSON.stringify(sessionData) }
    });
  }
  
  console.log(`[Flow Engine] Input: ${fullJid} | State: ${session.state} | Text: "${messageText}"`);

  // Global Reset Command
  if (lowerText === 'reset' || lowerText === 'cancel') {
    await updateSession(fullJid, { state: 'idle', data: '{}' });
    return evolution.sendMessage(fullJid, 'Session reset. How can I help you today? 🍱');
  }

  // 2. Admin Logic (High Priority)
  if ((messageType === 'chat' || messageType === 'text') && (lowerText === 'admin chat' || lowerText === 'admin panel')) {
    await updateSession(fullJid, { state: 'admin_password' });
    return evolution.sendMessage(fullJid, 'Password -');
  }

  if (session.state === 'admin_password' && (messageType === 'chat' || messageType === 'text')) {
    if (messageText.trim() === ADMIN_PASSWORD) {
      await updateSession(fullJid, { state: 'admin_idle', isAdmin: true });
      return evolution.sendMessage(fullJid, 'Admin mode activated ✅ How can I help you?');
    } else {
      await updateSession(fullJid, { state: 'idle', isAdmin: false });
      return evolution.sendMessage(fullJid, 'Incorrect password. Access denied.');
    }
  }

  if (session.isAdmin && session.state.startsWith('admin_') && (messageType === 'chat' || messageType === 'text')) {
    return handleAdminCommands(fullJid, lowerText, session);
  }

  // 3. Immediate Keyword Check (Fast Response - India Only Optimization)
  if (session.state === 'idle') {
    if (lowerText === 'hi' || lowerText === 'hello' || lowerText === 'hey') {
      return evolution.sendMessage(fullJid, "Hi there! I'm *Mom's Kitchen*, your virtual assistant. Would you like to see our menu? Just type *menu*. 😊");
    }
    
    if (lowerText.includes('menu') || lowerText.includes('catalog') || lowerText.includes('list') || lowerText.includes('khana')) {
      const items = await prisma.inventoryItem.findMany({ where: { available: true } });
      await evolution.sendMessage(fullJid, "Here is our menu! 🍽️");
      
      for (const item of items) {
        const itemMsg = `*${item.name}*\nPrice: ₹${item.price}\nCategory: ${item.category}`;
        if (item.image) {
          await evolution.sendMedia(fullJid, itemMsg, item.image);
          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          await evolution.sendMessage(fullJid, itemMsg);
        }
      }
      return evolution.sendMessage(fullJid, "What would you like to order? Simply type the name of the dish! 😊");
    }
  }

  // 4. AI Powered Intent Detection
  const canAIHandle = session.state === 'idle' || session.state === 'waiting_payment' || session.state === 'ordering_name';
  if (canAIHandle && (messageType === 'chat' || messageType === 'text') && messageText.length > 1) {
    const items = await prisma.inventoryItem.findMany({ where: { available: true } });
    const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } }) || { restaurantName: "Mom's Kitchen" };
    
    const menuContext = items.map(i => `- ${i.name}: ₹${i.price} (${i.category})`).join('\n');
    
    // Robust lookup: Check full JID and potential numeric version
    const pureNumber = fullJid.split('@')[0];
    const lastOrder = await prisma.order.findFirst({
      where: {
        OR: [{ customerPhone: fullJid }, { customerPhone: pureNumber }]
      },
      orderBy: { createdAt: 'desc' }
    });

    const systemPrompt = `You are "MomBot" for ${settings.restaurantName}.
RESTAURANT: 10AM-8PM, 8KM delivery. Pay via UPI or Cash.
MENU: 
${menuContext}

USER: ${lastOrder?.customerName || 'Friend'}. 

TASKS:
1. Welcome greetings warmly.
2. If ordering, identify ALL ITEMS & QUANTITIES.
3. Answer menu/price/timing questions.
4. Output JSON ONLY: {"intent": "greeting"|"order"|"faq"|"tracking"|"unknown", "reply": "msg", "orderItems": [{"name": "EXACT name", "qty": number}]}`;

    try {
      const aiResponse = await askAI(messageText, systemPrompt);
      if (aiResponse) {
        // Robust JSON Extraction
        let jsonStr = aiResponse;
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }

        const ai = JSON.parse(jsonStr);
        console.log(`[AI Logic] Intent: ${ai.intent} | Reply: ${ai.reply}`);
        if (ai.intent === 'tracking') {
          return handleOrderTracking(fullJid, messageText);
        }
        if (ai.intent === 'order' && ai.orderItems?.length > 0) {
          let totalAmount = 0;
          let summary = [];
          for (const item of ai.orderItems) {
            const found = items.find(i => i.name.toLowerCase() === item.name.toLowerCase());
            if (found) {
              const q = item.qty || 1;
              totalAmount += found.price * q;
              summary.push(`${q}x ${found.name}`);
            }
          }

          if (summary.length > 0) {
             const name = lastOrder?.customerName;
             await updateSession(fullJid, { 
                state: 'ordering_name', 
                data: JSON.stringify({ items: summary.join(', '), amount: totalAmount, quantity: 1, oldName: name }) 
             });
             return evolution.sendMessage(fullJid, `Got it! *${summary.join(' + ')}*. 🍱\n\n${name ? `Ordering for *${name}* again?` : "May I know your *Name* please?"}`);
          }
        }
      }
    } catch (e) {
      console.warn('AI Parsing Failed, falling back to keywords');
    }
  }

  // 5. State Machine
  const flow = {
    'ordering_name': async () => {
      let finalName = messageText.trim();
      const yesWords = ['yes', 'correct', 'yeah', 'yep', 'y', 'haan', 'sahi'];
      if (sessionData.oldName && yesWords.includes(lowerText)) {
        finalName = sessionData.oldName;
      }
      await updateSession(fullJid, { state: 'ordering_address', data: JSON.stringify({ ...sessionData, customerName: finalName }) });
      return evolution.sendMessage(fullJid, `Great, ${finalName}! 😊 Now, please provide your *Delivery Address*? 🚚`);
    },
    'ordering_address': async () => {
      let lat, lng;
      let addr = messageText;
      if (messageType === 'location' && mediaData) {
        lat = mediaData.location?.latitude || mediaData._data?.lat;
        lng = mediaData.location?.longitude || mediaData._data?.lng;
        addr = "Location Pin 📍";
      } else {
        const coords = await geocodeAddress(messageText);
        if (coords) { lat = coords.lat; lng = coords.lng; }
      }
      if (lat && lng) {
        const st = await prisma.settings.findUnique({ where: { id: 'singleton' } }) || { radius: 8, lat: 28.6139, lng: 77.2090 };
        const dist = calculateDistance(st.lat, st.lng, lat, lng);
        if (dist > st.radius) return evolution.sendMessage(fullJid, `Sorry! 😔 We only deliver within ${st.radius}km. You are ${dist.toFixed(1)}km away.`);
      }
      await updateSession(fullJid, { state: 'ordering_coupon', data: JSON.stringify({ ...sessionData, address: addr }) });
      return evolution.sendMessage(fullJid, 'Got it! 📍 Do you have a *Coupon Code*? (or say skip)');
    },
    'ordering_coupon': async () => {
      let disc = 0; let code = null;
      if (lowerText !== 'no' && lowerText !== 'skip') {
        const c = await prisma.coupon.findUnique({ where: { code: messageText.trim().toUpperCase(), active: true } });
        if (c) {
          disc = c.type === 'percentage' ? Math.round(sessionData.amount * (c.discount/100)) : c.discount;
          code = c.code;
          await evolution.sendMessage(fullJid, `✅ Coupon *${code}* applied! Saved ₹${disc}.`);
        }
      }
      const amt = (sessionData.amount || 0) - disc;
      await updateSession(fullJid, { state: 'ordering_upsell', data: JSON.stringify({ ...sessionData, discount: disc, couponCode: code, finalAmount: amt }) });
      return handleUpsell(fullJid, { ...sessionData, finalAmount: amt });
    },
    'ordering_upsell': async () => {
      let items = sessionData.items; let amt = sessionData.finalAmount;
      if (lowerText.includes('yes') || lowerText.includes('add')) {
        items += " + Masala Chaas"; amt += 30;
      }
      const code = `MK-${Math.floor(1000 + Math.random() * 9000)}`;
      await updateSession(fullJid, { state: 'waiting_payment', data: JSON.stringify({ ...sessionData, items, amount: amt, orderCode: code }) });
      const st = await prisma.settings.findUnique({ where: { id: 'singleton' } }) || { upiId: 'momskitchen@upi' };
      const msg = `Total: ₹${amt}\nUPI: ${st.upiId}\n\nPlease pay and send screenshot! 💳`;
      if (st.qrCodeUrl) return evolution.sendMedia(fullJid, msg, st.qrCodeUrl);
      try {
        const base64 = fs.readFileSync(PAYMENT_QR_PATH, { encoding: 'base64' });
        return evolution.sendMedia(fullJid, msg, base64);
      } catch (e) { return evolution.sendMessage(fullJid, msg); }
    },
    'waiting_payment': async () => {
      if (messageType === 'image') {
        const { orderCode, customerName, items, amount, address, actualPhone } = sessionData;
        const phoneToStore = actualPhone || fullJid; // Fallback to JID if actualPhone not available
        
        await prisma.order.create({ 
          data: { 
            shortId: orderCode, 
            customerName, 
            customerPhone: phoneToStore, 
            items, 
            amount, 
            address, 
            status: 'pending' 
          } 
        });
        
        await updateSession(fullJid, { state: 'idle', data: '{}' });
        await evolution.sendMessage(fullJid, `Thank you! ✅ Order *${orderCode}* received.`);
        
        const st = await prisma.settings.findUnique({ where: { id: 'singleton' } });
        if (st?.ownerContact) {
          evolution.sendMessage(st.ownerContact, `🆕 Order ${orderCode}\n${items}\n₹${amount}\nCust: ${customerName}\nPhone: ${phoneToStore}`);
        }
      } else {
        return evolution.sendMessage(fullJid, "Please send payment screenshot! 💳");
      }
    }
  };

  if (flow[session.state]) return flow[session.state]();
  
  if (!lowerText.includes('hi') && !lowerText.includes('menu')) {
    return evolution.sendMessage(fullJid, "Type 'menu' to start or 'reset' if stuck! 😊");
  }
}

async function handleAdminCommands(fullJid, text, session) {
  const evolution = require('./whatsapp-client');
  if (text.includes('is confirmed')) {
    const code = text.split(' ')[0].toUpperCase();
    const order = await prisma.order.update({ where: { shortId: code }, data: { status: 'confirmed' } });
    await evolution.sendMessage(order.customerPhone, `Order *${code}* confirmed! 👨‍🍳`);
    await notifyChefs(order);
    return evolution.sendMessage(fullJid, `Order ${code} confirmed.`);
  }
  return evolution.sendMessage(fullJid, "Admin active.");
}

async function handleUpsell(fullJid, data) {
  const evolution = require('./whatsapp-client');
  return evolution.sendMessage(fullJid, `${data.customerName || 'Friend'}, want to add *Masala Chaas* for just ₹30? (Yes/No)`);
}

async function handleOrderTracking(fullJid, text) {
  const evolution = require('./whatsapp-client');
  const code = text.match(/MK-\d{4}/i)?.[0]?.toUpperCase();
  if (!code) return evolution.sendMessage(fullJid, "Please provide your order ID (e.g., MK-1234).");
  const order = await prisma.order.findUnique({ where: { shortId: code } });
  if (!order) return evolution.sendMessage(fullJid, `Order *${code}* not found ❌`);
  return evolution.sendMessage(fullJid, `Order *${code}* is ${order.status.toUpperCase()} 🛵`);
}

async function updateSession(phoneNumber, update) {
  return prisma.whatsAppSession.upsert({
    where: { phoneNumber },
    update,
    create: { phoneNumber, ...update }
  });
}

module.exports = { handleWhatsAppMessage, notifyChefs, notifyDeliveryBoy };
