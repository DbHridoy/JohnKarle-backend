import bcrypt from "bcrypt";

import { ApiError } from "../../utils/api-error.util.js";
import { UserModel } from "../users/user.model.js";

export const requireRecentPasswordReauth = async (
  userId: string,
  currentPassword: string,
): Promise<void> => {
  const user = await UserModel.findById(userId).select("+passwordHash").exec();

  if (!user) {
    throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
  }

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!matches) {
    throw new ApiError(401, "Current password is incorrect.", "REAUTH_REQUIRED");
  }
};
