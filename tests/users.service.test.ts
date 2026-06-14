import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.LOG_LEVEL = "silent";

const sendTransactionalEmailMock = vi.fn().mockResolvedValue(undefined);
const createNotificationMock = vi.fn().mockResolvedValue(null);

vi.mock("../src/utils/mail.util.js", () => ({
  sendTransactionalEmail: sendTransactionalEmailMock,
}));

vi.mock("../src/modules/notifications/notification.service.js", () => ({
  createNotification: createNotificationMock,
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
  });

  it("creates a pending family-member invitation for an existing user", async () => {
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
    expect(sendTransactionalEmailMock).toHaveBeenCalledTimes(1);
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
        relation: "brother",
        role: "viewer",
        status: "accepted",
      },
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
