import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "../../config/env.config.js";
import { ApiError } from "../../utils/api-error.js";
import type { AuthenticatedUser, AuthTokens, JwtPayload, TokenType } from "./auth.types.js";

type TokenSubject = Pick<AuthenticatedUser, "id" | "email" | "role" | "tokenVersion">;

const isJwtPayload = (payload: string | jwt.JwtPayload): payload is JwtPayload =>
  typeof payload !== "string" &&
  typeof payload.sub === "string" &&
  typeof payload.email === "string" &&
  typeof payload.role === "string" &&
  typeof payload.tokenVersion === "number" &&
  (payload.type === "access" || payload.type === "refresh");

const signToken = (subject: TokenSubject, type: TokenType): string => {
  const expiresIn = type === "access" ? env.JWT_ACCESS_EXPIRES_IN : env.JWT_REFRESH_EXPIRES_IN;

  const payload: JwtPayload = {
    email: subject.email,
    role: subject.role,
    sub: subject.id,
    tokenVersion: subject.tokenVersion,
    type,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: expiresIn as SignOptions["expiresIn"],
  });
};

export const createAuthTokens = (subject: TokenSubject): AuthTokens => ({
  accessToken: signToken(subject, "access"),
  refreshToken: signToken(subject, "refresh"),
  tokenType: "Bearer",
  expiresIn: env.JWT_ACCESS_EXPIRES_IN,
});

export const verifyToken = (token: string, expectedType: TokenType): JwtPayload => {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);

    if (!isJwtPayload(payload) || payload.type !== expectedType) {
      throw new ApiError(401, "Token is invalid.", "INVALID_TOKEN");
    }

    return payload;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // if (error instanceof TokenExpiredError) {
    //   throw new ApiError(401, "Token has expired.", "TOKEN_EXPIRED");
    // }

    // if (error instanceof JsonWebTokenError) {
    //   throw new ApiError(401, "Token is invalid.", "INVALID_TOKEN");
    // }

    throw error;
  }
};
