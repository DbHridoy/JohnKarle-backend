import type { PublicUser } from "./user.types.js";
import type { UserDocument } from "./user.model.js";

export const toPublicUser = (user: UserDocument): PublicUser => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  isEmailVerified: user.isEmailVerified,
  ...(user.lastLoginAt ? { lastLoginAt: user.lastLoginAt.toISOString() } : {}),
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});
