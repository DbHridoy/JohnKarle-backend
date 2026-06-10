import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.LOG_LEVEL = "silent";

const memoryVaultService = await import("../src/modules/memory-vault/memory-vault.service.js");
const { MemoryVaultModel } = await import("../src/modules/memory-vault/memory-vault.model.js");
const { UserModel } = await import("../src/modules/users/user.model.js");

const mockExecResolved = <T>(value: T) => ({
  exec: vi.fn().mockResolvedValue(value),
});

describe("memory vault service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("allows timeline access for accepted family members", async () => {
    const requesterId = new Types.ObjectId();
    const familyMemberId = new Types.ObjectId();
    const requester = new UserModel({
      _id: requesterId,
      name: "Requester",
      email: "requester@example.com",
      passwordHash: "hash",
      role: "user",
      isEmailVerified: true,
      familyMembers: [
        {
          userId: familyMemberId.toString(),
          name: "Brother A",
          email: "brother@example.com",
          relation: "brother",
          role: "viewer",
          status: "accepted",
        },
      ],
      preferences: {
        notifications: true,
        aiInsight: true,
        darkMode: false,
        anonymousAnalytics: true,
      },
      refreshTokenVersion: 0,
      legacyAccessEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(UserModel, "findById").mockReturnValue(mockExecResolved(requester) as never);
    vi.spyOn(MemoryVaultModel, "find").mockReturnValue({
      sort: vi.fn().mockReturnValue(
        mockExecResolved([
          {
            _id: new Types.ObjectId(),
            userId: familyMemberId,
            type: "journal",
            whoseMemoryIsThis: "Brother A",
            files: [],
            title: "Entry",
            narrative: "Story",
            date: new Date("2026-06-10T00:00:00.000Z"),
            tags: ["family"],
            createdAt: new Date("2026-06-10T00:00:00.000Z"),
            updatedAt: new Date("2026-06-10T00:00:00.000Z"),
          },
        ]),
      ),
    } as never);

    const timeline = await memoryVaultService.getTimeline(
      {
        id: requesterId.toString(),
        email: "requester@example.com",
        role: "user",
        tokenVersion: 0,
      },
      { familyMemberUserId: familyMemberId.toString() },
    );

    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.memories[0]?.whoseMemoryIsThis).toBe("Brother A");
  });

  it("rejects timeline access for users who are not accepted family members", async () => {
    const requesterId = new Types.ObjectId();
    const familyMemberId = new Types.ObjectId();
    const requester = new UserModel({
      _id: requesterId,
      name: "Requester",
      email: "requester@example.com",
      passwordHash: "hash",
      role: "user",
      isEmailVerified: true,
      familyMembers: [],
      preferences: {
        notifications: true,
        aiInsight: true,
        darkMode: false,
        anonymousAnalytics: true,
      },
      refreshTokenVersion: 0,
      legacyAccessEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(UserModel, "findById").mockReturnValue(mockExecResolved(requester) as never);

    await expect(
      memoryVaultService.getTimeline(
        {
          id: requesterId.toString(),
          email: "requester@example.com",
          role: "user",
          tokenVersion: 0,
        },
        { familyMemberUserId: familyMemberId.toString() },
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
