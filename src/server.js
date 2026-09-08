import "dotenv/config";
import { createServer } from "node:http";
import app from "./app.js";
import { config } from "./configs/index.js";
import {
  startCheckoutExpirationJob,
  stopCheckoutExpirationJob,
} from "./jobs/checkout-expiration.job.js";
import { createSocketServer } from "./sockets/index.js";
import { shutdown } from "./utils/shutdown.js";

const PORT = config.port;
const httpServer = createServer(app);

const io = createSocketServer(httpServer);
app.set("io", io);
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startCheckoutExpirationJob();
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
