import { describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "30d";

const { createAuthTokens, verifyToken } = await import("../src/modules/auth/auth.tokens.js");

describe("auth tokens", () => {
  const subject = {
    email: "user@example.com",
    id: "507f1f77bcf86cd799439011",
    role: "user" as const,
    tokenVersion: 0,
  };

  it("creates verifiable access and refresh tokens", () => {
    const tokens = createAuthTokens(subject);

    expect(tokens.tokenType).toBe("Bearer");
    expect(verifyToken(tokens.accessToken, "access")).toMatchObject({
      email: subject.email,
      sub: subject.id,
      type: "access",
    });
    expect(verifyToken(tokens.refreshToken, "refresh")).toMatchObject({
      email: subject.email,
      sub: subject.id,
      type: "refresh",
    });
  });

  it("rejects tokens used for the wrong token type", () => {
    const tokens = createAuthTokens(subject);

    expect(() => verifyToken(tokens.accessToken, "refresh")).toThrow("Token is invalid.");
  });
});
