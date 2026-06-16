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
const createAuditLogMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../src/utils/mail.util.js", () => ({
  sendTransactionalEmail: sendTransactionalEmailMock,
}));

vi.mock("../src/modules/auth/auth.reauth.js", () => ({
  requireRecentPasswordReauth: reauthMock,
}));

vi.mock("../src/modules/audit-logs/audit-log.service.js", () => ({
  createAuditLog: createAuditLogMock,
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
const { AuditLogModel } = await import("../src/modules/audit-logs/audit-log.model.js");
const { EmailTemplateModel } =
  await import("../src/modules/email-templates/email-template.model.js");

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
    createAuditLogMock.mockClear();
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

  it("lists recent activities with filters, pagination, and sanitized metadata", async () => {
    const actorId = new Types.ObjectId();
    const auditLogId = new Types.ObjectId();
    const createdAt = new Date("2026-06-16T10:00:00.000Z");
    const searchUserId = new Types.ObjectId();

    vi.spyOn(UserModel, "find")
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockReturnValue(mockExecResolved([{ _id: searchUserId }])),
        }),
      } as never)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockReturnValue(
            mockExecResolved([
              {
                _id: actorId,
                name: "Admin Actor",
                email: "admin@example.com",
                role: "admin",
              },
            ]),
          ),
        }),
      } as never);

    const countDocumentsSpy = vi
      .spyOn(AuditLogModel, "countDocuments")
      .mockReturnValue(mockExecResolved(1) as never);
    const findSpy = vi.spyOn(AuditLogModel, "find").mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockReturnValue(
              mockExecResolved([
                {
                  _id: auditLogId,
                  actorId,
                  action: "trusted_contact_added",
                  targetType: "trusted_contact",
                  targetId: "507f1f77bcf86cd799439099",
                  targetLabel: "John Trusted",
                  metadata: {
                    phone: "+123",
                    password: "secret",
                    nested: {
                      refreshToken: "token",
                    },
                  },
                  createdAt,
                },
              ]),
            ),
          }),
        }),
      }),
    } as never);

    const result = await adminService.listRecentActivities({
      page: 2,
      limit: 10,
      type: "trusted_contact_added",
      actorId: actorId.toString(),
      targetType: "trusted_contact",
      targetId: "507f1f77bcf86cd799439099",
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-12-31T23:59:59.999Z"),
      search: "admin",
    });

    expect(countDocumentsSpy).toHaveBeenCalledWith({
      action: "trusted_contact_added",
      actorId: actorId.toString(),
      targetType: "trusted_contact",
      targetId: "507f1f77bcf86cd799439099",
      createdAt: {
        $gte: new Date("2026-01-01T00:00:00.000Z"),
        $lte: new Date("2026-12-31T23:59:59.999Z"),
      },
      $or: [
        { action: { $regex: "admin", $options: "i" } },
        { targetType: { $regex: "admin", $options: "i" } },
        { targetLabel: { $regex: "admin", $options: "i" } },
        { actorId: { $in: [searchUserId] } },
      ],
    });
    expect(findSpy).toHaveBeenCalledWith({
      action: "trusted_contact_added",
      actorId: actorId.toString(),
      targetType: "trusted_contact",
      targetId: "507f1f77bcf86cd799439099",
      createdAt: {
        $gte: new Date("2026-01-01T00:00:00.000Z"),
        $lte: new Date("2026-12-31T23:59:59.999Z"),
      },
      $or: [
        { action: { $regex: "admin", $options: "i" } },
        { targetType: { $regex: "admin", $options: "i" } },
        { targetLabel: { $regex: "admin", $options: "i" } },
        { actorId: { $in: [searchUserId] } },
      ],
    });
    expect(result).toEqual({
      activities: [
        {
          id: auditLogId.toString(),
          type: "trusted_contact_added",
          message: "Trusted contact added",
          actor: {
            id: actorId.toString(),
            name: "Admin Actor",
            email: "admin@example.com",
            role: "admin",
          },
          target: {
            type: "trusted_contact",
            id: "507f1f77bcf86cd799439099",
            label: "John Trusted",
          },
          metadata: {
            phone: "+123",
            password: "[Redacted]",
            nested: {
              refreshToken: "[Redacted]",
            },
          },
          createdAt: createdAt.toISOString(),
        },
      ],
      pagination: {
        page: 2,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: true,
      },
    });
  });

  it("returns an empty recent activity feed with valid pagination", async () => {
    vi.spyOn(AuditLogModel, "countDocuments").mockReturnValue(mockExecResolved(0) as never);
    vi.spyOn(AuditLogModel, "find").mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockReturnValue(mockExecResolved([])),
          }),
        }),
      }),
    } as never);

    const result = await adminService.listRecentActivities({
      page: 1,
      limit: 20,
    });

    expect(result).toEqual({
      activities: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
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

    const countDocumentsSpy = vi
      .spyOn(UserModel, "countDocuments")
      .mockReturnValue(mockExecResolved(1) as never);
    const findSpy = vi.spyOn(UserModel, "find").mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(mockExecResolved([user])),
          }),
        }),
      }),
    } as never);

    const result = await adminService.listAdminUsers({
      page: 2,
      limit: 10,
      search: "john",
      role: "user",
    });

    expect(result.pagination).toMatchObject({
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: true,
    });
    expect(countDocumentsSpy).toHaveBeenCalledWith({
      $or: [
        { name: { $regex: "john", $options: "i" } },
        { email: { $regex: "john", $options: "i" } },
        { phoneNumber: { $regex: "john", $options: "i" } },
      ],
      role: "user",
    });
    expect(findSpy).toHaveBeenCalledWith({
      $or: [
        { name: { $regex: "john", $options: "i" } },
        { email: { $regex: "john", $options: "i" } },
        { phoneNumber: { $regex: "john", $options: "i" } },
      ],
      role: "user",
    });
    expect(result.users[0]).toMatchObject({
      email: "john@example.com",
      name: "John Doe",
    });
    expect(result.users[0]).not.toHaveProperty("passwordHash");
  });

  it("creates, lists, gets, updates, and deletes email templates", async () => {
    const adminId = new Types.ObjectId();
    const templateId = new Types.ObjectId();
    const template = new EmailTemplateModel({
      _id: templateId,
      templateName: "Welcome Template",
      subjectLine: "Welcome",
      content: "Hello {{name}}",
      createdBy: adminId,
      updatedBy: adminId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const existsSpy = vi
      .spyOn(EmailTemplateModel, "exists")
      .mockReturnValueOnce(mockExecResolved(null) as never)
      .mockReturnValueOnce(mockExecResolved(null) as never)
      .mockReturnValueOnce(mockExecResolved({ _id: new Types.ObjectId() }) as never);
    vi.spyOn(EmailTemplateModel, "create").mockResolvedValue(template);
    vi.spyOn(EmailTemplateModel, "countDocuments").mockReturnValue(mockExecResolved(1) as never);
    vi.spyOn(EmailTemplateModel, "find").mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue(mockExecResolved([template])),
        }),
      }),
    } as never);
    const findByIdSpy = vi
      .spyOn(EmailTemplateModel, "findById")
      .mockReturnValueOnce(mockExecResolved(template) as never)
      .mockReturnValueOnce(mockExecResolved(template) as never)
      .mockReturnValueOnce(mockExecResolved(template) as never)
      .mockReturnValueOnce(mockExecResolved(null) as never);
    vi.spyOn(template, "save").mockResolvedValue(template);
    const deleteOneSpy = vi
      .spyOn(EmailTemplateModel, "deleteOne")
      .mockReturnValue(mockExecResolved({ acknowledged: true, deletedCount: 1 }) as never);

    const actor = {
      id: adminId.toString(),
      email: "admin@example.com",
      role: "admin",
      tokenVersion: 0,
    } as const;

    const created = await adminService.createEmailTemplate(actor, {
      templateName: "Welcome Template",
      subjectLine: "Welcome",
      content: "Hello {{name}}",
    });
    const listed = await adminService.listEmailTemplates({
      page: 1,
      limit: 20,
      search: "welcome",
    });
    const fetched = await adminService.getEmailTemplateById({
      templateId: templateId.toString(),
    });
    const updated = await adminService.updateEmailTemplate(
      actor,
      { templateId: templateId.toString() },
      { templateName: "Updated Template", subjectLine: "Updated", content: "Updated content" },
    );
    const deleted = await adminService.deleteEmailTemplate({
      templateId: templateId.toString(),
    });

    expect(created.templateName).toBe("Welcome Template");
    expect(listed.data).toBeUndefined();
    expect(listed.templates).toHaveLength(1);
    expect(fetched.id).toBe(templateId.toString());
    expect(updated.templateName).toBe("Updated Template");
    expect(template.updatedBy.toString()).toBe(adminId.toString());
    expect(deleteOneSpy).toHaveBeenCalledWith({ _id: templateId });
    expect(deleted.message).toBe("Email template deleted successfully.");

    findByIdSpy.mockReset();
    findByIdSpy.mockReturnValue(mockExecResolved(template) as never);
    existsSpy.mockReset();
    existsSpy.mockReturnValueOnce(mockExecResolved({ _id: new Types.ObjectId() }) as never);
    await expect(
      adminService.updateEmailTemplate(
        actor,
        { templateId: templateId.toString() },
        { templateName: "Duplicate Name" },
      ),
    ).rejects.toMatchObject({
      code: "EMAIL_TEMPLATE_ALREADY_EXISTS",
    });

    findByIdSpy.mockReset();
    findByIdSpy.mockReturnValue(mockExecResolved(null) as never);
    await expect(
      adminService.getEmailTemplateById({
        templateId: templateId.toString(),
      }),
    ).rejects.toMatchObject({
      code: "EMAIL_TEMPLATE_NOT_FOUND",
    });
  });

  it("returns empty pagination metadata when no users match", async () => {
    vi.spyOn(UserModel, "countDocuments").mockReturnValue(mockExecResolved(0) as never);
    vi.spyOn(UserModel, "find").mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(mockExecResolved([])),
          }),
        }),
      }),
    } as never);

    const result = await adminService.listAdminUsers({
      page: 1,
      limit: 20,
    });

    expect(result).toEqual({
      users: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });
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

    const actor = {
      id: new Types.ObjectId().toString(),
      email: "super@example.com",
      role: "super_admin",
    } as const;

    const result = await adminService.createAdminUser(actor, {
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
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: actor.id,
        action: "admin_user_created",
        actorType: "admin",
        targetType: "user",
        targetLabel: "admin@example.com",
      }),
    );

    await expect(
      adminService.createAdminUser(actor, {
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

    const actor = {
      id: new Types.ObjectId().toString(),
      email: "admin@example.com",
      role: "admin",
    } as const;

    const result = await adminService.sendBulkEmail(actor, {
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
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: actor.id,
        action: "admin_bulk_email_sent",
        actorType: "admin",
        targetType: "bulk_email",
        targetLabel: "Notice",
      }),
    );

    await expect(
      adminService.sendBulkEmail(actor, {
        userIds: [firstUserId.toString(), secondUserId.toString()],
        subject: "Notice",
        message: "Hello there",
      }),
    ).rejects.toMatchObject({
      code: "USER_NOT_FOUND",
    });

    sendTransactionalEmailMock.mockRejectedValueOnce(new Error("smtp failed"));

    await expect(
      adminService.sendBulkEmail(actor, {
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
