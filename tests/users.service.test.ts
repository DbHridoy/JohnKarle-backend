import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.LOG_LEVEL = "silent";

const sendTransactionalEmailMock = vi.fn().mockResolvedValue(undefined);
const createNotificationMock = vi.fn().mockResolvedValue(null);
const createAuditLogMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../src/utils/mail.util.js", () => ({
  sendTransactionalEmail: sendTransactionalEmailMock,
}));

vi.mock("../src/modules/notifications/notification.service.js", () => ({
  createNotification: createNotificationMock,
}));

vi.mock("../src/modules/audit-logs/audit-log.service.js", () => ({
  createAuditLog: createAuditLogMock,
}));

const userService = await import("../src/modules/users/user.service.js");
const { UserModel } = await import("../src/modules/users/user.model.js");
const { UserFamilyInvitationModel } =
  await import("../src/modules/users/user-family-invitation.model.js");
const { UserFamilyMembershipModel } =
  await import("../src/modules/users/user-family-membership.model.js");
const { buildFamilyPairKey } =
  await import("../src/modules/users/user-family-membership.service.js");
const { hashToken } = await import("../src/utils/token.util.js");

const mockExecResolved = <T>(value: T) => ({
  exec: vi.fn().mockResolvedValue(value),
});

describe("user family invitations and memberships", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sendTransactionalEmailMock.mockClear();
    createNotificationMock.mockClear();
    createAuditLogMock.mockClear();
  });

  it("creates a pending in-app family-member invitation for an existing user without sending email", async () => {
    const inviterId = new Types.ObjectId();
    const existingUserId = new Types.ObjectId();
    const inviter = new UserModel({
      _id: inviterId,
      name: "Inviter",
      email: "inviter@example.com",
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
    const existingUser = new UserModel({
      _id: existingUserId,
      name: "User A",
      email: "usera@example.com",
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

    vi.spyOn(UserModel, "findById").mockReturnValue(mockExecResolved(inviter) as never);
    vi.spyOn(UserModel, "findOne").mockReturnValue(mockExecResolved(existingUser) as never);
    vi.spyOn(UserFamilyMembershipModel, "exists").mockReturnValue(mockExecResolved(null) as never);
    vi.spyOn(UserFamilyInvitationModel, "exists").mockReturnValue(mockExecResolved(null) as never);
    const createInvitationSpy = vi
      .spyOn(UserFamilyInvitationModel, "create")
      .mockImplementation(async (payload) => {
        return new UserFamilyInvitationModel({
          _id: new Types.ObjectId(),
          ...payload,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });
    const createUserSpy = vi.spyOn(UserModel, "create");
    vi.spyOn(inviter, "save").mockResolvedValue(inviter);

    const result = await userService.createInvitation(
      {
        id: inviterId.toString(),
        email: inviter.email,
        role: "user",
        tokenVersion: 0,
      },
      {
        name: "User A",
        email: existingUser.email,
        relation: "brother",
        role: "editor",
      },
    );

    expect(result.invitation.status).toBe("pending");
    expect(result.invitation.isExistingUser).toBe(true);
    expect(createUserSpy).not.toHaveBeenCalled();
    expect(inviter.familyMembers).toMatchObject([
      {
        email: existingUser.email,
        relation: "brother",
        role: "editor",
        status: "pending",
        userId: existingUserId.toString(),
      },
    ]);
    expect(createInvitationSpy).toHaveBeenCalledTimes(1);
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
    expect(createNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: existingUserId,
        actor: inviterId,
        type: "family_invitation_received",
      }),
    );
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: inviterId.toString(),
        action: "family_invitation_created",
        targetType: "family_invitation",
        targetLabel: existingUser.email,
      }),
    );
  });

  it("emails invitation details when the invited family member does not already have an account", async () => {
    const inviterId = new Types.ObjectId();
    const createdUserId = new Types.ObjectId();
    const inviter = new UserModel({
      _id: inviterId,
      name: "Inviter",
      email: "inviter@example.com",
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
    const createdUser = new UserModel({
      _id: createdUserId,
      name: "New Invitee",
      email: "new.invitee@example.com",
      passwordHash: "hash",
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

    vi.spyOn(UserModel, "findById").mockReturnValue(mockExecResolved(inviter) as never);
    vi.spyOn(UserModel, "findOne").mockReturnValue(mockExecResolved(null) as never);
    vi.spyOn(UserFamilyMembershipModel, "exists").mockReturnValue(mockExecResolved(null) as never);
    vi.spyOn(UserFamilyInvitationModel, "exists").mockReturnValue(mockExecResolved(null) as never);
    vi.spyOn(UserFamilyInvitationModel, "create").mockImplementation(async (payload) => {
      return new UserFamilyInvitationModel({
        _id: new Types.ObjectId(),
        ...payload,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
    vi.spyOn(UserModel, "create").mockResolvedValue(createdUser);
    vi.spyOn(inviter, "save").mockResolvedValue(inviter);

    await userService.createInvitation(
      {
        id: inviterId.toString(),
        email: inviter.email,
        role: "user",
        tokenVersion: 0,
      },
      {
        name: "New Invitee",
        email: createdUser.email,
        relation: "brother",
        role: "viewer",
      },
    );

    expect(sendTransactionalEmailMock).toHaveBeenCalledTimes(1);
    expect(createNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: createdUserId,
        actor: inviterId,
        type: "family_invitation_received",
      }),
    );
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: inviterId.toString(),
        action: "family_invitation_created",
        targetType: "family_invitation",
        targetLabel: createdUser.email,
      }),
    );
  });

  it("creates a normalized membership record when an invitation is accepted", async () => {
    const inviterId = new Types.ObjectId();
    const existingUserId = new Types.ObjectId();
    const invitationId = new Types.ObjectId();
    const token = "existing-user-invite-token";
    const inviter = new UserModel({
      _id: inviterId,
      name: "Inviter",
      email: "inviter@example.com",
      passwordHash: "hash",
      role: "user",
      isEmailVerified: true,
      familyMembers: [
        {
          userId: existingUserId.toString(),
          name: "User A",
          email: "usera@example.com",
          relation: "brother",
          role: "editor",
          status: "pending",
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
    const existingUser = new UserModel({
      _id: existingUserId,
      name: "User A",
      email: "usera@example.com",
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
    const invitation = new UserFamilyInvitationModel({
      _id: invitationId,
      inviterId,
      inviteeUserId: existingUserId,
      inviteeName: "User A",
      inviteeEmail: "usera@example.com",
      relation: "brother",
      role: "editor",
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60_000),
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(UserFamilyInvitationModel, "findOne").mockReturnValue({
      select: vi.fn().mockReturnValue(mockExecResolved(invitation)),
    } as never);
    vi.spyOn(UserModel, "findById")
      .mockReturnValueOnce(mockExecResolved(existingUser) as never)
      .mockReturnValueOnce(mockExecResolved(inviter) as never);
    vi.spyOn(UserFamilyMembershipModel, "findOne").mockReturnValue(mockExecResolved(null) as never);
    const createMembershipSpy = vi
      .spyOn(UserFamilyMembershipModel, "create")
      .mockImplementation(async (payload) => {
        return new UserFamilyMembershipModel({
          _id: new Types.ObjectId(),
          ...payload,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });
    vi.spyOn(existingUser, "save").mockResolvedValue(existingUser);
    vi.spyOn(inviter, "save").mockResolvedValue(inviter);
    vi.spyOn(invitation, "save").mockResolvedValue(invitation);

    const result = await userService.acceptInvitation({ token });

    expect(result.email).toBe(existingUser.email);
    expect(invitation.status).toBe("accepted");
    expect(createMembershipSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterId: inviter._id.toString(),
        recipientId: existingUser._id.toString(),
        pairKey: buildFamilyPairKey(inviterId, existingUserId),
        status: "accepted",
        sourceInvitationId: invitationId.toString(),
      }),
    );
    expect(inviter.familyMembers[0]?.status).toBe("accepted");
    expect(existingUser.familyMembers[0]?.userId).toBe(inviterId.toString());
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: existingUserId.toString(),
        action: "family_invitation_accepted",
        targetType: "family_invitation",
        targetLabel: existingUser.email,
      }),
    );
  });

  it("lists family members from the normalized membership source of truth", async () => {
    const userId = new Types.ObjectId();
    const counterpartId = new Types.ObjectId();
    const membership = new UserFamilyMembershipModel({
      _id: new Types.ObjectId(),
      requesterId: userId,
      recipientId: counterpartId,
      pairKey: buildFamilyPairKey(userId, counterpartId),
      status: "accepted",
      requesterRelationship: "brother",
      recipientRelationship: "brother",
      requesterRole: "viewer",
      recipientRole: "viewer",
      acceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const counterpartUser = new UserModel({
      _id: counterpartId,
      name: "Accepted Member",
      email: "accepted@example.com",
      profilePicture: {
        key: "users/accepted/profile/avatar.png",
        url: "https://example.com/accepted-avatar.png",
        originalName: "avatar.png",
        mimeType: "image/png",
        size: 1200,
      },
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

    vi.spyOn(UserFamilyMembershipModel, "find").mockReturnValue({
      sort: vi.fn().mockReturnValue(mockExecResolved([membership])),
    } as never);
    vi.spyOn(UserModel, "find").mockReturnValue(mockExecResolved([counterpartUser]) as never);

    const familyMembers = await userService.listFamilyMembers({
      id: userId.toString(),
      email: "invited@example.com",
      role: "user",
      tokenVersion: 0,
    });

    expect(familyMembers).toEqual([
      {
        userId: counterpartId.toString(),
        name: "Accepted Member",
        email: "accepted@example.com",
        profilePicture: counterpartUser.profilePicture,
        relation: "brother",
        role: "viewer",
        status: "accepted",
      },
    ]);
  });

  it("hydrates family member profile pictures on the current user profile", async () => {
    const userId = new Types.ObjectId();
    const familyMemberUserId = new Types.ObjectId();
    const familyProfilePicture = {
      key: "users/family/profile/avatar.png",
      url: "https://example.com/family-avatar.png",
      originalName: "avatar.png",
      mimeType: "image/png",
      size: 2400,
    };
    const user = new UserModel({
      _id: userId,
      name: "Current User",
      email: "current@example.com",
      passwordHash: "hash",
      role: "user",
      isEmailVerified: true,
      familyMembers: [
        {
          userId: familyMemberUserId.toString(),
          name: "Family Member",
          email: "family@example.com",
          relation: "brother",
          role: "viewer",
          status: "pending",
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

    vi.spyOn(UserModel, "findById").mockReturnValue(mockExecResolved(user) as never);
    vi.spyOn(UserModel, "find").mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue(
          mockExecResolved([
            {
              _id: familyMemberUserId,
              email: "family@example.com",
              profilePicture: familyProfilePicture,
            },
          ]),
        ),
      }),
    } as never);

    const profile = await userService.getProfile({
      id: userId.toString(),
      email: user.email,
      role: "user",
      tokenVersion: 0,
    });

    expect(profile.familyMembers).toEqual([
      expect.objectContaining({
        userId: familyMemberUserId.toString(),
        email: "family@example.com",
        profilePicture: familyProfilePicture,
      }),
    ]);
  });

  it("lists pending invitations sent by or addressed to the authenticated user", async () => {
    const userId = new Types.ObjectId();
    const senderProfilePicture = {
      key: "users/sender/profile/avatar.png",
      url: "https://example.com/avatar.png",
      originalName: "avatar.png",
      mimeType: "image/png",
      size: 1234,
    };
    const sentInvitation = new UserFamilyInvitationModel({
      _id: new Types.ObjectId(),
      inviterId: userId,
      inviteeUserId: new Types.ObjectId(),
      inviteeName: "Invited User",
      inviteeEmail: "invited@example.com",
      relation: "brother",
      role: "editor",
      tokenHash: hashToken("sent-token"),
      expiresAt: new Date(Date.now() + 60_000),
      status: "pending",
      createdAt: new Date("2026-06-16T00:00:00.000Z"),
      updatedAt: new Date("2026-06-16T00:00:00.000Z"),
    });
    const receivedInvitation = new UserFamilyInvitationModel({
      _id: new Types.ObjectId(),
      inviterId: new Types.ObjectId(),
      inviteeUserId: userId,
      inviteeName: "Current User",
      inviteeEmail: "current@example.com",
      relation: "sister",
      role: "viewer",
      tokenHash: hashToken("received-token"),
      expiresAt: new Date(Date.now() + 60_000),
      status: "pending",
      createdAt: new Date("2026-06-15T00:00:00.000Z"),
      updatedAt: new Date("2026-06-15T00:00:00.000Z"),
    });

    const inviters = [
      {
        _id: userId,
        name: "Current User",
        email: "current@example.com",
      },
      {
        _id: receivedInvitation.inviterId,
        name: "Sender User",
        email: "sender@example.com",
        profilePicture: senderProfilePicture,
      },
    ];

    const selectMock = vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue(mockExecResolved([sentInvitation, receivedInvitation])),
    });
    const findSpy = vi.spyOn(UserFamilyInvitationModel, "find").mockReturnValue({
      select: selectMock,
    } as never);
    const userFindSpy = vi.spyOn(UserModel, "find").mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue(mockExecResolved(inviters)),
      }),
    } as never);

    const invitations = await userService.listInvitations({
      id: userId.toString(),
      email: "current@example.com",
      role: "user",
      tokenVersion: 0,
    });

    expect(findSpy).toHaveBeenCalledWith({
      $or: [
        { inviterId: userId.toString() },
        { inviteeUserId: userId.toString() },
        { inviteeEmail: "current@example.com" },
      ],
      status: "pending",
    });
    expect(selectMock).toHaveBeenCalledWith("+expiresAt");
    expect(userFindSpy).toHaveBeenCalledWith({
      _id: { $in: [userId.toString(), receivedInvitation.inviterId.toString()] },
    });
    expect(invitations).toEqual([
      expect.objectContaining({
        id: sentInvitation._id.toString(),
        inviterId: userId.toString(),
        inviter: {
          id: userId.toString(),
          name: "Current User",
          email: "current@example.com",
        },
        direction: "sent",
        inviteeEmail: "invited@example.com",
      }),
      expect.objectContaining({
        id: receivedInvitation._id.toString(),
        inviterId: receivedInvitation.inviterId.toString(),
        inviter: {
          id: receivedInvitation.inviterId.toString(),
          name: "Sender User",
          email: "sender@example.com",
          profilePicture: senderProfilePicture,
        },
        direction: "received",
        inviteeEmail: "current@example.com",
      }),
    ]);
  });

  it("prevents duplicate accepted relationships for the same direction", async () => {
    const inviterId = new Types.ObjectId();
    const existingUserId = new Types.ObjectId();
    const inviter = new UserModel({
      _id: inviterId,
      name: "Inviter",
      email: "inviter@example.com",
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
    const existingUser = new UserModel({
      _id: existingUserId,
      name: "User A",
      email: "usera@example.com",
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

    vi.spyOn(UserModel, "findById").mockReturnValue(mockExecResolved(inviter) as never);
    vi.spyOn(UserModel, "findOne").mockReturnValue(mockExecResolved(existingUser) as never);
    vi.spyOn(UserFamilyMembershipModel, "exists").mockReturnValue(
      mockExecResolved({ _id: new Types.ObjectId() }) as never,
    );

    await expect(
      userService.createInvitation(
        {
          id: inviterId.toString(),
          email: inviter.email,
          role: "user",
          tokenVersion: 0,
        },
        {
          name: "User A",
          email: existingUser.email,
          relation: "brother",
          role: "editor",
        },
      ),
    ).rejects.toMatchObject({
      code: "FAMILY_MEMBER_ALREADY_EXISTS",
    });
  });

  it("prevents inverse duplicate accepted relationships", async () => {
    const userAId = new Types.ObjectId();
    const userBId = new Types.ObjectId();
    const inviter = new UserModel({
      _id: userBId,
      name: "User B",
      email: "userb@example.com",
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
    const existingUser = new UserModel({
      _id: userAId,
      name: "User A",
      email: "usera@example.com",
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

    vi.spyOn(UserModel, "findById").mockReturnValue(mockExecResolved(inviter) as never);
    vi.spyOn(UserModel, "findOne").mockReturnValue(mockExecResolved(existingUser) as never);
    vi.spyOn(UserFamilyMembershipModel, "exists").mockReturnValue(
      mockExecResolved({ _id: new Types.ObjectId() }) as never,
    );

    await expect(
      userService.createInvitation(
        {
          id: userBId.toString(),
          email: inviter.email,
          role: "user",
          tokenVersion: 0,
        },
        {
          name: "User A",
          email: existingUser.email,
          relation: "sister",
          role: "viewer",
        },
      ),
    ).rejects.toMatchObject({
      code: "FAMILY_MEMBER_ALREADY_EXISTS",
    });
  });

  it("declining an invitation does not create a normalized family membership", async () => {
    const inviterId = new Types.ObjectId();
    const inviteeUserId = new Types.ObjectId();
    const inviter = new UserModel({
      _id: inviterId,
      name: "Inviter",
      email: "inviter@example.com",
      passwordHash: "hash",
      role: "user",
      isEmailVerified: true,
      familyMembers: [
        {
          userId: inviteeUserId.toString(),
          name: "Invitee",
          email: "invitee@example.com",
          relation: "brother",
          role: "viewer",
          status: "pending",
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
    const invitation = new UserFamilyInvitationModel({
      _id: new Types.ObjectId(),
      inviterId,
      inviteeUserId,
      inviteeName: "Invitee",
      inviteeEmail: "invitee@example.com",
      relation: "brother",
      role: "viewer",
      tokenHash: hashToken("token"),
      expiresAt: new Date(Date.now() + 60_000),
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(UserFamilyInvitationModel, "findOne").mockReturnValue(
      mockExecResolved(invitation) as never,
    );
    vi.spyOn(UserModel, "findById").mockReturnValue(mockExecResolved(inviter) as never);
    const membershipCreateSpy = vi.spyOn(UserFamilyMembershipModel, "create");
    vi.spyOn(invitation, "save").mockResolvedValue(invitation);
    vi.spyOn(inviter, "save").mockResolvedValue(inviter);

    const result = await userService.declineInvitationById(
      {
        id: inviteeUserId.toString(),
        email: "invitee@example.com",
        role: "user",
        tokenVersion: 0,
      },
      {
        invitationId: invitation._id.toString(),
      },
    );

    expect(result.message).toBe("Invitation declined successfully.");
    expect(invitation.status).toBe("declined");
    expect(membershipCreateSpy).not.toHaveBeenCalled();
    expect(inviter.familyMembers).toEqual([]);
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: inviteeUserId.toString(),
        action: "family_invitation_declined",
        targetType: "family_invitation",
        targetLabel: "invitee@example.com",
      }),
    );
  });

  it("rejects self-invites", async () => {
    const inviterId = new Types.ObjectId();
    const inviter = new UserModel({
      _id: inviterId,
      name: "Inviter",
      email: "inviter@example.com",
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

    vi.spyOn(UserModel, "findById").mockReturnValue(mockExecResolved(inviter) as never);
    vi.spyOn(UserModel, "findOne").mockReturnValue(mockExecResolved(inviter) as never);

    await expect(
      userService.createInvitation(
        {
          id: inviterId.toString(),
          email: inviter.email,
          role: "user",
          tokenVersion: 0,
        },
        {
          name: inviter.name,
          email: inviter.email,
          relation: "self",
          role: "owner",
        },
      ),
    ).rejects.toMatchObject({
      code: "SELF_FAMILY_INVITE",
    });
  });
});
