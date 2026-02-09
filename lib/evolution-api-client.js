const axios = require('axios');
const logger = require('./logger');

/**
 * Evolution API Client for ApnaCodex v2.0
 * Replaces WhatsApp Web.js with production-ready Evolution API
 * Supports multi-instance, webhooks, and 1000+ msg/min scaling
 */
class EvolutionAPI {
    constructor() {
        this.baseURL = (process.env.EVOLUTION_API_URL || 'http://localhost:8080').replace(/\/$/, '');
        this.apiKey = process.env.EVOLUTION_API_KEY || '';
        this.defaultInstance = process.env.EVOLUTION_INSTANCE || 'apnacodex';
        this.status = 'DISCONNECTED';
        this.instances = new Map();
        
        // Add default timeout
        this.axios = axios.create({
            timeout: 15000 // 15 seconds
        });
        
        // Log configuration (censored)
        const censoredKey = this.apiKey ? `${this.apiKey.substring(0, 4)}...${this.apiKey.substring(this.apiKey.length - 4)}` : 'MISSING';
        logger.info(`[EvolutionAPI] Initialized with URL: ${this.baseURL} | Key: ${censoredKey}`);
    }

    /**
     * Get headers for Evolution API requests
     */
    getHeaders() {
        const key = process.env.EVOLUTION_API_KEY || this.apiKey;
        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'apikey': key,
            'apiKey': key, // Some versions use camelCase
            'Authorization': `Bearer ${key}` // Fallback
        };
    }

    /**
     * Create a new WhatsApp instance
     * @param {string} instanceId - Unique dealer ID
     */
    async createInstance(dealerId) {
        // Ensure name is clean (alphanumeric only + underscores)
        const cleanDealerId = dealerId.replace(/[^a-zA-Z0-9]/g, '');
        const instanceName = `apnacodex_${cleanDealerId}`;
        
        try {
            logger.info(`Creating instance for dealer: ${dealerId}`, { name: instanceName });
            
            const payload = {
                instanceName: instanceName,
                qrcode: true,
                integration: 'WHATSAPP-BAILEYS',
                rejectCall: true,
                groupsIgnore: true,
                alwaysOnline: true,
                readMessages: false, // Don't auto-read, let bot handle it
                readStatus: false,
                webhook: {
                    enabled: true,
                    url: `${(process.env.PUBLIC_URL || 'https://apnacodex.info').replace(/\/$/, '')}/webhook/evolution`,
                    byEvents: false,
                    events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED']
                }
            };
            
            // Note: v2 often uses the 'apikey' header for global auth. 
            // Body 'token' is usually for the instance-specific token. 
            // We'll leave it as auto-generated unless explicitly needed.

            const response = await this.axios.post(
                `${this.baseURL}/instance/create`,
                payload,
                { headers: this.getHeaders() }
            );

            logger.info(`✅ Instance created: ${instanceName}`);
            this.instances.set(instanceName, response.data);
            return response.data;
        } catch (error) {
            const errorData = error.response?.data;
            const errorStatus = error.response?.status;
            
            logger.error(`❌ [EvolutionAPI] Create Error ${instanceName}: Status ${errorStatus}`, {
                data: errorData,
                message: error.message
            });

            // Handle "already in use" or "already exists"
            if (errorStatus === 403 || errorStatus === 400) {
                if (JSON.stringify(errorData).includes('already exists') || JSON.stringify(errorData).includes('in use')) {
                    logger.warn(`[EvolutionAPI] Instance ${instanceName} already exists.`);
                    return { success: true, message: 'Instance already exists' };
                }
            }

            throw error;
        }
    }

    /**
     * Connect an instance (get QR code)
     * @param {string} instanceName
     */
    async connectInstance(instanceName = this.defaultInstance) {
        try {
            logger.info(`Connecting instance (fetching QR): ${instanceName}`);
            const response = await this.axios.get(
                `${this.baseURL}/instance/connect/${instanceName}`,
                { headers: this.getHeaders() }
            );

            logger.info(`📱 QR Code available for ${instanceName}`);
            return response.data;
        } catch (error) {
            logger.error(`❌ Failed to connect instance ${instanceName}`, error);
            throw error;
        }
    }

    /**
     * Fetch all instances from Evolution API
     */
    async getInstances() {
        try {
            const response = await this.axios.get(
                `${this.baseURL}/instance/fetchInstances`,
                { headers: this.getHeaders() }
            );
            return Array.isArray(response.data) ? response.data : [];
        } catch (error) {
            logger.error('❌ Failed to fetch instances', null, { error: error.message });
            return [];
        }
    }

    /**
     * Set webhook URL for instance
     * @param {string} instanceName
     * @param {string} webhookUrl - Your webhook endpoint URL
     */
    async setWebhook(instanceName = this.defaultInstance, webhookUrl) {
        try {
            logger.info(`🔗 Setting webhook for ${instanceName}: ${webhookUrl}`);
            const response = await this.axios.post(
                `${this.baseURL}/webhook/set/${instanceName}`,
                {
                    webhook: {
                        enabled: true,
                        url: webhookUrl,
                        byEvents: false,
                        base64: false,
                        events: [
                            'QRCODE_UPDATED',
                            'MESSAGES_UPSERT',
                            'MESSAGES_UPDATE',
                            'SEND_MESSAGE',
                            'CONNECTION_UPDATE'
                        ]
                    }
                },
                { headers: this.getHeaders() }
            );

            logger.info(`✅ Webhook set successfully for ${instanceName}`);
            return response.data;
        } catch (error) {
            const errorMsg = error.response?.data?.response?.message || error.message;
            logger.error(`❌ Failed to set webhook for ${instanceName}`, null, { 
                error: errorMsg,
                url: `${this.baseURL}/webhook/set/${instanceName}`,
                target: webhookUrl
            });
            throw error;
        }
    }

    /**
     * Send text message with SMS fallback
     * @param {string} instanceName - Instance to send from
     * @param {string} jid - Recipient JID
     * @param {string} text - Message text
     */
    async sendMessage(instanceName, jid, text) {
        try {
            logger.info(`📤 Sending message to ${jid} (Instance: ${instanceName})`);
            const response = await this.axios.post(
                `${this.baseURL}/message/sendText/${instanceName}`,
                {
                    number: jid,
                    text: text,
                    delay: 1200,
                    linkPreview: false
                },
                { headers: this.getHeaders() }
            );

            logger.info(`✅ Message sent to ${jid}`);
            return response.data;
        } catch (error) {
            const errorMsg = error.response?.data?.response?.message || error.message;
            logger.error(`❌ Failed to send WhatsApp message to ${jid}: ${errorMsg}`);
            
            // Fallback to SMS for critical notifications (e.g. leads)
            const isCritical = text.includes('Lead ID:') || text.includes('OTP:');
            if (isCritical) {
                logger.info(`[Fallback] WhatsApp failed, attempting SMS to ${jid}...`);
                return await this.sendSms(jid, text).catch(e => {
                    logger.error(`[Fallback] SMS also failed for ${jid}: ${e.message}`);
                });
            }
            
            throw error;
        }
    }

    /**
     * Send SMS Placeholder (Integration point for Twilio/MessageBird)
     * @param {string} phone 
     * @param {string} text 
     */
    async sendSms(phone, text) {
        const cleanPhone = phone.split('@')[0].replace(/\D/g, '');
        logger.warn(`[SMS Service] To: ${cleanPhone} | Message: ${text.substring(0, 50)}... [PLACEHOLDER]`);
        // Here you would integrate with process.env.SMS_PROVIDER (Twilio, Gupshup, etc.)
        return { success: true, provider: 'placeholder' };
    }

    /**
     * Send media message (image, video, document)
     * @param {string} instanceName
     * @param {string} phone
     * @param {string} caption - Message caption
     * @param {string} mediaUrl - URL or base64 of media
     */
    async sendMedia(instanceName = this.defaultInstance, phone, caption, mediaUrl) {
        try {
            const remoteJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

            const response = await this.axios.post(
                `${this.baseURL}/message/sendMedia/${instanceName}`,
                {
                    number: remoteJid,
                    caption: caption,
                    media: mediaUrl
                },
                { headers: this.getHeaders() }
            );

            logger.info(`✅ Media sent to ${phone}`, { instanceName, mediaUrl: 'HIDDEN' });
            return response.data;
        } catch (error) {
            logger.error(`❌ Failed to send media to ${phone}`, error);
            throw error;
        }
    }

    /**
     * Create WhatsApp group
     * @param {string} instanceName
     * @param {string} groupName
     * @param {Array<string>} participants - Array of phone numbers
     */
    async createGroup(instanceName = this.defaultInstance, groupName, participants) {
        try {
            // Ensure all participants have proper format
            const formattedParticipants = participants.map(p => 
                p.includes('@') ? p : `${p}@s.whatsapp.net`
            );

            const response = await this.axios.post(
                `${this.baseURL}/group/create/${instanceName}`,
                {
                    subject: groupName,
                    participants: formattedParticipants
                },
                { headers: this.getHeaders() }
            );

            logger.info(`✅ Group created: ${groupName}`, { participants: formattedParticipants.length });
            return response.data;
        } catch (error) {
            logger.error(`❌ Failed to create group ${groupName}`, error);
            throw error;
        }
    }

    /**
     * Add participant to group
     * @param {string} instanceName
     * @param {string} groupId
     * @param {Array<string>} participants
     */
    async addToGroup(instanceName = this.defaultInstance, groupId, participants) {
        try {
            const formattedParticipants = participants.map(p => 
                p.includes('@') ? p : `${p}@s.whatsapp.net`
            );

            const response = await this.axios.post(
                `${this.baseURL}/group/updateParticipant/${instanceName}`,
                {
                    groupJid: groupId,
                    action: 'add',
                    participants: formattedParticipants
                },
                { headers: this.getHeaders() }
            );

            logger.info(`✅ Participants added to group`, { groupId });
            return response.data;
        } catch (error) {
            logger.error(`❌ Failed to add participants`, error);
            throw error;
        }
    }

    /**
     * Get profile picture URL
     * @param {string} instanceName
     * @param {string} phone
     */
    async getProfilePicture(instanceName = this.defaultInstance, phone) {
        try {
            const remoteJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

            const response = await this.axios.get(
                `${this.baseURL}/chat/fetchProfilePictureUrl/${instanceName}`,
                {
                    params: { number: remoteJid },
                    headers: this.getHeaders()
                }
            );

            return response.data;
        } catch (error) {
            logger.warn(`❌ Failed to get profile picture`, { phone, error: error.message });
            return null;
        }
    }

    /**
     * Restart an existing instance
     * @param {string} instanceName
     */
    async restartInstance(instanceName = this.defaultInstance) {
        try {
            const response = await this.axios.post(
                `${this.baseURL}/instance/restart/${instanceName}`,
                {},
                { headers: this.getHeaders() }
            );

            logger.info(`✅ Instance restarted: ${instanceName}`);
            return response.data;
        } catch (error) {
            logger.error(`❌ Failed to restart instance ${instanceName}`, error);
            throw error;
        }
    }

    async deleteInstance(instanceName = this.defaultInstance) {
        try {
            const response = await this.axios.delete(
                `${this.baseURL}/instance/delete/${instanceName}`,
                { headers: this.getHeaders() }
            );

            logger.info(`✅ Instance deleted: ${instanceName}`);
            this.instances.delete(instanceName);
            return response.data;
        } catch (error) {
            logger.error(`❌ Failed to delete instance ${instanceName}`, error);
            throw error;
        }
    }

    /**
     * Get instance status, including owner and connection state.
     * @param {string} instanceName
     */
    async getInstanceStatus(instanceName = this.defaultInstance) {
        try {
            // First try connectionState
            const response = await this.axios.get(
                `${this.baseURL}/instance/connectionState/${instanceName}`,
                { headers: this.getHeaders() }
            );
            
            // Also try to get owner info from fetchInstances for better detection
            const allInstances = await this.getInstances().catch(() => []);
            const current = allInstances.find(i => i.name === instanceName || i.instanceName === instanceName);
            
            return {
                ...response.data,
                ownerJid: current?.ownerJid || current?.owner || null,
                profileName: current?.profileName || null,
                state: response.data.instance?.state || response.data.state || current?.connectionStatus || 'DISCONNECTED'
            };
        } catch (error) {
            if (error.response?.status === 404) {
                return { state: 'NOT_FOUND' };
            }
            logger.error(`❌ Failed to get status for ${instanceName}`, null, { error: error.message });
            return { state: 'ERROR', error: error.message };
        }
    }

    /**
     * Ensure phone number has proper format
     * @param {string} phone
     * @returns {string} Formatted phone with @s.whatsapp.net
     */
    ensureJid(phone) {
        if (!phone) return phone;
        
        // If already has @, return as is
        if (phone.includes('@')) return phone;
        
        // Clean and format
        let cleaned = phone.replace(/\D/g, '');
        
        // If 10 digits, assume India (+91)
        if (cleaned.length === 10) {
            cleaned = '91' + cleaned;
        }
        
        return `${cleaned}@s.whatsapp.net`;
    }

    /**
     * Extract phone number from JID
     * @param {string} jid
     * @returns {string} Clean phone number
     */
    extractPhone(jid) {
        if (!jid) return jid;
        return jid.split('@')[0];
    }
}

// Export singleton instance
const evolutionAPI = new EvolutionAPI();

module.exports = evolutionAPI;
