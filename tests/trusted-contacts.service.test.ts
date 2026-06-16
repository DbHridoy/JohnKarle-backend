import { describe, expect, it, beforeEach, vi } from "vitest";
import { Types } from "mongoose";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.LOG_LEVEL = "silent";

const sendTransactionalEmailMock = vi.fn().mockResolvedValue(undefined);
const createAuditLogMock = vi.fn().mockResolvedValue(undefined);
const reauthMock = vi.fn().mockResolvedValue(undefined);
const createNotificationMock = vi.fn().mockResolvedValue(null);

vi.mock("../src/utils/mail.util.js", () => ({
  sendTransactionalEmail: sendTransactionalEmailMock,
}));

vi.mock("../src/modules/audit-logs/audit-log.service.js", () => ({
  createAuditLog: createAuditLogMock,
}));

vi.mock("../src/modules/auth/auth.reauth.js", () => ({
  requireRecentPasswordReauth: reauthMock,
}));

vi.mock("../src/modules/notifications/notification.service.js", () => ({
  createNotification: createNotificationMock,
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

const mockSelectExecResolved = <T>(value: T) => ({
  select: vi.fn().mockReturnValue(mockExecResolved(value)),
});

describe("trusted contact service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sendTransactionalEmailMock.mockClear();
    createAuditLogMock.mockClear();
    reauthMock.mockClear();
    createNotificationMock.mockClear();
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
    vi.spyOn(UserModel, "findOne").mockReturnValue(mockSelectExecResolved(null) as never);
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

  it("lists pending invitations for the authenticated user email with owner details", async () => {
    const ownerId = new Types.ObjectId();
    const invitation = new TrustedContactModel({
      _id: new Types.ObjectId(),
      userId: ownerId,
      name: "Trusted Person",
      email: "trusted@example.com",
      phone: "+15551234567",
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
      inviteTokenExpiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(TrustedContactModel, "find").mockReturnValue({
      sort: vi.fn().mockReturnValue(mockExecResolved([invitation])),
    } as never);
    vi.spyOn(UserModel, "find").mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue(
          mockExecResolved([
            {
              _id: ownerId,
              name: "Owner",
              email: "owner@example.com",
              profilePicture: {
                url: "https://example.com/profile.jpg",
              },
            },
          ]),
        ),
      }),
    } as never);

    const result = await trustedContactService.listTrustedContactInvitations({
      id: new Types.ObjectId().toString(),
      email: "trusted@example.com",
      role: "user",
      tokenVersion: 0,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      ownerId: ownerId.toString(),
      owner: {
        id: ownerId.toString(),
        name: "Owner",
        email: "owner@example.com",
        profilePicture: {
          url: "https://example.com/profile.jpg",
        },
      },
      trustedContact: {
        name: "Trusted Person",
        email: "trusted@example.com",
        phone: "+15551234567",
      },
      status: "pending",
    });
  });

  it("allows an authenticated user to accept their pending invitation by id", async () => {
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

    vi.spyOn(TrustedContactModel, "findOne").mockReturnValue(
      mockExecResolved(trustedContact) as never,
    );
    vi.spyOn(trustedContact, "save").mockResolvedValue(trustedContact);

    const result = await trustedContactService.acceptTrustedContactInvitationById(
      {
        id: new Types.ObjectId().toString(),
        email: "trusted@example.com",
        role: "user",
        tokenVersion: 0,
      },
      { id: trustedContact._id.toString() },
      {},
    );

    expect(result.trustedContact.status).toBe("accepted");
    expect(trustedContact.inviteTokenHash).toBeUndefined();
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "trusted_contact_invite_accepted",
        actorType: "user",
      }),
    );
  });

  it("allows an authenticated user to accept by id even if the email token has expired", async () => {
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
      inviteTokenHash: hashToken("expired-token"),
      inviteTokenExpiresAt: new Date(Date.now() - 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(TrustedContactModel, "findOne").mockReturnValue(
      mockExecResolved(trustedContact) as never,
    );
    vi.spyOn(trustedContact, "save").mockResolvedValue(trustedContact);

    const result = await trustedContactService.acceptTrustedContactInvitationById(
      {
        id: new Types.ObjectId().toString(),
        email: "trusted@example.com",
        role: "user",
        tokenVersion: 0,
      },
      { id: trustedContact._id.toString() },
      {},
    );

    expect(result.trustedContact.status).toBe("accepted");
  });

  it("allows an authenticated user to decline their pending invitation by id", async () => {
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

    vi.spyOn(TrustedContactModel, "findOne").mockReturnValue(
      mockExecResolved(trustedContact) as never,
    );
    vi.spyOn(trustedContact, "save").mockResolvedValue(trustedContact);

    const result = await trustedContactService.declineTrustedContactInvitationById(
      {
        id: new Types.ObjectId().toString(),
        email: "trusted@example.com",
        role: "user",
        tokenVersion: 0,
      },
      { id: trustedContact._id.toString() },
      {},
    );

    expect(result).toMatchObject({
      message: "Trusted contact invitation declined.",
    });
    expect(trustedContact.status).toBe("declined");
    expect(trustedContact.inviteTokenHash).toBeUndefined();
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "trusted_contact_invite_declined",
        actorType: "user",
      }),
    );
  });
});
