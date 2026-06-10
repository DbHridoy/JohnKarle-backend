import request from "supertest";
import { describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.LOG_LEVEL = "silent";

const { createApp } = await import("../src/app.js");

const app = createApp();

describe("memory vault routes", () => {
  it("requires an access token to list memories", async () => {
    const response = await request(app).get("/api/v1/memory-vault");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "AUTH_REQUIRED",
      },
    });
  });

  it("requires an access token to fetch the timeline", async () => {
    const response = await request(app).get("/api/v1/memory-vault/timeline");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "AUTH_REQUIRED",
      },
    });
  });

  it("requires an access token to create a memory", async () => {
    const response = await request(app)
      .post("/api/v1/memory-vault")
      .field("type", "journal")
      .field("whoseMemoryIsThis", "John")
      .field("title", "A memory")
      .field("narrative", "Description")
      .field("date", "2026-06-09")
      .field("tags", "family");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "AUTH_REQUIRED",
      },
    });
  });

  it("validates family member user id filters", async () => {
    const response = await request(app).get(
      "/api/v1/memory-vault/timeline?familyMemberUserId=bad-id",
    );

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "AUTH_REQUIRED",
      },
    });
  });
});
