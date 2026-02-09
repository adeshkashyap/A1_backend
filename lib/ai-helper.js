const axios = require('axios');
const { client: redis } = require('../src/utils/redis');
const logger = require('./logger');

const AI_CACHE_TTL = 300; // 5 minutes
const AI_RATE_LIMIT = 10;
const AI_RATE_WINDOW = 60;

async function askAI(
  prompt,
  systemInstruction = `You are a warm, polite property assistant for "ApnaCodex".`,
  phoneNumber = 'default'
) {
  const cacheKey = `ai_cache:${phoneNumber}:${Buffer.from(prompt).toString('base64').substring(0, 32)}`;

  try {
    // 1. Rate Limiting (10 calls/min per customer)
    if (redis.isOpen) {
      const rateKey = `ai_rate_limit:${phoneNumber}`;
      const count = await redis.incr(rateKey);
      if (count === 1) await redis.expire(rateKey, AI_RATE_WINDOW);
      
      if (count > AI_RATE_LIMIT) {
        logger.warn(`[AI] Rate limit exceeded for customer: ${phoneNumber}`);
        return "I'm receiving too many messages right now. Please wait a moment! 🙏";
      }
    }

    // 2. Redis Cache (5min TTL)
    if (redis.isOpen) {
      const cachedResponse = await redis.get(cacheKey);
      if (cachedResponse) {
        logger.info(`[AI] Cache hit for ${phoneNumber}`);
        return cachedResponse;
      }
    }

    // 3. AI Call with Timeout
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'mistralai/mistral-7b-instruct:free',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://apnacodex.com',
          'X-Title': 'ApnaCodex Property Assistant',
        },
        timeout: 10000 // 10 second timeout
      }
    );

    const result = response.data.choices[0].message.content.trim();

    // 4. Update Cache
    if (redis.isOpen && result) {
      await redis.set(cacheKey, result, { EX: AI_CACHE_TTL });
    }

    return result;
  } catch (error) {
    logger.error('[AI Error]:', error.response?.data || error.message);
    
    // 5. Fallback Responses
    const fallbacks = [
      "I'm having a bit of trouble connecting right now. One of our experts will get back to you shortly! 🏠",
      "Thanks for your message! Our team will assist you with the property details soon. 😊",
      "Processing your request... In the meantime, feel free to browse our latest listings on the dashboard! 🚀"
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

async function extractRequirements(text, companyProfile = {}, phoneNumber = 'unknown') {
  const systemInstruction = `You are a real estate assistant for ${companyProfile.companyName || 'ApnaCodex'}.
Extract property requirements from the user's message.
Return ONLY a JSON object with these fields (use null if not found):
- bhk (number, e.g., 2, 3)
- budget (number, total price in INR)
- location (string)
- type (string, e.g., "flat", "villa")
- transactionType (string, "buy" or "rent")`;

  try {
    const aiResponse = await askAI(text, systemInstruction, phoneNumber);
    if (!aiResponse || aiResponse.includes('experts will get back')) return {};
    
    const jsonStr = aiResponse.replace(/```json|```/g, '').trim();
    const requirements = JSON.parse(jsonStr);
    
    // Track Accuracy Metric (Simple log for now)
    logger.info(`[AI Metrics] Extraction Accuracy tracked for ${phoneNumber}`, { requirements });
    
    return requirements;
  } catch (error) {
    logger.error('[AI Extraction Error]:', error.message);
    return {};
  }
}

module.exports = { askAI, extractRequirements };
