import "dotenv/config";
import app from "./app.js";
import { config } from "./configs/index.js";
import {
  startCheckoutExpirationJob,
  stopCheckoutExpirationJob,
} from "./jobs/checkout-expiration.job.js";
import { shutdown } from "./utils/shutdown.js";

const PORT = config.port;
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startCheckoutExpirationJob();
});
const handleShutdown = (signal) => {
  stopCheckoutExpirationJob();

  void shutdown(server, signal);
};

process.once("SIGINT", () => handleShutdown(server, "SIGINT"));
process.once("SIGTERM", () => handleShutdown(server, "SIGTERM"));
