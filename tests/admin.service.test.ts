import bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.LOG_LEVEL = "silent";

const sendTransactionalEmailMock = vi.fn().mockResolvedValue(undefined);
const reauthMock = vi.fn().mockResolvedValue(undefined);
const uploadProfilePictureMock = vi.fn();
const deleteProfilePictureMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../src/utils/mail.util.js", () => ({
  sendTransactionalEmail: sendTransactionalEmailMock,
}));

vi.mock("../src/modules/auth/auth.reauth.js", () => ({
  requireRecentPasswordReauth: reauthMock,
}));

vi.mock("../src/modules/users/user.upload.js", () => ({
  uploadProfilePicture: uploadProfilePictureMock,
  deleteProfilePicture: deleteProfilePictureMock,
  userProfileUpload: vi.fn(),
}));

const adminService = await import("../src/modules/admin/admin.service.js");
const { UserModel } = await import("../src/modules/users/user.model.js");
const { AdminSettingsModel, adminSettingsKey } =
  await import("../src/modules/admin/admin-settings.model.js");

const mockExecResolved = <T>(value: T) => ({
  exec: vi.fn().mockResolvedValue(value),
});

describe("admin service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sendTransactionalEmailMock.mockClear();
    reauthMock.mockClear();
    uploadProfilePictureMock.mockReset();
    deleteProfilePictureMock.mockClear();
  });

  it("returns dashboard metrics using efficient count queries", async () => {
    const countDocumentsSpy = vi
      .spyOn(UserModel, "countDocuments")
      .mockReturnValueOnce(mockExecResolved(12) as never)
      .mockReturnValueOnce(mockExecResolved(5) as never);

    const result = await adminService.getDashboardMetrics();

    expect(result).toEqual({
      totalUsers: 12,
      totalActiveProfiles: 5,
    });
    expect(countDocumentsSpy).toHaveBeenNthCalledWith(1, {});
    expect(countDocumentsSpy).toHaveBeenNthCalledWith(2, {
      lastActiveAt: { $exists: true, $ne: null },
    });
  });

  it("lists users with pagination and search", async () => {
    const user = new UserModel({
      _id: new Types.ObjectId(),
      name: "John Doe",
      email: "john@example.com",
      phoneNumber: "+123",
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

    vi.spyOn(UserModel, "countDocuments").mockReturnValue(mockExecResolved(1) as never);
    vi.spyOn(UserModel, "find").mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue(mockExecResolved([user])),
        }),
      }),
    } as never);

    const result = await adminService.listAdminUsers({
      page: 2,
      limit: 10,
      search: "john",
    });

    expect(result.pagination).toMatchObject({
      page: 2,
      limit: 10,
      total: 1,
    });
    expect(result.users[0]).toMatchObject({
      email: "john@example.com",
      name: "John Doe",
    });
    expect(result.users[0]).not.toHaveProperty("passwordHash");
  });

  it("returns sanitized user detail and 404s when missing", async () => {
    const user = new UserModel({
      _id: new Types.ObjectId(),
      name: "John Doe",
      email: "john@example.com",
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

    vi.spyOn(UserModel, "findById")
      .mockReturnValueOnce(mockExecResolved(user) as never)
      .mockReturnValueOnce(mockExecResolved(null) as never);

    const detail = await adminService.getAdminUserById({
      userId: user._id.toString(),
    });

    expect(detail.email).toBe("john@example.com");
    expect(detail).not.toHaveProperty("passwordHash");

    await expect(
      adminService.getAdminUserById({
        userId: user._id.toString(),
      }),
    ).rejects.toMatchObject({
      code: "USER_NOT_FOUND",
    });
  });

  it("creates an admin, hashes the password, rejects duplicates, and excludes sensitive fields", async () => {
    vi.spyOn(UserModel, "exists")
      .mockReturnValueOnce(mockExecResolved(null) as never)
      .mockReturnValueOnce(mockExecResolved({ _id: new Types.ObjectId() }) as never);
    const createSpy = vi.spyOn(UserModel, "create").mockImplementation(async (payload) => {
      return new UserModel({
        _id: new Types.ObjectId(),
        ...payload,
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

    const result = await adminService.createAdminUser({
      name: "Admin User",
      email: "ADMIN@EXAMPLE.COM",
      password: "Password1",
      phone: "+123",
      address: "Street 1",
      profileImage: "https://example.com/profile.png",
    });

    const createPayload = createSpy.mock.calls[0]?.[0] as {
      email: string;
      passwordHash: string;
      role: string;
    };
    expect(createPayload.email).toBe("admin@example.com");
    expect(createPayload.role).toBe("admin");
    expect(createPayload.passwordHash).not.toBe("Password1");
    expect(await bcrypt.compare("Password1", createPayload.passwordHash)).toBe(true);
    expect(result.role).toBe("admin");
    expect(result).not.toHaveProperty("passwordHash");

    await expect(
      adminService.createAdminUser({
        name: "Admin User",
        email: "admin@example.com",
        password: "Password1",
      }),
    ).rejects.toMatchObject({
      code: "EMAIL_ALREADY_EXISTS",
    });
  });

  it("sends bulk email privately, rejects missing users, and hides SMTP errors", async () => {
    const firstUserId = new Types.ObjectId();
    const secondUserId = new Types.ObjectId();
    const users = [
      new UserModel({
        _id: firstUserId,
        name: "User 1",
        email: "user1@example.com",
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
      }),
      new UserModel({
        _id: secondUserId,
        name: "User 2",
        email: "user2@example.com",
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
      }),
    ];

    vi.spyOn(UserModel, "find")
      .mockReturnValueOnce(mockExecResolved(users) as never)
      .mockReturnValueOnce(mockExecResolved([users[0]]) as never)
      .mockReturnValueOnce(mockExecResolved(users) as never);

    const result = await adminService.sendBulkEmail({
      userIds: [firstUserId.toString(), secondUserId.toString(), firstUserId.toString()],
      subject: "Notice",
      message: "Hello there",
    });

    expect(result).toEqual({
      requestedCount: 2,
      sentCount: 2,
    });
    expect(sendTransactionalEmailMock).toHaveBeenCalledTimes(2);
    expect(sendTransactionalEmailMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ to: "user1@example.com" }),
    );
    expect(sendTransactionalEmailMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ to: "user2@example.com" }),
    );

    await expect(
      adminService.sendBulkEmail({
        userIds: [firstUserId.toString(), secondUserId.toString()],
        subject: "Notice",
        message: "Hello there",
      }),
    ).rejects.toMatchObject({
      code: "USER_NOT_FOUND",
    });

    sendTransactionalEmailMock.mockRejectedValueOnce(new Error("smtp failed"));

    await expect(
      adminService.sendBulkEmail({
        userIds: [firstUserId.toString(), secondUserId.toString()],
        subject: "Notice",
        message: "Hello there",
      }),
    ).rejects.toMatchObject({
      code: "MAIL_SEND_ERROR",
    });
  });

  it("reads and updates admin profile, rejects email changes, and keeps responses sanitized", async () => {
    const user = new UserModel({
      _id: new Types.ObjectId(),
      name: "Admin",
      email: "admin@example.com",
      passwordHash: "hash",
      role: "admin",
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

    vi.spyOn(UserModel, "findById").mockReturnValue(mockExecResolved(user) as never);
    vi.spyOn(user, "save").mockResolvedValue(user);

    const profile = await adminService.getAdminProfile({
      id: user._id.toString(),
      email: user.email,
      role: "admin",
      tokenVersion: 0,
    });

    expect(profile.email).toBe("admin@example.com");
    expect(profile).not.toHaveProperty("passwordHash");

    const updated = await adminService.updateAdminProfile(
      {
        id: user._id.toString(),
        email: user.email,
        role: "admin",
        tokenVersion: 0,
      },
      {
        name: "Admin Updated",
        phone: "+456",
        address: "Updated address",
        profileImage: "https://example.com/updated.png",
      },
    );

    expect(updated.name).toBe("Admin Updated");
    expect(updated.phoneNumber).toBe("+456");
    expect(updated.address).toBe("Updated address");
    expect(updated.profilePicture?.url).toBe("https://example.com/updated.png");

    await expect(
      adminService.updateAdminProfile(
        {
          id: user._id.toString(),
          email: user.email,
          role: "admin",
          tokenVersion: 0,
        },
        {
          email: "new@example.com",
        },
      ),
    ).rejects.toMatchObject({
      code: "EMAIL_READ_ONLY",
    });
  });

  it("changes admin password after verifying the current password", async () => {
    const user = new UserModel({
      _id: new Types.ObjectId(),
      name: "Admin",
      email: "admin@example.com",
      passwordHash: "oldhash",
      role: "admin",
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

    vi.spyOn(UserModel, "findById").mockReturnValue({
      select: vi.fn().mockReturnValue(mockExecResolved(user)),
    } as never);
    vi.spyOn(user, "save").mockResolvedValue(user);

    const result = await adminService.changeAdminPassword(
      {
        id: user._id.toString(),
        email: user.email,
        role: "admin",
        tokenVersion: 0,
      },
      {
        currentPassword: "Password1",
        newPassword: "Password2",
      },
    );

    expect(result.message).toBe("Password updated successfully.");
    expect(reauthMock).toHaveBeenCalled();
    expect(await bcrypt.compare("Password2", user.passwordHash)).toBe(true);
    expect(user.refreshTokenVersion).toBe(1);
  });

  it("gets and updates singleton settings with updatedBy", async () => {
    const now = new Date();
    const settings = new AdminSettingsModel({
      _id: new Types.ObjectId(),
      key: adminSettingsKey,
      aboutUs: "About",
      privacyPolicy: "Privacy",
      termsAndConditions: "Terms",
      updatedBy: new Types.ObjectId(),
      createdAt: now,
      updatedAt: now,
    });

    vi.spyOn(AdminSettingsModel, "findOne").mockReturnValue(mockExecResolved(settings) as never);
    vi.spyOn(AdminSettingsModel, "findOneAndUpdate").mockReturnValue(
      mockExecResolved(settings) as never,
    );

    const current = await adminService.getAdminSettings();
    const updated = await adminService.updateAdminSettings(
      {
        id: "507f1f77bcf86cd799439012",
        email: "super@example.com",
        role: "super_admin",
        tokenVersion: 0,
      },
      {
        aboutUs: "About",
      },
    );

    expect(current.aboutUs).toBe("About");
    expect(updated.aboutUs).toBe("About");
    expect(AdminSettingsModel.findOneAndUpdate).toHaveBeenCalledWith(
      { key: adminSettingsKey },
      expect.objectContaining({
        $set: expect.objectContaining({
          aboutUs: "About",
          updatedBy: "507f1f77bcf86cd799439012",
        }),
      }),
      expect.objectContaining({
        upsert: true,
      }),
    );
  });
});
