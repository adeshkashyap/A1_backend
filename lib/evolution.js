const axios = require('axios');

class EvolutionAPI {
  constructor() {
    this.baseURL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    this.apiKey = process.env.EVOLUTION_API_KEY || 'apikey';
    this.defaultInstance = process.env.EVOLUTION_INSTANCE || 'apnacodex';
  }

  async request(method, path, data = null) {
    try {
      const config = {
        method,
        url: `${this.baseURL}${path}`,
        headers: {
          'apikey': this.apiKey
        }
      };

      if (data) {
        config.data = data;
        config.headers['Content-Type'] = 'application/json';
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      const errorData = error.response?.data || error.message;
      console.error(`Evolution API Error [${method.toUpperCase()} ${path}]:`, JSON.stringify(errorData, null, 2));
      throw error;
    }
  }

  // Instance Management
  async getInstances() {
    return this.request('get', '/instance/fetchInstances');
  }

  async createInstance(instanceName = this.defaultInstance) {
    return this.request('post', '/instance/create', {
      instanceName,
      token: this.apiKey,
      qrcode: true
    });
  }

  async getInstanceStatus(instanceName = this.defaultInstance) {
    try {
      const result = await this.request('get', `/instance/connectionState/${instanceName}`);
      if (!result) return 'DISCONNECTED';
      
      const state = result.instance?.state || result.state || result.connectionState || 'DISCONNECTED';
      return state.toUpperCase();
    } catch (error) {
      if (error.response?.status === 404) {
        return 'INSTANCE_NOT_FOUND';
      }
      return 'DISCONNECTED';
    }
  }

  async getQrCode(instanceName = this.defaultInstance) {
    return this.request('get', `/instance/connect/${instanceName}`);
  }

  async logoutInstance(instanceName = this.defaultInstance) {
    try {
      return await this.request('post', `/instance/logout/${instanceName}`).catch(async () => {
        return await this.request('delete', `/instance/logout/${instanceName}`);
      });
    } catch (e) {
      return null;
    }
  }

  async deleteInstance(instanceName = this.defaultInstance) {
    try {
      return await this.request('delete', `/instance/delete/${instanceName}`);
    } catch (e) {
      return null;
    }
  }

  // Messaging
  async sendMessage(number, text, instanceName = this.defaultInstance) {
    let target = number;
    if (!target.includes('@')) {
      target = target.replace(/\D/g, '');
      if (target.length === 10) target = '91' + target;
    }
    
    return this.request('post', `/message/sendText/${instanceName}`, {
      number: target,
      textMessage: {
        text: text
      },
      delay: 1200
    });
  }

  formatJid(number) {
    let sanitizedNumber = number.replace(/\D/g, '');
    if (sanitizedNumber.length === 10) {
      sanitizedNumber = '91' + sanitizedNumber;
    }
    return `${sanitizedNumber}@s.whatsapp.net`;
  }

  async sendMedia(number, caption, mediaPathOrBase64, mediaType = 'image', instanceName = this.defaultInstance) {
    const jid = number.includes('@') ? number : this.formatJid(number);
    
    let media = mediaPathOrBase64;
    if (media.startsWith('data:')) {
      media = media.split(',')[1];
    }

    const payload = {
      number: jid,
      mediaMessage: {
        mediatype: mediaType,
        caption: caption,
        media: media,
        delay: 1200
      }
    };

    return this.request('post', `/message/sendMedia/${instanceName}`, payload);
  }

  async setWebhook(url, instanceName = this.defaultInstance) {
    return this.request('post', `/webhook/set/${instanceName}`, {
      url: url,
      enabled: true,
      events: ['MESSAGES_UPSERT', 'QRCODE_UPDATED', 'CONNECTION_UPDATE']
    });
  }
}

module.exports = new EvolutionAPI();
