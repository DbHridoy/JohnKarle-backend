import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { randomInt, randomUUID } from "node:crypto";

import { env } from "../../config/env.config.js";
import { ApiError } from "../../utils/api-error.util.js";
import { getMailTransporter } from "../../utils/mail.util.js";
import { toPublicUser } from "../users/user.presenter.js";
import { UserModel, type UserDocument } from "../users/user.model.js";
import { createAuthTokens, verifyToken } from "./auth.tokens.js";
import type { AuthResponse } from "./auth.types.js";
import type {
  ForgotPasswordRequestInput,
  LoginInput,
  RefreshInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyPasswordResetCodeInput,
} from "./auth.validation.js";

const invalidCredentialsError = new ApiError(
  401,
  "Email or password is incorrect.",
  "INVALID_CREDENTIALS",
);

const passwordResetCodeError = new ApiError(
  400,
  "Password reset code is invalid or expired.",
  "INVALID_PASSWORD_RESET_CODE",
);

const passwordResetTokenError = new ApiError(
  400,
  "Password reset session is invalid or expired.",
  "INVALID_PASSWORD_RESET_TOKEN",
);

const hashSecret = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex");

const buildFutureDate = (minutes: number): Date => new Date(Date.now() + minutes * 60 * 1000);

const buildPasswordResetCodeEmail = (name: string, code: string): string =>
  [
    `Hello ${name},`,
    "",
    `Your password reset code is ${code}.`,
    `This code will expire in ${env.PASSWORD_RESET_CODE_EXPIRES_MINUTES} minutes.`,
    "",
    "If you did not request a password reset, you can ignore this email.",
  ].join("\n");

const sendPasswordResetCodeEmail = async (
  recipientEmail: string,
  recipientName: string,
  code: string,
): Promise<void> => {
  const mailTransporter = getMailTransporter();

  await mailTransporter.sendMail({
    from: env.OUTLOOK_EMAIL,
    to: recipientEmail,
    subject: "Password reset code",
    text: buildPasswordResetCodeEmail(recipientName, code),
  });
};

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
  const user = await UserModel.findOne({ email })
    .select("+passwordHash +invitationTokenHash +invitationExpiresAt")
    .exec();

  if (!user) {
    throw invalidCredentialsError;
  }

  if (user.invitationTokenHash) {
    if (user.invitationExpiresAt && user.invitationExpiresAt.getTime() < Date.now()) {
      throw new ApiError(400, "Invitation has expired.", "INVITATION_EXPIRED");
    }

    throw new ApiError(403, "Invitation must be accepted before login.", "INVITATION_PENDING");
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

export const requestPasswordResetCode = async (
  input: ForgotPasswordRequestInput,
): Promise<{ message: string }> => {
  const email = input.email.trim().toLowerCase();
  const user = await UserModel.findOne({ email }).exec();

  if (!user) {
    return {
      message: "If an account exists for this email, a password reset code has been sent.",
    };
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");

  user.passwordResetCodeHash = hashSecret(code);
  user.passwordResetCodeExpiresAt = buildFutureDate(env.PASSWORD_RESET_CODE_EXPIRES_MINUTES);
  user.passwordResetTokenHash = undefined;
  user.passwordResetTokenExpiresAt = undefined;

  await user.save();
  await sendPasswordResetCodeEmail(user.email, user.name, code);

  return {
    message: "If an account exists for this email, a password reset code has been sent.",
  };
};

export const verifyPasswordResetCode = async (
  input: VerifyPasswordResetCodeInput,
): Promise<{ message: string; resetToken: string }> => {
  const email = input.email.trim().toLowerCase();
  const user = await UserModel.findOne({ email })
    .select(
      "+passwordResetCodeHash +passwordResetCodeExpiresAt +passwordResetTokenHash +passwordResetTokenExpiresAt",
    )
    .exec();

  if (
    !user ||
    !user.passwordResetCodeHash ||
    !user.passwordResetCodeExpiresAt ||
    user.passwordResetCodeExpiresAt.getTime() < Date.now() ||
    user.passwordResetCodeHash !== hashSecret(input.code)
  ) {
    throw passwordResetCodeError;
  }

  const resetToken = randomUUID();

  user.passwordResetCodeHash = undefined;
  user.passwordResetCodeExpiresAt = undefined;
  user.passwordResetTokenHash = hashSecret(resetToken);
  user.passwordResetTokenExpiresAt = buildFutureDate(env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES);

  await user.save();

  return {
    message: "Password reset code verified successfully.",
    resetToken,
  };
};

export const resetPassword = async (input: ResetPasswordInput): Promise<{ message: string }> => {
  const email = input.email.trim().toLowerCase();
  const user = await UserModel.findOne({ email })
    .select("+passwordHash +passwordResetTokenHash +passwordResetTokenExpiresAt")
    .exec();

  if (
    !user ||
    !user.passwordResetTokenHash ||
    !user.passwordResetTokenExpiresAt ||
    user.passwordResetTokenExpiresAt.getTime() < Date.now() ||
    user.passwordResetTokenHash !== hashSecret(input.resetToken)
  ) {
    throw passwordResetTokenError;
  }

  user.passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);
  user.refreshTokenVersion += 1;
  user.passwordResetTokenHash = undefined;
  user.passwordResetTokenExpiresAt = undefined;

  await user.save();

  return {
    message: "Password has been reset successfully.",
  };
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
