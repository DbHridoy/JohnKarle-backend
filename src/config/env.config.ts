import "dotenv/config";

import { bool, cleanEnv, num, port, str } from "envalid";

const developmentJwtSecret = "development-only-change-me-to-a-long-random-secret";

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "test", "production"],
    default: "development",
  }),
  PORT: port({ default: 5200 }),
  LOG_LEVEL: str({ default: "info" }),
  MONGODB_URI: str({ default: "mongodb://127.0.0.1:27017/john_karle" }),
  CORS_ORIGIN: str({ default: "*" }),
  JWT_SECRET: str({ default: developmentJwtSecret }),
  JWT_ACCESS_EXPIRES_IN: str({ default: "15m" }),
  JWT_REFRESH_EXPIRES_IN: str({ default: "30d" }),
  BCRYPT_SALT_ROUNDS: num({ default: 12 }),
  SUPER_ADMIN_NAME: str({ default: "Super Admin" }),
  SUPER_ADMIN_EMAIL: str({ default: "" }),
  SUPER_ADMIN_PASSWORD: str({ default: "" }),
  SMTP_SECURE: bool({ default: false }),
  OUTLOOK_EMAIL: str({ default: "" }),
  OUTLOOK_PASSWORD: str({ default: "" }),
  PASSWORD_RESET_CODE_EXPIRES_MINUTES: num({ default: 10 }),
  PASSWORD_RESET_TOKEN_EXPIRES_MINUTES: num({ default: 15 }),
  AWS_REGION: str({ default: process.env.S3_REGION ?? "" }),
  S3_BUCKET_NAME: str({
    default:
      process.env.AWS_S3_BUCKET_NAME ?? process.env.S3_BUCKET ?? process.env.BUCKET_NAME ?? "",
  }),
  AWS_ACCESS_KEY_ID: str({ default: "" }),
  AWS_SECRET_ACCESS_KEY: str({ default: "" }),
  APP_BASE_URL: str({ default: "http://localhost:3000" }),
});

if (env.NODE_ENV === "production" && env.JWT_SECRET === developmentJwtSecret) {
  throw new Error("JWT_SECRET must be set to a strong value in production.");
}
