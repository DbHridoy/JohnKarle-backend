import { ApiError } from "../../utils/api-error.util.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { toPublicUser } from "./user.presenter.js";
import { UserModel } from "./user.model.js";
import { deleteProfilePicture, uploadProfilePicture } from "./user.upload.js";
import type { UpdateProfileInput } from "./user.validation.js";

const findUserOrThrow = async (userId: string) => {
  const user = await UserModel.findById(userId).exec();

  if (!user) {
    throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
  }

  return user;
};

export const getProfile = async (authenticatedUser: AuthenticatedUser) => {
  const user = await findUserOrThrow(authenticatedUser.id);

  return toPublicUser(user);
};

export const updateProfile = async (
  authenticatedUser: AuthenticatedUser,
  input: UpdateProfileInput,
  profilePictureFile?: Express.Multer.File,
) => {
  const user = await findUserOrThrow(authenticatedUser.id);
  const previousProfilePicture = user.profilePicture;
  let uploadedProfilePicture: typeof user.profilePicture | undefined;

  try {
    if (profilePictureFile) {
      uploadedProfilePicture = await uploadProfilePicture(authenticatedUser.id, profilePictureFile);
      user.profilePicture = uploadedProfilePicture;
    }

    if (input.name !== undefined) {
      user.name = input.name;
    }

    if (input.phoneNumber !== undefined) {
      user.phoneNumber = input.phoneNumber;
    }

    if (input.address !== undefined) {
      user.address = input.address;
    }

    if (input.familyMembers !== undefined) {
      user.familyMembers = input.familyMembers;
    }

    user.preferences = {
      ...user.preferences,
      ...(input.notifications === undefined ? {} : { notifications: input.notifications }),
      ...(input.aiInsight === undefined ? {} : { aiInsight: input.aiInsight }),
      ...(input.darkMode === undefined ? {} : { darkMode: input.darkMode }),
      ...(input.anonymousAnalytics === undefined
        ? {}
        : { anonymousAnalytics: input.anonymousAnalytics }),
    };

    await user.save();

    if (profilePictureFile && previousProfilePicture) {
      await deleteProfilePicture(previousProfilePicture).catch(() => undefined);
    }

    return toPublicUser(user);
  } catch (error) {
    await deleteProfilePicture(uploadedProfilePicture).catch(() => undefined);
    throw error;
  }
};
