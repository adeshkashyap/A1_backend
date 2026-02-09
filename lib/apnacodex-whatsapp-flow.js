const prisma = require('./prisma');
const aiHelper = require('./ai-helper');
const fs = require('fs');
const { emitToDealer } = require('./socket');

// Helper to find matching properties for a dealer
async function findMatchingProperties(requirements, dealerId = null) {
  try {
    const where = {};
    
    // Add multi-tenant filter
    if (dealerId) {
      where.dealerId = dealerId;
    }

    if (requirements.bhk) {
      where.bhk = parseInt(requirements.bhk);
    }
    
    if (requirements.budget) {
      where.price = { lte: requirements.budget };
    }

    // Basic location fuzzy match
    if (requirements.location) {
      where.location = { contains: requirements.location, mode: 'insensitive' };
    }

    return prisma.property.findMany({ 
      where,
      take: 5 
    });
  } catch (error) {
    console.error('[ApnaCodex] Property Search Error:', error.message);
    return [];
  }
}

// Helper to format property for WhatsApp
function formatPropertyMessage(property) {
  const formatPrice = (price) => {
    if (price >= 10000000) {
      return `₹${(price / 10000000).toFixed(1)}Cr`;
    } else if (price >= 100000) {
      return `₹${(price / 100000).toFixed(1)}L`;
    } else {
      return `₹${price.toLocaleString('en-IN')}`;
    }
  };

  let message = `🏠 *${property.title}*\n\n`;
  
  if (property.bhk) message += `🛏️ ${property.bhk} BHK\n`;
  if (property.sqft) message += `📐 ${property.sqft} sqft\n`;
  message += `💰 ${formatPrice(property.price)}\n`;
  if (property.location) message += `📍 ${property.location}\n`;
  if (property.reraNo) message += `📋 RERA: ${property.reraNo}\n`;
  if (property.possession) message += `🔑 Possession: ${property.possession}\n`;
  
  if (property.description) {
    message += `\n${property.description.substring(0, 100)}${property.description.length > 100 ? '...' : ''}`;
  }

  return message;
}

// Assign lead to sales rep (round-robin per dealer)
async function assignLeadToRep(leadId, dealerId = null) {
  try {
    // Get all active sales reps for THIS dealer
    const reps = await prisma.salesRep.findMany({
      where: { 
        active: true,
        dealerId: dealerId
      },
      orderBy: { createdAt: 'asc' }
    });

    if (reps.length === 0) return null;

    // Get lead counts for each rep
    const leadCounts = await Promise.all(
      reps.map(async (rep) => {
        const count = await prisma.lead.count({
          where: { assignedRepId: rep.id }
        });
        return { rep, count };
      })
    );

    // Assign to rep with least leads
    const leastBusy = leadCounts.reduce((min, current) => 
      current.count < min.count ? current : min
    );

    // Update lead with assigned rep
    await prisma.lead.update({
      where: { id: leadId },
      data: { assignedRepId: leastBusy.rep.id }
    });

    return leastBusy.rep;
  } catch (error) {
    console.error('[Lead Assignment Error]', error.message);
    return null;
  }
}

// Notify sales rep about new lead
async function notifySalesRep(rep, lead, instanceName = 'apnacodex') {
  const { sendMessage } = require('./evolution-webhook-handler');
  
  try {
    const message = `🎯 *New Lead Assigned!*

👤 *${lead.buyerName}*
📱 ${lead.buyerPhone}
💼 Requirements: ${lead.requirements}
💰 Budget: ₹${(lead.budget / 100000).toFixed(1)}L
📍 ${lead.location || 'Location not specified'}

Lead ID: ${lead.pdId}

Please contact the customer ASAP! 🚀`;

    await sendMessage(rep.phone, message, instanceName);
  } catch (error) {
    console.error('[Rep Notification Error]', error.message);
  }
}

// Main WhatsApp message handler for ApnaCodex
async function handleWhatsAppMessage(fullJid, messageText, messageType = 'text', mediaData = null, actualPhone = null, instanceName = 'apnacodex') {
  const { sendMessage, sendMedia } = require('./evolution-webhook-handler');
  
  try {
    fs.appendFileSync('/tmp/webhook_debug.log', `[${new Date().toISOString()}] 🤖 Bot Processing | Phone: ${actualPhone} | Text: "${messageText}"\n`);
    
    // Extract dealer ID from instance name (format: apnacodex_<id>)
  let dealerId = null;
  if (instanceName && instanceName.startsWith('apnacodex_')) {
    dealerId = instanceName.replace('apnacodex_', '');
  }
  
  // Ignore status updates, broadcasts, and groups
  if (fullJid.includes('@broadcast') || fullJid.includes('@g.us')) {
    return;
  }

  const lowerText = (messageText || "").trim().toLowerCase();
  
  console.log(`\n📩 [WhatsApp Message]`);
  console.log(`   Instance: ${instanceName}`);
  console.log(`   From: ${fullJid} (${actualPhone || 'No Phone'})`);
  console.log(`   Text: "${messageText}"`);
  console.log(`   Type: ${messageType}\n`);
  
  // Get or create session (multi-tenant)
  const sessionWhere = dealerId 
    ? { dealerId_phoneNumber: { dealerId, phoneNumber: fullJid } }
    : { phoneNumber: fullJid }; // Legacy fallback

  let session = await prisma.whatsAppSession.findFirst({
    where: dealerId ? { dealerId, phoneNumber: fullJid } : { phoneNumber: fullJid }
  });

  if (!session) {
    session = await prisma.whatsAppSession.create({
      data: {
        dealerId: dealerId,
        phoneNumber: fullJid,
        state: 'idle'
      }
    });
  } else {
    await prisma.whatsAppSession.update({
      where: { id: session.id },
      data: { lastUpdate: new Date() }
    });
  }

  const sessionData = JSON.parse(session.data || '{}');
  
  // Store actual phone number
  if (actualPhone && !sessionData.actualPhone) {
    sessionData.actualPhone = actualPhone;
    await prisma.whatsAppSession.update({
      where: { id: session.id },
      data: { data: JSON.stringify(sessionData) }
    });
  }

  // Reset command
  if (lowerText === 'reset' || lowerText === 'cancel') {
    await prisma.whatsAppSession.update({
      where: { id: session.id },
      data: { state: 'idle', data: '{}' }
    });
    return sendMessage(fullJid, '✅ Session reset. How can I help you find your dream property? 🏠', instanceName);
  }

  // Get Company Profile for THIS dealer
  let companyProfile = null;
  if (dealerId) {
    companyProfile = await prisma.companyProfile.findUnique({
      where: { dealerId: dealerId }
    });
  }

  if (!companyProfile) {
    companyProfile = {
      companyName: 'ApnaCodex Properties',
      botName: 'Assistant',
      botTone: 'professional',
      welcomeMessage: 'Hi! I\'m your property assistant.'
    };
  }

  // Greetings
  if (session.state === 'idle' && (lowerText === 'hi' || lowerText === 'hello' || lowerText === 'hey')) {
    const greeting = `${companyProfile.welcomeMessage || 'Hi!'}\n\n` +
      `I'm *${companyProfile.botName}* from *${companyProfile.companyName}*.\n\n` +
      `I can help you find your dream property! 🏠\n\n` +
      `Just tell me what you're looking for! (e.g., "3BHK in Sector 49 under 80 lakhs")`;
    
    return sendMessage(fullJid, greeting, instanceName);
  }

  // Define step handlers
  const flow = {
    idle: async () => {
      if (messageText && messageText.length > 10) {
        // Extract requirements using AI
        let requirements = {};
        try {
          requirements = await aiHelper.extractRequirements(messageText, companyProfile);
        } catch (e) {
          console.error('[ApnaCodex AI Error]', e.message);
          requirements = {}; 
        }
        console.log('[Requirements Extracted]', requirements);

        // Find matching properties
        const properties = await findMatchingProperties(requirements, dealerId);

        if (properties.length > 0) {
          await sendMessage(fullJid, `Great! I found ${properties.length} matches. Let me share them... 📋`, instanceName);

          for (const property of properties) {
            const propertyMsg = formatPropertyMessage(property);
            
            // Extract image and apply Cloudinary optimization if applicable
            let imageUrl = property.image || (property.images && (typeof property.images === 'string' ? JSON.parse(property.images)[0] : property.images[0]));
            
            if (imageUrl) {
              // Apply Cloudinary transformations for thumbnails (300x300, auto quality/format)
              if (imageUrl.includes('cloudinary.com')) {
                imageUrl = imageUrl.replace('/upload/', '/upload/c_thumb,w_300,h_300,g_auto,f_auto,q_auto/');
              }
              
              await sendMedia(fullJid, propertyMsg, imageUrl, 'image', instanceName).catch(err => {
                logger.error(`[WhatsApp] Failed to send media: ${err.message}`);
                // Fallback to text if media fails
                return sendMessage(fullJid, propertyMsg + "\n\n📷 View Image: " + imageUrl, instanceName);
              });

              // If documents are available, mention them
              if (property.floorPlanUrl || property.reraPlanUrl) {
                let docMsg = "📄 This property also has:";
                if (property.floorPlanUrl) docMsg += "\n- Detailed Floor Plan";
                if (property.reraPlanUrl) docMsg += "\n- Official RERA Certificate";
                docMsg += "\n\nWould you like me to share these documents? (Reply 'Yes' or 'No')";
                await sendMessage(fullJid, docMsg, instanceName);
              }
            } else {
              await sendMessage(fullJid, propertyMsg, instanceName);
            }
            // Small delay to prevent rate limit issues and maintain order
            await new Promise(r => setTimeout(r, 800));
          }

          await prisma.whatsAppSession.update({
            where: { id: session.id },
            data: { 
              state: 'awaiting_doc_confirmation',
              data: JSON.stringify({ 
                ...sessionData, 
                lastProperties: properties.map(p => ({ id: p.id, floorPlanUrl: p.floorPlanUrl, reraPlanUrl: p.reraPlanUrl })),
                requirements: messageText, 
                extractedReqs: requirements 
              })
            }
          });

          return sendMessage(fullJid, `✨ INTERESTED? Would you like to see the *floor plans* or *RERA docs* for these matches? (Reply 'Yes' or 'No')`, instanceName);
        } else {
          await prisma.whatsAppSession.update({
            where: { id: session.id },
            data: { 
              state: 'awaiting_name',
              data: JSON.stringify({ ...sessionData, requirements: messageText, extractedReqs: requirements })
            }
          });
          return sendMessage(fullJid, `I don't have exact matches, but I can help you find one! May I know your *name*? 😊`, instanceName);
        }
      } else {
        return sendMessage(fullJid, `I'm here to help! Tell me what you're looking for or type *hi* to start.`, instanceName);
      }
    },
    
    awaiting_doc_confirmation: async () => {
      if (lowerText.includes('yes') || lowerText.includes('yeah') || lowerText.includes('show')) {
        const lastProps = sessionData.lastProperties || [];
        for (const prop of lastProps) {
          if (prop.floorPlanUrl) {
            await sendMedia(fullJid, '🗺️ Floor Plan', prop.floorPlanUrl, 'document', instanceName).catch(e => logger.warn('Floor plan fail'));
          }
          if (prop.reraPlanUrl) {
            await sendMedia(fullJid, '📜 RERA Certificate', prop.reraPlanUrl, 'document', instanceName).catch(e => logger.warn('RERA fail'));
          }
        }
        
        await prisma.whatsAppSession.update({
          where: { id: session.id },
          data: { state: 'awaiting_name' }
        });
        return sendMessage(fullJid, `Docs shared! ✅ Now, may I know your *name* to help you further? 😊`, instanceName);
      } else {
        await prisma.whatsAppSession.update({
          where: { id: session.id },
          data: { state: 'awaiting_name' }
        });
        return sendMessage(fullJid, `No problem! May I know your *name* to help you find your dream property? 😊`, instanceName);
      }
    },

    awaiting_name: async () => {
      const name = messageText.trim();
      await prisma.whatsAppSession.update({
        where: { id: session.id },
        data: { 
          state: 'awaiting_budget',
          data: JSON.stringify({ ...sessionData, buyerName: name })
        }
      });
      return sendMessage(fullJid, `Nice to meet you, ${name}! what's your budget range? (e.g., 80 lakhs)`, instanceName);
    },

    awaiting_budget: async () => {
      const budgetMatch = messageText.match(/(\d+\.?\d*)\s*(lakh|lac|l|crore|cr|c)/i);
      let budget = 0;
      if (budgetMatch) {
         budget = parseFloat(budgetMatch[1]) * (budgetMatch[2].toLowerCase().startsWith('c') ? 10000000 : 100000);
      }

      if (budget === 0) return sendMessage(fullJid, `Please specify budget (e.g. 50 lakhs)`, instanceName);

      await prisma.whatsAppSession.update({
        where: { id: session.id },
        data: { 
          state: 'awaiting_location',
          data: JSON.stringify({ ...sessionData, budget })
        }
      });
      return sendMessage(fullJid, `Got it! Which area are you looking in? 📍`, instanceName);
    },

    awaiting_location: async () => {
      const location = messageText.trim();
      const phoneToStore = sessionData.actualPhone || fullJid.split('@')[0];
      const pdId = `PD-${Math.floor(1000 + Math.random() * 9000)}`;

      const lead = await prisma.lead.create({
        data: {
          pdId,
          buyerName: sessionData.buyerName,
          buyerPhone: phoneToStore,
          requirements: sessionData.requirements || `${sessionData.extractedReqs?.bhk || ''}BHK in ${location}`,
          budget: sessionData.budget,
          location,
          status: 'NEW',
          dealerId: dealerId
        }
      });

      const rep = await assignLeadToRep(lead.id, dealerId);
      if (rep) await notifySalesRep(rep, lead, instanceName);

      // Transform for real-time update (backward compatibility)
      const order = {
        ...lead,
        shortId: lead.pdId,
        customerName: lead.buyerName,
        customerPhone: lead.buyerPhone,
        items: lead.requirements,
        amount: lead.budget,
        assignedBoyId: lead.assignedRepId,
        assignedBoy: rep
      };

      // Emit real-time event
      emitToDealer(dealerId, 'lead:created', order);

      await prisma.whatsAppSession.update({
        where: { id: session.id },
        data: { state: 'idle', data: '{}' }
      });

      return sendMessage(fullJid, `Thanks! Our team will contact you shortly. Have a great day! 🚀`, instanceName);
    }
  };

  if (flow[session.state]) {
    return flow[session.state]();
  }

  return flow.idle();
  } catch (error) {
    fs.appendFileSync('/tmp/webhook_debug.log', `[${new Date().toISOString()}] ❌ Bot Error: ${error.message}\n`);
    console.error('[ApnaCodex Handler Error]', error);
  }
}

module.exports = { 
  handleWhatsAppMessage,
  extractRequirements: aiHelper.extractRequirements,
  findMatchingProperties,
  notifySalesRep
};
