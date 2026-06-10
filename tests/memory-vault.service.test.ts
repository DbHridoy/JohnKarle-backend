import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.LOG_LEVEL = "silent";

const areAcceptedFamilyMembersMock = vi.fn();

vi.mock("../src/modules/users/user-family-membership.service.js", () => ({
  areAcceptedFamilyMembers: areAcceptedFamilyMembersMock,
}));

const memoryVaultService = await import("../src/modules/memory-vault/memory-vault.service.js");
const { MemoryVaultModel } = await import("../src/modules/memory-vault/memory-vault.model.js");

const mockExecResolved = <T>(value: T) => ({
  exec: vi.fn().mockResolvedValue(value),
});

describe("memory vault service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    areAcceptedFamilyMembersMock.mockReset();
  });

  it("allows list and timeline access for accepted family members", async () => {
    const requesterId = new Types.ObjectId();
    const familyMemberId = new Types.ObjectId();

    areAcceptedFamilyMembersMock.mockResolvedValue(true);
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

    const memories = await memoryVaultService.listMemories(
      {
        id: requesterId.toString(),
        email: "requester@example.com",
        role: "user",
        tokenVersion: 0,
      },
      { familyMemberUserId: familyMemberId.toString() },
    );
    const timeline = await memoryVaultService.getTimeline(
      {
        id: requesterId.toString(),
        email: "requester@example.com",
        role: "user",
        tokenVersion: 0,
      },
      { familyMemberUserId: familyMemberId.toString() },
    );

    expect(memories).toHaveLength(1);
    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.memories[0]?.whoseMemoryIsThis).toBe("Brother A");
  });

  it("allows getMemory access for accepted family members", async () => {
    const requesterId = new Types.ObjectId();
    const ownerId = new Types.ObjectId();
    const memory = {
      _id: new Types.ObjectId(),
      userId: ownerId,
      type: "journal",
      whoseMemoryIsThis: "Owner",
      files: [],
      title: "Entry",
      narrative: "Story",
      date: new Date("2026-06-10T00:00:00.000Z"),
      tags: ["family"],
      createdAt: new Date("2026-06-10T00:00:00.000Z"),
      updatedAt: new Date("2026-06-10T00:00:00.000Z"),
    };

    areAcceptedFamilyMembersMock.mockResolvedValue(true);
    vi.spyOn(MemoryVaultModel, "findById").mockReturnValue(mockExecResolved(memory) as never);

    const result = await memoryVaultService.getMemory(
      {
        id: requesterId.toString(),
        email: "requester@example.com",
        role: "user",
        tokenVersion: 0,
      },
      { memoryId: memory._id.toString() },
    );

    expect(result.id).toBe(memory._id.toString());
    expect(areAcceptedFamilyMembersMock).toHaveBeenCalledWith(
      requesterId.toString(),
      ownerId.toString(),
    );
  });

  it("rejects family-shared memory access for non-family users", async () => {
    const requesterId = new Types.ObjectId();
    const ownerId = new Types.ObjectId();
    const memory = {
      _id: new Types.ObjectId(),
      userId: ownerId,
      type: "journal",
      whoseMemoryIsThis: "Owner",
      files: [],
      title: "Entry",
      narrative: "Story",
      date: new Date("2026-06-10T00:00:00.000Z"),
      tags: ["family"],
      createdAt: new Date("2026-06-10T00:00:00.000Z"),
      updatedAt: new Date("2026-06-10T00:00:00.000Z"),
    };

    areAcceptedFamilyMembersMock.mockResolvedValue(false);
    vi.spyOn(MemoryVaultModel, "findById").mockReturnValue(mockExecResolved(memory) as never);

    await expect(
      memoryVaultService.getMemory(
        {
          id: requesterId.toString(),
          email: "requester@example.com",
          role: "user",
          tokenVersion: 0,
        },
        { memoryId: memory._id.toString() },
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects timeline access for users who are not accepted family members", async () => {
    const requesterId = new Types.ObjectId();
    const familyMemberId = new Types.ObjectId();

    areAcceptedFamilyMembersMock.mockResolvedValue(false);

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

  it("still allows the owner to get, update, and delete their own memory", async () => {
    const ownerId = new Types.ObjectId();
    const memoryId = new Types.ObjectId();
    const ownedMemory = {
      _id: memoryId,
      userId: ownerId,
      type: "journal",
      whoseMemoryIsThis: "Owner",
      files: [],
      title: "Entry",
      narrative: "Story",
      date: new Date("2026-06-10T00:00:00.000Z"),
      tags: ["family"],
      createdAt: new Date("2026-06-10T00:00:00.000Z"),
      updatedAt: new Date("2026-06-10T00:00:00.000Z"),
      save: vi.fn().mockResolvedValue(undefined),
    };

    vi.spyOn(MemoryVaultModel, "findById").mockReturnValue(mockExecResolved(ownedMemory) as never);
    vi.spyOn(MemoryVaultModel, "findOne").mockReturnValue(mockExecResolved(ownedMemory) as never);
    const deleteOneSpy = vi
      .spyOn(MemoryVaultModel, "deleteOne")
      .mockReturnValue(mockExecResolved({ acknowledged: true, deletedCount: 1 }) as never);

    const user = {
      id: ownerId.toString(),
      email: "owner@example.com",
      role: "user" as const,
      tokenVersion: 0,
    };

    const fetched = await memoryVaultService.getMemory(user, { memoryId: memoryId.toString() });
    const updated = await memoryVaultService.updateMemory(
      user,
      { memoryId: memoryId.toString() },
      { title: "Updated Entry" },
      [],
    );
    await memoryVaultService.deleteMemory(user, { memoryId: memoryId.toString() });

    expect(fetched.id).toBe(memoryId.toString());
    expect(updated.title).toBe("Updated Entry");
    expect(ownedMemory.title).toBe("Updated Entry");
    expect(deleteOneSpy).toHaveBeenCalledWith({ _id: memoryId });
  });
});
