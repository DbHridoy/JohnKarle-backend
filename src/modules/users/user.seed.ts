import bcrypt from "bcrypt";

import { env } from "../../config/env.config.js";
import { logger } from "../../utils/logger.js";
import { UserModel } from "./user.model.js";

export const ensureSuperAdmin = async (): Promise<void> => {
  if (!env.SUPER_ADMIN_EMAIL || !env.SUPER_ADMIN_PASSWORD) {
    return;
  }

  const email = env.SUPER_ADMIN_EMAIL.trim().toLowerCase();
  const existingUser = await UserModel.exists({ email }).exec();

  if (existingUser) {
    return;
  }

  const passwordHash = await bcrypt.hash(env.SUPER_ADMIN_PASSWORD, env.BCRYPT_SALT_ROUNDS);

  await UserModel.create({
    email,
    isEmailVerified: true,
    name: env.SUPER_ADMIN_NAME || "Super Admin",
    passwordHash,
    role: "super_admin",
  });

  logger.info({ email }, "super admin user seeded");
};
