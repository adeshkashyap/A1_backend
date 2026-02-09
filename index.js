// ApnaCodex Core API - Production Build [2026-01-31]
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { initSocket } = require('./lib/socket');
const logger = require('./lib/logger');
const routes = require('./src/routes');
const { connectRedis } = require('./src/utils/redis');

// Clear Chromium locks (prevents WhatsApp initialization failure)
function clearLocks(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      clearLocks(fullPath);
    } else if (file === 'SingletonLock' || file === 'LOCK' || file.includes('SingletonCookie')) {
      try {
        fs.unlinkSync(fullPath);
        logger.info(`🗑️ Deleted lock file: ${fullPath}`);
      } catch (err) {
        // Ignore errors if file is already gone
      }
    }
  }
}

const authPath = path.resolve(__dirname, '.wwebjs_auth');
logger.info('🔍 Cleaning up WhatsApp session locks in:', { path: authPath });
clearLocks(authPath);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;


const { scheduleCleanup } = require('./src/utils/instance-cleanup');

// Initialize Services
initSocket(server);
connectRedis().then(() => {
  logger.info('✅ Redis connected, scheduling cleanup jobs...');
  scheduleCleanup();
}).catch(err => logger.error('Failed to connect Redis:', err));

// Middleware
app.use(cors({
  origin: [
    'https://apnacodex.com',
    'https://apnacodex-dashboard-769037307043.asia-south1.run.app',
    'http://localhost',      // Production-like local access
    'http://localhost:3000', // Explicit dashboard port
    'http://localhost:5173', // Vite dev server
    'http://localhost:3002', // Local container access
    'http://127.0.0.1'
  ],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Integrate Request Logger
app.use(logger.requestLogger);

// ============= PRODUCTION ENDPOINTS =============

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Metrics Skeleton
app.get('/metrics', (req, res) => {
  res.json({
    status: 'not_implemented',
    message: 'Prometheus metrics coming in next update'
  });
});

// =================== ROUTES ====================

// Use Modular Routes
app.use('/api', routes);

// ================== ERROR HANDLER ================

app.use((err, req, res, next) => {
  logger.error('Unhandled Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    requestId: req.id
  });
});

// ================== START SERVER ==================

server.listen(PORT, () => {
  logger.info(`🚀 ApnaCodex Core API running on port ${PORT}`);
  logger.info(`🔌 Environment: ${process.env.NODE_ENV || 'development'}`);
});
