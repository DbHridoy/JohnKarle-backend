import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.LOG_LEVEL = "silent";

const sendMailMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../src/utils/mail.util.js", () => ({
  getMailTransporter: () => ({
    sendMail: sendMailMock,
  }),
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
    sendMailMock.mockClear();
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
    expect(sendMailMock).toHaveBeenCalledTimes(1);
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
});
