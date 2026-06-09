import crypto from "node:crypto";

export const generateSecureToken = (size = 32): string =>
  crypto.randomBytes(size).toString("base64url");

export const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

export const verifyTokenHash = (rawToken: string, storedHash: string): boolean => {
  const rawHash = hashToken(rawToken);
  const rawBuffer = Buffer.from(rawHash, "hex");
  const storedBuffer = Buffer.from(storedHash, "hex");

  if (rawBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(rawBuffer, storedBuffer);
};
