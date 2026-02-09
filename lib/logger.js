const os = require("os");
const HOSTNAME = os.hostname();

const logger = {
  formatMessage: (level, message, context = {}) => {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      hostname: HOSTNAME,
      ...context,
    });
  },

  info: (message, context = {}) => {
    console.log(logger.formatMessage("INFO", message, context));
  },

  warn: (message, context = {}) => {
    console.warn(logger.formatMessage("WARN", message, context));
  },

  error: (message, error = null, context = {}) => {
    const errorDetails = error
      ? {
          errorMessage: error.message,
          stack: error.stack,
          code: error.code,
          response: error.response?.data,
        }
      : {};

    console.error(
      logger.formatMessage("ERROR", message, { ...context, ...errorDetails }),
    );
  },

  // Specialized HTTP request logger middleware
  requestLogger: (req, res, next) => {
    const start = Date.now();
    req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Log Request
    logger.info(`Incoming ${req.method} ${req.url}`, {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      query: req.query,
      // Be careful logging body with passwords/sensitive data
      body:
        req.method === "POST" || req.method === "PUT"
          ? req.url.includes("auth")
            ? "[REDACTED]"
            : req.body
          : undefined,
      ip: req.ip,
    });

    // Capture Response
    const originalSend = res.send;
    res.send = function (body) {
      res.responseBody = body;
      return originalSend.apply(this, arguments);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      const level = res.statusCode >= 400 ? "WARN" : "INFO";

      const logData = {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
      };

      if (res.statusCode >= 400) {
        // Safe parsing of response body for errors
        try {
          const parsedBody =
            typeof res.responseBody === "string"
              ? JSON.parse(res.responseBody)
              : res.responseBody;
          logData.responseError = parsedBody;
        } catch (e) {
          logData.responseError = res.responseBody;
        }
      }

      if (res.statusCode >= 500) {
        logger.error(`Request Failed ${req.method} ${req.url}`, null, logData);
      } else {
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level,
            message: `Completed ${req.method} ${req.url}`,
            ...logData,
          }),
        );
      }
    });

    next();
  },
};

module.exports = logger;
