import { Server } from "socket.io";

import { config } from "../configs/index.js";
import { authenticateSocket } from "../middlewares/socketAuth.middleware.js";
import { registerSupportChatHandlers } from "./supportChat.socket.js";

export const createSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: config.client_url,
      methods: ["GET", "POST"],
      credentials: true,
    },

    serveClient: false,
  });

  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    console.log(
      `Socket connected: ${socket.id} | User: ${socket.data.user.id}`,
    );

    registerSupportChatHandlers(io, socket);

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${socket.id} | Reason: ${reason}`);
    });
  });

  return io;
};
