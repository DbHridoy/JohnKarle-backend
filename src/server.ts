import { app } from "./app.js";
import { env } from "./config/env.config.js";
import { connectDatabase, disconnectDatabase } from "@/config/db.config.js";
import { ensureSuperAdmin } from "./modules/users/user.seed.js";
import { logger } from "./utils/logger.util.js";

const startServer = async (): Promise<void> => {
  await connectDatabase();
  await ensureSuperAdmin();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "server listening");
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info({ signal }, "shutdown signal received");

    server.close(() => {
      void disconnectDatabase()
        .catch((error: unknown) => {
          logger.error({ err: error }, "database disconnect failed");
        })
        .finally(() => {
          process.exit(0);
        });
    });

    setTimeout(() => {
      logger.error("forced shutdown after timeout");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

void startServer().catch((error: unknown) => {
  logger.error({ err: error }, "failed to start server");
  process.exit(1);
});
