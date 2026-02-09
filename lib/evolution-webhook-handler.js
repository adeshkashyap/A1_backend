/**
 * Evolution API Webhook Handler for ApnaCodex
 * Preserves 100% of existing WhatsApp flow logic
 * Replaces socket-based message handling with webhook-based
 */

const evolutionAPI = require('./evolution-api-client');

/**
 * Handle incoming webhook from Evolution API
 * This replaces the client.on('message') event handler
 * 
 * @param {Object} webhookData - Raw webhook payload from Evolution API
 * @param {string} instanceName - Instance that received the message
 */
const prisma = require('./prisma');

async function handleEvolutionWebhook(webhookData, instanceName) {
    try {
        // Debug Log to file
        fs.appendFileSync('/tmp/webhook_debug.log', `[${new Date().toISOString()}] ${instanceName} - ${webhookData.event}\n`);
        
        // Refresh lastSeen for this instance
        if (instanceName) {
            await prisma.companyProfile.updateMany({
                where: { whatsappInstance: instanceName },
                data: { lastSeen: new Date() }
            }).catch(err => console.error('[Webhook] Failed to update lastSeen:', err.message));
        }

        // Extract event type
        const event = webhookData.event;
        
        console.log(`[Evolution Webhook] Event: ${event} | Instance: ${instanceName}`);

        // Handle different event types
        switch (event) {
            case 'messages.upsert':
                await handleMessageUpsert(webhookData, instanceName);
                break;
                
            case 'connection.update':
                await handleConnectionUpdate(webhookData, instanceName);
                break;
                
            case 'qrcode.updated':
                await handleQRCodeUpdate(webhookData, instanceName);
                break;
                
            default:
                console.log(`[Evolution Webhook] Unhandled event: ${event}`);
        }
    } catch (error) {
        console.error('[Evolution Webhook Error]:', error.message, error.stack);
    }
}

/**
 * Handle incoming messages (replaces client.on('message'))
 */
async function handleMessageUpsert(webhookData, instanceName) {
    try {
        const data = webhookData.data;
        
        console.log('[Evolution] Processing message upsert...');
        
        // Evolution API v1.8.2 sends message directly in data, not in messages array
        // Check if data itself is the message
        let messages = [];
        
        if (data.key && data.message) {
            // Single message format (v1.8.2)
            messages = [data];
            console.log('[Evolution] Single message format detected');
        } else if (data.messages && Array.isArray(data.messages)) {
            // Array format (v2.x)
            messages = data.messages;
            console.log('[Evolution] Array format detected');
        } else {
            console.log('[Evolution] Unknown message format:', JSON.stringify(data).substring(0, 100));
            return;
        }
        
        for (const message of messages) {
            // Skip if message is from me
            if (message.key.fromMe) {
                console.log('[Evolution] Skipping own message');
                continue;
            }

            // Extract message details
            const fullJid = message.key.remoteJid; // e.g., "919876543210@s.whatsapp.net"
            const messageType = message.messageType || 'text';
            const messageBody = extractMessageBody(message);
            
            // Extract actual phone number
            const actualPhone = evolutionAPI.extractPhone(fullJid);
            
            // Debug Log Message
            fs.appendFileSync('/tmp/webhook_debug.log', `   💌 Message from ${actualPhone}: "${messageBody}"\n`);
            
            console.log(`[Evolution] Message | From: ${fullJid} | Phone: ${actualPhone} | Type: ${messageType} | Body: ${messageBody?.substring(0, 30)}...`);

            // PRESERVE EXISTING LOGIC: Call the same ApnaCodex flow handler
            const whatsappFlow = require('./apnacodex-whatsapp-flow');
            // console.log('[Evolution] WhatsApp Flow Exports:', Object.keys(whatsappFlow)); 
            
            console.log('[Evolution] Calling ApnaCodex flow handler...');
            await whatsappFlow.handleWhatsAppMessage(
                fullJid,
                messageBody,
                messageType,
                message,
                actualPhone,
                instanceName
            ).catch(err => {
                console.error('[Evolution] Error in handleWhatsAppMessage:', err.message);
            });
            console.log('[Evolution] ApnaCodex flow handler completed');
        }
    } catch (error) {
        console.error('[Evolution Message Handler Error]:', error.message, error.stack);
    }
}

/**
 * Extract message body from Evolution API message object
 */
function extractMessageBody(message) {
    try {
        const msg = message.message;
        
        if (!msg) return '';
        
        // Text message
        if (msg.conversation) {
            return msg.conversation;
        }
        
        // Extended text message
        if (msg.extendedTextMessage && msg.extendedTextMessage.text) {
            return msg.extendedTextMessage.text;
        }
        
        // Image with caption
        if (msg.imageMessage && msg.imageMessage.caption) {
            return msg.imageMessage.caption;
        }
        
        // Video with caption
        if (msg.videoMessage && msg.videoMessage.caption) {
            return msg.videoMessage.caption;
        }
        
        // Document with caption
        if (msg.documentMessage && msg.documentMessage.caption) {
            return msg.documentMessage.caption;
        }
        
        // Location message
        if (msg.locationMessage) {
            return 'Location shared';
        }
        
        // Contact message
        if (msg.contactMessage) {
            return 'Contact shared';
        }
        
        return '';
    } catch (error) {
        console.error('[Extract Message Body Error]:', error.message);
        return '';
    }
}

/**
 * Handle connection updates
 */
async function handleConnectionUpdate(webhookData, instanceName) {
    try {
        const data = webhookData.data;
        const state = data.state;
        
        console.log(`[Evolution] Connection Update | Instance: ${instanceName} | State: ${state}`);
        
        if (state === 'open') {
            console.log(`✅ Instance ${instanceName} is connected and ready!`);
            evolutionAPI.status = 'CONNECTED';
            // Reset restart attempts on success
            evolutionAPI.instances.set(`${instanceName}_restarts`, 0);
        } else if (state === 'close' || state === 'disconnected') {
            console.log(`❌ Instance ${instanceName} disconnected. Attempting auto-reconnect...`);
            evolutionAPI.status = 'DISCONNECTED';
            
            // Auto-reconnect logic (Up to 5 attempts)
            const attempts = (evolutionAPI.instances.get(`${instanceName}_restarts`) || 0) + 1;
            if (attempts <= 5) {
                evolutionAPI.instances.set(`${instanceName}_restarts`, attempts);
                console.log(`[Reconnection] Attempt ${attempts}/5 for ${instanceName}...`);
                setTimeout(async () => {
                    try {
                        await evolutionAPI.restartInstance(instanceName);
                    } catch (e) {
                        console.error(`[Reconnection] Restart failed for ${instanceName}:`, e.message);
                    }
                }, 5000 * attempts); // Exponential backoff (5s, 10s, 15s...)
            } else {
                console.error(`🚨 Max reconnection attempts reached for ${instanceName}. Manual intervention required.`);
            }
        }
    } catch (error) {
        console.error('[Evolution Connection Update Error]:', error.message);
    }
}

/**
 * Handle QR code updates
 */
async function handleQRCodeUpdate(webhookData, instanceName) {
    try {
        const data = webhookData.data;
        const qrcode = data.qrcode;
        
        console.log(`📱 QR Code updated for instance: ${instanceName}`);
        console.log(`QR Code available at: ${evolutionAPI.baseURL}/instance/qrcode/${instanceName}`);
        
        // Store QR code for API access
        evolutionAPI.instances.set(`${instanceName}_qr`, qrcode);
    } catch (error) {
        console.error('[Evolution QR Code Update Error]:', error.message);
    }
}

/**
 * Wrapper for sending messages (replaces old client.sendMessage)
 * Maintains backward compatibility with existing code
 */
async function sendMessage(phone, text, instanceName = evolutionAPI.defaultInstance) {
    try {
        const formattedPhone = evolutionAPI.ensureJid(phone);
        return await evolutionAPI.sendMessage(instanceName, formattedPhone, text);
    } catch (error) {
        console.error('[Send Message Error]:', error.message);
        throw error;
    }
}

/**
 * Wrapper for sending media (replaces old client.sendMedia)
 */
async function sendMedia(phone, caption, mediaUrl, instanceName = evolutionAPI.defaultInstance) {
    try {
        const formattedPhone = evolutionAPI.ensureJid(phone);
        return await evolutionAPI.sendMedia(instanceName, formattedPhone, caption, mediaUrl);
    } catch (error) {
        console.error('[Send Media Error]:', error.message);
        throw error;
    }
}

/**
 * Create WhatsApp group for site visits
 * NEW CAPABILITY: Not available in WhatsApp Web.js
 */
async function createDealGroup(leadId, customerPhone, teamPhones, instanceName = evolutionAPI.defaultInstance) {
    try {
        const groupName = `🏠 Deal-${leadId}`;
        const participants = [customerPhone, ...teamPhones];
        
        const group = await evolutionAPI.createGroup(instanceName, groupName, participants);
        
        console.log(`✅ Deal group created: ${groupName}`);
        return group;
    } catch (error) {
        console.error('[Create Deal Group Error]:', error.message);
        throw error;
    }
}

module.exports = {
    handleEvolutionWebhook,
    sendMessage,
    sendMedia,
    createDealGroup,
    evolutionAPI
};
