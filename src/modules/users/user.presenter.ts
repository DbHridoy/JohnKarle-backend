import type { PublicUser } from "./user.types.js";
import type { UserDocument } from "./user.model.js";

export const toPublicUser = (user: UserDocument): PublicUser => ({
  id: user._id.toString(),
  name: user.name,
  ...(user.phoneNumber ? { phoneNumber: user.phoneNumber } : {}),
  email: user.email,
  role: user.role,
  isEmailVerified: user.isEmailVerified,
  ...(user.address ? { address: user.address } : {}),
  ...(user.profilePicture ? { profilePicture: user.profilePicture } : {}),
  familyMembers: user.familyMembers,
  preferences: user.preferences,
  ...(user.lastLoginAt ? { lastLoginAt: user.lastLoginAt.toISOString() } : {}),
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});
