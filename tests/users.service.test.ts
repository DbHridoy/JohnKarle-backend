import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.LOG_LEVEL = "silent";

const sendTransactionalEmailMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../src/utils/mail.util.js", () => ({
  sendTransactionalEmail: sendTransactionalEmailMock,
}));

const userService = await import("../src/modules/users/user.service.js");
const { UserModel } = await import("../src/modules/users/user.model.js");
const { UserFamilyInvitationModel } =
  await import("../src/modules/users/user-family-invitation.model.js");
const { hashToken } = await import("../src/utils/token.util.js");

const mockExecResolved = <T>(value: T) => ({
  exec: vi.fn().mockResolvedValue(value),
});

describe("user family invitations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sendTransactionalEmailMock.mockClear();
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

  it("lists pending invitations and accepted family members for the authenticated user", async () => {
    const userId = new Types.ObjectId();
    const user = new UserModel({
      _id: userId,
      name: "Invited User",
      email: "invited@example.com",
      passwordHash: "hash",
      role: "user",
      isEmailVerified: true,
      familyMembers: [
        {
          userId: new Types.ObjectId().toString(),
          name: "Accepted Member",
          email: "accepted@example.com",
          relation: "brother",
          role: "viewer",
          status: "accepted",
        },
        {
          userId: new Types.ObjectId().toString(),
          name: "Pending Member",
          email: "pending@example.com",
          relation: "sister",
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
      inviterId: new Types.ObjectId(),
      inviteeUserId: userId,
      inviteeName: "Invited User",
      inviteeEmail: "invited@example.com",
      relation: "brother",
      role: "editor",
      tokenHash: hashToken("token"),
      expiresAt: new Date(Date.now() + 60_000),
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(UserFamilyInvitationModel, "find").mockReturnValue({
      sort: vi.fn().mockReturnValue(mockExecResolved([invitation])),
    } as never);
    vi.spyOn(UserModel, "findById").mockReturnValue(mockExecResolved(user) as never);

    const invitations = await userService.listInvitations({
      id: userId.toString(),
      email: user.email,
      role: "user",
      tokenVersion: 0,
    });
    const familyMembers = await userService.listFamilyMembers({
      id: userId.toString(),
      email: user.email,
      role: "user",
      tokenVersion: 0,
    });

    expect(invitations).toHaveLength(1);
    expect(invitations[0]?.relation).toBe("brother");
    expect(familyMembers).toHaveLength(1);
    expect(familyMembers[0]?.status).toBe("accepted");
  });

  it("marks the family member as accepted when an existing user accepts the invitation", async () => {
    const inviterId = new Types.ObjectId();
    const existingUserId = new Types.ObjectId();
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
      _id: new Types.ObjectId(),
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
    vi.spyOn(existingUser, "save").mockResolvedValue(existingUser);
    vi.spyOn(inviter, "save").mockResolvedValue(inviter);
    vi.spyOn(invitation, "save").mockResolvedValue(invitation);

    const result = await userService.acceptInvitation({ token });

    expect(result.email).toBe(existingUser.email);
    expect(invitation.status).toBe("accepted");
    expect(inviter.familyMembers[0]?.status).toBe("accepted");
    expect(inviter.familyMembers[0]?.name).toBe(existingUser.name);
    expect(inviter.familyMembers[0]?.relation).toBe("brother");
  });

  it("declines a pending invitation and removes the pending family member entry", async () => {
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
    vi.spyOn(inviter, "save").mockResolvedValue(inviter);
    vi.spyOn(invitation, "save").mockResolvedValue(invitation);

    const result = await userService.declineInvitationById(
      {
        id: inviteeUserId.toString(),
        email: "invitee@example.com",
        role: "user",
        tokenVersion: 0,
      },
      { invitationId: invitation._id.toString() },
    );

    expect(result.message).toBe("Invitation declined successfully.");
    expect(invitation.status).toBe("declined");
    expect(inviter.familyMembers).toHaveLength(0);
  });
});
