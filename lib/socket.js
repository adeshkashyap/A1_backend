const { Server } = require("socket.io");
const logger = require("./logger");

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        "https://apnacodex.com",
        "https://apnacodex-dashboard-769037307043.asia-south1.run.app",
        "http://localhost:3000",
        "http://localhost:3002",
        "http://localhost:5173", // For local dev
        "http://localhost:5174", // For local dev
      ],
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    logger.info("New socket connection", { socketId: socket.id });

    // Join room based on dealerId for multi-tenancy security
    socket.on("join", (dealerId) => {
      if (dealerId) {
        socket.join(`dealer_${dealerId}`);
        logger.info(`Socket ${socket.id} joined dealer_${dealerId}`);
      }
    });

    socket.on("disconnect", () => {
      logger.info("Socket disconnected", { socketId: socket.id });
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

// Helper to emit to a specific dealer
const emitToDealer = (dealerId, event, data) => {
  try {
    const io = getIO();
    io.to(`dealer_${dealerId}`).emit(event, data);
    logger.info(`Emitted ${event} to dealer_${dealerId}`);
  } catch (error) {
    logger.error("Failed to emit socket event", error);
  }
};

module.exports = { initSocket, getIO, emitToDealer };
