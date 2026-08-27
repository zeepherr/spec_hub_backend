import "dotenv/config";
import app from "./app.js";
import { config } from "./configs/index.js";
import { shutdown } from "./utils/shutdown.js";

const PORT = config.port;
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on("SIGINT", () => shutdown(server, "SIGINT"));
process.on("SIGTERM", () => shutdown(server, "SIGTERM"));
