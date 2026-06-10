import { describe, expect, it, beforeEach, vi } from "vitest";
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

const { TrustedContactModel } =
  await import("../src/modules/trusted-contacts/trusted-contact.model.js");
const trustedContactService =
  await import("../src/modules/trusted-contacts/trusted-contact.service.js");
const { UserModel } = await import("../src/modules/users/user.model.js");
const { hashToken } = await import("../src/utils/token.util.js");

const mockExecResolved = <T>(value: T) => ({
  exec: vi.fn().mockResolvedValue(value),
});

describe("trusted contact service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sendTransactionalEmailMock.mockClear();
    createAuditLogMock.mockClear();
    reauthMock.mockClear();
  });

  it("allows a user to add a trusted contact and stores only a hashed token", async () => {
    const ownerId = new Types.ObjectId();
    const trustedContactId = new Types.ObjectId();

    vi.spyOn(UserModel, "findById").mockReturnValue(
      mockExecResolved({
        _id: ownerId,
        email: "owner@example.com",
        name: "Owner",
      }) as never,
    );
    vi.spyOn(TrustedContactModel, "exists").mockReturnValue(mockExecResolved(null) as never);
    const createSpy = vi
      .spyOn(TrustedContactModel, "create")
      .mockImplementation(async (payload) => {
        return new TrustedContactModel({
          _id: trustedContactId,
          ...payload,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

    const result = await trustedContactService.createTrustedContact(
      {
        id: ownerId.toString(),
        email: "owner@example.com",
        role: "user",
        tokenVersion: 0,
      },
      {
        name: "Trusted Person",
        email: "trusted@example.com",
        inactivityDays: 90,
        accessScope: {
          profile: true,
          documents: true,
          notes: false,
          messages: false,
          paymentInfo: false,
          accountTransfer: false,
        },
        currentPassword: "Password1",
      },
      {},
    );

    expect(result.trustedContact.email).toBe("trusted@example.com");
    expect(sendTransactionalEmailMock).toHaveBeenCalledTimes(1);
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "trusted_contact_added" }),
    );

    const createdPayload = createSpy.mock.calls[0]?.[0] as { inviteTokenHash: string };
    expect(createdPayload.inviteTokenHash).toBeTypeOf("string");
    expect(createdPayload.inviteTokenHash).not.toContain(".");
    expect(createdPayload.inviteTokenHash).not.toContain("trusted@example.com");
  });

  it("rejects adding the authenticated user's own email as a trusted contact", async () => {
    vi.spyOn(UserModel, "findById").mockReturnValue(
      mockExecResolved({
        _id: new Types.ObjectId(),
        email: "owner@example.com",
        name: "Owner",
      }) as never,
    );

    await expect(
      trustedContactService.createTrustedContact(
        {
          id: new Types.ObjectId().toString(),
          email: "owner@example.com",
          role: "user",
          tokenVersion: 0,
        },
        {
          name: "Owner",
          email: "owner@example.com",
          inactivityDays: 30,
          accessScope: {
            profile: true,
            documents: false,
            notes: false,
            messages: false,
            paymentInfo: false,
            accountTransfer: false,
          },
          currentPassword: "Password1",
        },
        {},
      ),
    ).rejects.toMatchObject({
      code: "TRUSTED_CONTACT_SELF_REFERENCE",
    });
  });

  it("rejects duplicate active trusted contacts for the same owner/email", async () => {
    vi.spyOn(UserModel, "findById").mockReturnValue(
      mockExecResolved({ _id: new Types.ObjectId() }) as never,
    );
    vi.spyOn(TrustedContactModel, "exists").mockReturnValue(
      mockExecResolved({ _id: new Types.ObjectId() }) as never,
    );

    await expect(
      trustedContactService.createTrustedContact(
        {
          id: new Types.ObjectId().toString(),
          email: "owner@example.com",
          role: "user",
          tokenVersion: 0,
        },
        {
          name: "Trusted Person",
          email: "trusted@example.com",
          inactivityDays: 60,
          accessScope: {
            profile: true,
            documents: false,
            notes: false,
            messages: false,
            paymentInfo: false,
            accountTransfer: false,
          },
          currentPassword: "Password1",
        },
        {},
      ),
    ).rejects.toMatchObject({
      code: "TRUSTED_CONTACT_ALREADY_EXISTS",
    });
  });

  it("allows a trusted contact to accept an invitation and invalidates the token", async () => {
    const trustedContact = new TrustedContactModel({
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      name: "Trusted Person",
      email: "trusted@example.com",
      status: "pending",
      inactivityDays: 60,
      accessScope: {
        profile: true,
        documents: false,
        notes: true,
        messages: false,
        paymentInfo: false,
        accountTransfer: false,
      },
      inviteTokenHash: hashToken("test-token"),
      inviteTokenExpiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(TrustedContactModel, "findOne").mockReturnValue({
      select: vi.fn().mockReturnValue(mockExecResolved(trustedContact)),
    } as never);
    vi.spyOn(trustedContact, "save").mockResolvedValue(trustedContact);

    const result = await trustedContactService.acceptTrustedContactInvitation("test-token", {});

    expect(result.trustedContact.status).toBe("accepted");
    expect(trustedContact.inviteTokenHash).toBeUndefined();
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "trusted_contact_invite_accepted" }),
    );
  });
});
