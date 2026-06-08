import request from "supertest";
import { describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.LOG_LEVEL = "silent";

const { createApp } = await import("../src/app.js");

const app = createApp();

describe("user profile routes", () => {
  it("requires an access token to fetch the current profile", async () => {
    const response = await request(app).get("/api/v1/users/profile");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "AUTH_REQUIRED",
      },
    });
  });

  it("requires an access token to update the current profile", async () => {
    const response = await request(app)
      .patch("/api/v1/users/profile")
      .field("name", "Demo User")
      .field("notifications", "true");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "AUTH_REQUIRED",
      },
    });
  });
});
