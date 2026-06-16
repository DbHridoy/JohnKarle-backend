import bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.LOG_LEVEL = "silent";

const recordUserActivityMock = vi.fn().mockResolvedValue(undefined);
const createAuditLogMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../src/modules/legacy-access/legacy-access.activity.js", () => ({
  recordUserActivity: recordUserActivityMock,
}));

vi.mock("../src/modules/audit-logs/audit-log.service.js", () => ({
  createAuditLog: createAuditLogMock,
}));

const authService = await import("../src/modules/auth/auth.service.js");
const { UserModel } = await import("../src/modules/users/user.model.js");

const mockExecResolved = <T>(value: T) => ({
  exec: vi.fn().mockResolvedValue(value),
});

describe("auth service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    recordUserActivityMock.mockClear();
    createAuditLogMock.mockClear();
  });

  it("writes an audit log when a user registers", async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(UserModel, "exists").mockReturnValue(mockExecResolved(null) as never);
    vi.spyOn(UserModel, "create").mockImplementation(async (payload) => {
      return new UserModel({
        _id: userId,
        ...payload,
        role: "user",
        isEmailVerified: false,
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
    });

    const result = await authService.register({
      name: "New User",
      email: "New.User@example.com",
      password: "Password1",
    });

    expect(result.user.email).toBe("new.user@example.com");
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: userId.toString(),
        actorType: "user",
        action: "user_registered",
        targetType: "user",
        targetLabel: "new.user@example.com",
      }),
    );
  });

  it("allows login for invited users with a valid password", async () => {
    const password = "Password1";
    const passwordHash = await bcrypt.hash(password, 10);
    const user = new UserModel({
      _id: new Types.ObjectId(),
      name: "Invited User",
      email: "invited@example.com",
      passwordHash,
      role: "user",
      isEmailVerified: false,
      invitationTokenHash: "legacy-token-hash",
      invitationExpiresAt: new Date(Date.now() + 60_000),
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

    vi.spyOn(UserModel, "findOne").mockReturnValue({
      select: vi.fn().mockReturnValue(mockExecResolved(user)),
    } as never);
    vi.spyOn(user, "save").mockResolvedValue(user);

    const result = await authService.login({
      email: "invited@example.com",
      password,
    });

    expect(result.user.email).toBe("invited@example.com");
    expect(result).toHaveProperty("tokens.accessToken");
    expect(user.lastLoginAt).toBeInstanceOf(Date);
    expect(user.lastActiveAt).toEqual(user.lastLoginAt);
    expect(recordUserActivityMock).toHaveBeenCalledWith(
      user._id.toString(),
      expect.objectContaining({
        actorType: "user",
        forceCancelWaitingRequests: true,
      }),
    );
  });
});
