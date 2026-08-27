import { prisma } from "../lib/prisma.js";
export async function shutdown(server, signal) {
  console.log(`${signal} received. Shutting down...`);

  server.close(async () => {
    await prisma.$disconnect();
    console.log("Server and database disconnected.");
    process.exit(0);
  });
}
