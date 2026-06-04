import type { PublicUser, UserRole } from "../users/user.types.js";

export type TokenType = "access" | "refresh";

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  tokenVersion: number;
  type: TokenType;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: UserRole;
  tokenVersion: number;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: string;
};

export type AuthResponse = {
  user: PublicUser;
  tokens: AuthTokens;
};
