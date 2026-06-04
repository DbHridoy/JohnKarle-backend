import mongoose from "mongoose";

import { env } from "./env.config.js";
import { logger } from "../utils/logger.js";

export const connectDatabase = async (): Promise<void> => {
  mongoose.set("strictQuery", true);

  await mongoose.connect(env.MONGODB_URI);
  logger.info({ database: mongoose.connection.name }, "database connected");
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
  logger.info("database disconnected");
};
