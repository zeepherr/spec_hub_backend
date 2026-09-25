import "dotenv/config";
import { createServer } from "node:http";
import app from "./app.js";
import { config, validateRuntimeConfig } from "./configs/index.js";
import {
  startCheckoutExpirationJob,
  stopCheckoutExpirationJob,
} from "./jobs/checkout-expiration.job.js";
import { createSocketServer } from "./sockets/index.js";
import { verifyEmailTransport } from "./utils/mailjet-email.util.js";
import { shutdown } from "./utils/shutdown.js";

const PORT = config.port;
const httpServer = createServer(app);

const io = createSocketServer(httpServer);
app.set("io", io);

const startServer = async () => {
  validateRuntimeConfig();

  try {
    await verifyEmailTransport();
    console.info("Email transport verified");
  } catch (error) {
    console.error("Email transport verification failed", {
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      message: error.message,
    });
  }

  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startCheckoutExpirationJob();
  });
};

startServer().catch((error) => {
  console.error("Server startup failed", {
    name: error.name,
    message: error.message,
  });
  process.exitCode = 1;
});

const handleShutdown = (signal) => {
  stopCheckoutExpirationJob();
  /*
   * Disconnect active Socket.IO clients so the HTTP server
   * can shut down cleanly.
   */
  io.disconnectSockets(true);
  void shutdown(httpServer, signal);
};

process.once("SIGINT", () => handleShutdown("SIGINT"));
process.once("SIGTERM", () => handleShutdown("SIGTERM"));
