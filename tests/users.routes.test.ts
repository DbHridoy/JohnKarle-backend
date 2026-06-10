import request from "supertest";
import { describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.LOG_LEVEL = "silent";

const { createApp } = await import("../src/app.js");

const app = createApp();

describe("user profile routes", () => {
  it("validates invitation acceptance payloads", async () => {
    const response = await request(app).post("/api/v1/users/invitations/accept").send({});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
      },
    });
  });

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

  it("requires an access token to create an invitation", async () => {
    const response = await request(app).post("/api/v1/users/invitations").send({
      name: "Jane Doe",
      email: "jane@example.com",
      relation: "sister",
      role: "editor",
    });

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

  it("requires an access token to list family invitations", async () => {
    const response = await request(app).get("/api/v1/users/invitations");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "AUTH_REQUIRED",
      },
    });
  });

  it("requires an access token to list accepted family members", async () => {
    const response = await request(app).get("/api/v1/users/family-members");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "AUTH_REQUIRED",
      },
    });
  });
});
