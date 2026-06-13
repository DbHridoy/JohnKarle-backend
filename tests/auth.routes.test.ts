import request from "supertest";
import { describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.LOG_LEVEL = "silent";

const { createApp } = await import("../src/app.js");

const app = createApp();

describe("app routes", () => {
  it("returns service health", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Service health fetched successfully.",
      data: {
        status: "ok",
      },
    });
  });

  it("validates register payloads before reaching persistence", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      email: "not-an-email",
      name: "A",
      password: "short",
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Validation failed",
    });
    expect(response.body.errors[0]).toMatchObject({
      path: "email",
    });
  });

  it("requires an access token for the current-user route", async () => {
    const response = await request(app).get("/api/v1/auth/me");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      message: "Authentication token is required.",
      errors: [{ code: "AUTH_REQUIRED", message: "Authentication token is required." }],
    });
  });

  it("validates forgot-password email payloads", async () => {
    const response = await request(app).post("/api/v1/auth/forgot-password").send({
      email: "bad-email",
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Validation failed",
    });
  });

  it("validates password reset code payloads", async () => {
    const response = await request(app).post("/api/v1/auth/forgot-password/verify-code").send({
      email: "user@example.com",
      code: "12345",
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Validation failed",
    });
  });

  it("validates password reset confirmation payloads", async () => {
    const response = await request(app).post("/api/v1/auth/forgot-password/reset").send({
      email: "user@example.com",
      resetToken: "token",
      password: "Password1",
      confirmPassword: "Password2",
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Validation failed",
    });
  });
});
