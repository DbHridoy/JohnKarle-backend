import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.LOG_LEVEL = "silent";

const verifyTokenMock = vi.fn();
const listMemoriesMock = vi.fn();
const getTimelineMock = vi.fn();

vi.mock("../src/modules/auth/auth.tokens.js", () => ({
  verifyToken: verifyTokenMock,
}));

vi.mock("../src/modules/legacy-access/legacy-access.activity.js", () => ({
  trackAuthenticatedUserActivity: (_req: unknown, _res: unknown, next: (error?: unknown) => void) =>
    next(),
}));

vi.mock("../src/modules/memory-vault/memory-vault.service.js", () => ({
  listMemories: listMemoriesMock,
  getTimeline: getTimelineMock,
  createMemory: vi.fn(),
  getMemory: vi.fn(),
  updateMemory: vi.fn(),
  deleteMemory: vi.fn(),
}));

const { createApp } = await import("../src/app.js");
const { UserModel } = await import("../src/modules/users/user.model.js");

const app = createApp();

const authHeadersFor = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

const mockExecResolved = <T>(value: T) => ({
  exec: vi.fn().mockResolvedValue(value),
});

describe("memory vault routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    verifyTokenMock.mockImplementation((token: string) => {
      if (token === "user-token") {
        return {
          sub: "507f1f77bcf86cd799439013",
          email: "user@example.com",
          role: "user",
          tokenVersion: 0,
          type: "access",
        };
      }

      throw new Error("invalid token");
    });

    vi.spyOn(UserModel, "findById").mockImplementation((userId: string) => {
      if (userId === "507f1f77bcf86cd799439013") {
        return mockExecResolved({
          _id: userId,
          email: "user@example.com",
          role: "user",
          refreshTokenVersion: 0,
        }) as never;
      }

      return mockExecResolved(null) as never;
    });

    listMemoriesMock.mockResolvedValue([]);
    getTimelineMock.mockResolvedValue([]);
  });

  it("requires an access token to list memories", async () => {
    const response = await request(app).get("/api/v1/memory-vault");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      message: "Authentication token is required.",
    });
  });

  it("requires an access token to fetch the timeline", async () => {
    const response = await request(app).get("/api/v1/memory-vault/timeline");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      message: "Authentication token is required.",
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
      message: "Authentication token is required.",
    });
  });

  it("validates family member user id filters after authentication", async () => {
    const response = await request(app)
      .get("/api/v1/memory-vault/timeline?familyMemberUserId=bad-id")
      .set(authHeadersFor("user-token"));

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Validation failed",
    });
  });

  it("passes validated query filters to list memories without touching getter-only req.query", async () => {
    const response = await request(app)
      .get("/api/v1/memory-vault?familyMemberUserId=507f1f77bcf86cd799439099")
      .set(authHeadersFor("user-token"));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Memories fetched successfully.",
      data: [],
    });
    expect(listMemoriesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "507f1f77bcf86cd799439013",
      }),
      {
        familyMemberUserId: "507f1f77bcf86cd799439099",
      },
    );
  });

  it("passes validated query filters to timeline without touching getter-only req.query", async () => {
    const response = await request(app)
      .get("/api/v1/memory-vault/timeline?familyMemberUserId=507f1f77bcf86cd799439099")
      .set(authHeadersFor("user-token"));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Memory timeline fetched successfully.",
      data: [],
    });
    expect(getTimelineMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "507f1f77bcf86cd799439013",
      }),
      {
        familyMemberUserId: "507f1f77bcf86cd799439099",
      },
    );
  });
});
