import bcrypt from "bcrypt";

import { env } from "../../config/env.config.js";
import { ApiError } from "../../utils/api-error.util.js";
import { toPublicUser } from "../users/user.presenter.js";
import { UserModel, type UserDocument } from "../users/user.model.js";
import { createAuthTokens, verifyToken } from "./auth.tokens.js";
import type { AuthResponse } from "./auth.types.js";
import type { LoginInput, RefreshInput, RegisterInput } from "./auth.validation.js";

const invalidCredentialsError = new ApiError(
  401,
  "Email or password is incorrect.",
  "INVALID_CREDENTIALS",
);

const buildAuthResponse = (user: UserDocument): AuthResponse => {
  const publicUser = toPublicUser(user);

  return {
    user: publicUser,
    tokens: createAuthTokens({
      email: publicUser.email,
      id: publicUser.id,
      role: publicUser.role,
      tokenVersion: user.refreshTokenVersion,
    }),
  };
};

export const register = async (input: RegisterInput): Promise<AuthResponse> => {
  const email = input.email.trim().toLowerCase();
  const existingUser = await UserModel.exists({ email }).exec();

  if (existingUser) {
    throw new ApiError(409, "An account with this email already exists.", "EMAIL_ALREADY_EXISTS");
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

  const user = await UserModel.create({
    email,
    name: input.name.trim(),
    passwordHash,
  });

  return buildAuthResponse(user);
};

export const login = async (input: LoginInput): Promise<AuthResponse> => {
  const email = input.email.trim().toLowerCase();
  const user = await UserModel.findOne({ email }).select("+passwordHash").exec();

  if (!user) {
    throw invalidCredentialsError;
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw invalidCredentialsError;
  }

  user.lastLoginAt = new Date();
  await user.save();

  return buildAuthResponse(user);
};

export const refresh = async (input: RefreshInput): Promise<AuthResponse> => {
  const payload = verifyToken(input.refreshToken, "refresh");
  const user = await UserModel.findById(payload.sub).exec();

  if (!user || user.refreshTokenVersion !== payload.tokenVersion) {
    throw new ApiError(401, "Refresh token is invalid.", "INVALID_REFRESH_TOKEN");
  }

  return buildAuthResponse(user);
};

export const getProfile = async (userId: string) => {
  const user = await UserModel.findById(userId).exec();

  if (!user) {
    throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
  }

  return toPublicUser(user);
};

export const logout = async (userId: string): Promise<void> => {
  await UserModel.findByIdAndUpdate(userId, {
    $inc: { refreshTokenVersion: 1 },
  }).exec();
};
