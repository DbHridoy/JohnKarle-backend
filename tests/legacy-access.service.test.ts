import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.LOG_LEVEL = "silent";

const sendTransactionalEmailMock = vi.fn().mockResolvedValue(undefined);
const createAuditLogMock = vi.fn().mockResolvedValue(undefined);
const reauthMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../src/utils/mail.util.js", () => ({
  sendTransactionalEmail: sendTransactionalEmailMock,
}));

vi.mock("../src/modules/audit-logs/audit-log.service.js", () => ({
  createAuditLog: createAuditLogMock,
}));

vi.mock("../src/modules/auth/auth.reauth.js", () => ({
  requireRecentPasswordReauth: reauthMock,
}));

const { LegacyAccessRequestModel } =
  await import("../src/modules/legacy-access/legacy-access.model.js");
const legacyAccessService = await import("../src/modules/legacy-access/legacy-access.service.js");
const { UserModel } = await import("../src/modules/users/user.model.js");
const { TrustedContactModel } =
  await import("../src/modules/trusted-contacts/trusted-contact.model.js");
const { MemoryVaultModel } = await import("../src/modules/memory-vault/memory-vault.model.js");
const activityModule = await import("../src/modules/legacy-access/legacy-access.activity.js");

const mockExecResolved = <T>(value: T) => ({
  exec: vi.fn().mockResolvedValue(value),
});

describe("legacy access service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sendTransactionalEmailMock.mockClear();
    createAuditLogMock.mockClear();
    reauthMock.mockClear();
  });

  it("creates waiting-period requests for inactive users and avoids duplicates", async () => {
    const userId = new Types.ObjectId();
    const trustedContactId = new Types.ObjectId();
    const user = new UserModel({
      _id: userId,
      name: "Owner",
      email: "owner@example.com",
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
      legacyAccessEnabled: true,
      lastActiveAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const trustedContact = new TrustedContactModel({
      _id: trustedContactId,
      userId,
      name: "Trusted Person",
      email: "trusted@example.com",
      status: "accepted",
      inactivityDays: 90,
      accessScope: {
        profile: true,
        documents: false,
        notes: true,
        messages: false,
        paymentInfo: false,
        accountTransfer: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(UserModel, "find").mockReturnValue(mockExecResolved([user]) as never);
    vi.spyOn(TrustedContactModel, "find").mockReturnValue(
      mockExecResolved([trustedContact]) as never,
    );
    const existsSpy = vi
      .spyOn(LegacyAccessRequestModel, "exists")
      .mockReturnValueOnce(mockExecResolved(null) as never)
      .mockReturnValueOnce(mockExecResolved({ _id: new Types.ObjectId() }) as never);
    const createSpy = vi
      .spyOn(LegacyAccessRequestModel, "create")
      .mockImplementation(async (payload) => {
        return new LegacyAccessRequestModel({
          _id: new Types.ObjectId(),
          ...payload,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });
    vi.spyOn(LegacyAccessRequestModel, "find").mockReturnValue(mockExecResolved([]) as never);

    const firstRun = await legacyAccessService.runLegacyAccessDailyJob();
    const secondRun = await legacyAccessService.runLegacyAccessDailyJob();

    expect(firstRun.triggeredCount).toBe(1);
    expect(secondRun.triggeredCount).toBe(0);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(existsSpy).toHaveBeenCalledTimes(2);
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "legacy_access_triggered" }),
    );
  });

  it("cancels waiting legacy access requests when user activity is recorded", async () => {
    const request = new LegacyAccessRequestModel({
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      trustedContactId: new Types.ObjectId(),
      status: "waiting_period",
      triggeredAt: new Date(),
      unlockAt: new Date(Date.now() + 10_000),
      expiresAt: new Date(Date.now() + 20_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(UserModel, "findOneAndUpdate").mockReturnValue(
      mockExecResolved({ _id: request.userId }) as never,
    );
    vi.spyOn(LegacyAccessRequestModel, "find").mockReturnValue(
      mockExecResolved([request]) as never,
    );
    vi.spyOn(request, "save").mockResolvedValue(request);

    await activityModule.recordUserActivity(request.userId.toString(), {});

    expect(request.status).toBe("cancelled");
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "legacy_access_cancelled_due_to_user_activity" }),
    );
  });

  it("prevents a trusted contact from claiming before unlockAt", async () => {
    const trustedContactId = new Types.ObjectId();
    const request = new LegacyAccessRequestModel({
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      trustedContactId,
      status: "waiting_period",
      triggeredAt: new Date(),
      unlockAt: new Date(Date.now() + 60_000),
      expiresAt: new Date(Date.now() + 120_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const trustedContact = new TrustedContactModel({
      _id: trustedContactId,
      userId: request.userId,
      name: "Trusted Person",
      email: "trusted@example.com",
      status: "accepted",
      inactivityDays: 90,
      accessScope: {
        profile: true,
        documents: false,
        notes: true,
        messages: false,
        paymentInfo: false,
        accountTransfer: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(LegacyAccessRequestModel, "findById").mockReturnValue(
      mockExecResolved(request) as never,
    );
    vi.spyOn(TrustedContactModel, "findOne").mockReturnValue(
      mockExecResolved(trustedContact) as never,
    );

    await expect(
      legacyAccessService.claimLegacyAccessRequest(
        {
          id: new Types.ObjectId().toString(),
          email: "trusted@example.com",
          role: "user",
          tokenVersion: 0,
        },
        { requestId: request._id.toString() },
        {},
      ),
    ).rejects.toMatchObject({
      code: "LEGACY_ACCESS_LOCKED",
    });
  });

  it("allows claim after unlockAt and rejects expired requests", async () => {
    const trustedContactId = new Types.ObjectId();
    const owner = new UserModel({
      _id: new Types.ObjectId(),
      name: "Owner",
      email: "owner@example.com",
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
      legacyAccessEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const request = new LegacyAccessRequestModel({
      _id: new Types.ObjectId(),
      userId: owner._id,
      trustedContactId,
      status: "waiting_period",
      triggeredAt: new Date(Date.now() - 100_000),
      unlockAt: new Date(Date.now() - 50_000),
      expiresAt: new Date(Date.now() + 120_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const trustedContact = new TrustedContactModel({
      _id: trustedContactId,
      userId: owner._id,
      name: "Trusted Person",
      email: "trusted@example.com",
      status: "accepted",
      inactivityDays: 90,
      accessScope: {
        profile: true,
        documents: false,
        notes: true,
        messages: false,
        paymentInfo: false,
        accountTransfer: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(LegacyAccessRequestModel, "findById")
      .mockReturnValueOnce(mockExecResolved(request) as never)
      .mockReturnValueOnce(
        (() => {
          const expiredRequest = new LegacyAccessRequestModel({
            ...request.toObject(),
            _id: new Types.ObjectId(),
            expiresAt: new Date(Date.now() - 1_000),
          });
          vi.spyOn(expiredRequest, "save").mockResolvedValue(expiredRequest);

          return mockExecResolved(expiredRequest);
        })() as never,
      );
    vi.spyOn(TrustedContactModel, "findOne").mockReturnValue(
      mockExecResolved(trustedContact) as never,
    );
    vi.spyOn(request, "save").mockResolvedValue(request);
    vi.spyOn(UserModel, "findById").mockReturnValue(mockExecResolved(owner) as never);

    const approved = await legacyAccessService.claimLegacyAccessRequest(
      {
        id: new Types.ObjectId().toString(),
        email: "trusted@example.com",
        role: "user",
        tokenVersion: 0,
      },
      { requestId: request._id.toString() },
      {},
    );

    expect(approved.request.status).toBe("approved");
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "legacy_access_approved" }),
    );

    await expect(
      legacyAccessService.claimLegacyAccessRequest(
        {
          id: new Types.ObjectId().toString(),
          email: "trusted@example.com",
          role: "user",
          tokenVersion: 0,
        },
        { requestId: "expired-request" },
        {},
      ),
    ).rejects.toMatchObject({
      code: "LEGACY_ACCESS_EXPIRED",
    });
  });

  it("blocks unapproved legacy data access and returns only scoped data without secrets", async () => {
    const ownerId = new Types.ObjectId();
    const trustedContactId = new Types.ObjectId();
    const approvedRequest = new LegacyAccessRequestModel({
      _id: new Types.ObjectId(),
      userId: ownerId,
      trustedContactId,
      status: "approved",
      triggeredAt: new Date(Date.now() - 100_000),
      unlockAt: new Date(Date.now() - 50_000),
      approvedAt: new Date(Date.now() - 10_000),
      expiresAt: new Date(Date.now() + 120_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const pendingRequest = new LegacyAccessRequestModel({
      ...approvedRequest.toObject(),
      _id: new Types.ObjectId(),
      status: "waiting_period",
    });
    const trustedContact = new TrustedContactModel({
      _id: trustedContactId,
      userId: ownerId,
      name: "Trusted Person",
      email: "trusted@example.com",
      status: "accepted",
      inactivityDays: 90,
      accessScope: {
        profile: true,
        documents: false,
        notes: true,
        messages: false,
        paymentInfo: false,
        accountTransfer: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const owner = new UserModel({
      _id: ownerId,
      name: "Owner",
      email: "owner@example.com",
      passwordHash: "should-not-leak",
      role: "user",
      isEmailVerified: true,
      familyMembers: [],
      preferences: {
        notifications: true,
        aiInsight: true,
        darkMode: false,
        anonymousAnalytics: true,
      },
      refreshTokenVersion: 3,
      legacyAccessEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const noteMemory = {
      _id: new Types.ObjectId(),
      userId: ownerId,
      type: "journal",
      whoseMemoryIsThis: "Owner",
      files: [],
      title: "Private journal",
      narrative: "Visible note",
      date: new Date(),
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(LegacyAccessRequestModel, "findById")
      .mockReturnValueOnce(mockExecResolved(pendingRequest) as never)
      .mockReturnValueOnce(mockExecResolved(approvedRequest) as never);
    vi.spyOn(TrustedContactModel, "findOne").mockReturnValue(
      mockExecResolved(trustedContact) as never,
    );
    vi.spyOn(UserModel, "findById").mockReturnValue(mockExecResolved(owner) as never);
    vi.spyOn(MemoryVaultModel, "find").mockReturnValue({
      sort: vi.fn().mockReturnValue(mockExecResolved([noteMemory])),
    } as never);

    await expect(
      legacyAccessService.getLegacyAccessData(
        {
          id: new Types.ObjectId().toString(),
          email: "trusted@example.com",
          role: "user",
          tokenVersion: 0,
        },
        { requestId: pendingRequest._id.toString() },
        {},
      ),
    ).rejects.toMatchObject({
      code: "LEGACY_ACCESS_NOT_APPROVED",
    });

    const result = await legacyAccessService.getLegacyAccessData(
      {
        id: new Types.ObjectId().toString(),
        email: "trusted@example.com",
        role: "user",
        tokenVersion: 0,
      },
      { requestId: approvedRequest._id.toString() },
      {},
    );

    expect(result.data.profile?.email).toBe("owner@example.com");
    expect(result.data.documents).toBeUndefined();
    expect(result.data.notes).toHaveLength(1);
    expect(JSON.stringify(result.data)).not.toContain("passwordHash");
    expect(JSON.stringify(result.data)).not.toContain("refreshTokenVersion");
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "legacy_data_viewed" }),
    );
  });

  it("prevents removed trusted contacts from claiming access", async () => {
    const request = new LegacyAccessRequestModel({
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      trustedContactId: new Types.ObjectId(),
      status: "waiting_period",
      triggeredAt: new Date(Date.now() - 100_000),
      unlockAt: new Date(Date.now() - 50_000),
      expiresAt: new Date(Date.now() + 120_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const removedTrustedContact = new TrustedContactModel({
      _id: request.trustedContactId,
      userId: request.userId,
      name: "Trusted Person",
      email: "trusted@example.com",
      status: "removed",
      inactivityDays: 90,
      accessScope: {
        profile: true,
        documents: false,
        notes: false,
        messages: false,
        paymentInfo: false,
        accountTransfer: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(LegacyAccessRequestModel, "findById").mockReturnValue(
      mockExecResolved(request) as never,
    );
    vi.spyOn(TrustedContactModel, "findOne").mockReturnValue(mockExecResolved(null) as never);

    await expect(
      legacyAccessService.claimLegacyAccessRequest(
        {
          id: new Types.ObjectId().toString(),
          email: "trusted@example.com",
          role: "user",
          tokenVersion: 0,
        },
        { requestId: request._id.toString() },
        {},
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(removedTrustedContact.status).toBe("removed");
  });
});
