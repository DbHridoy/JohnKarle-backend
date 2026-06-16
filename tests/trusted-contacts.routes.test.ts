import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.LOG_LEVEL = "silent";

const verifyTokenMock = vi.fn();
const listTrustedContactInvitationsMock = vi.fn();
const acceptTrustedContactInvitationByIdMock = vi.fn();
const declineTrustedContactInvitationByIdMock = vi.fn();

vi.mock("../src/modules/auth/auth.tokens.js", () => ({
  verifyToken: verifyTokenMock,
}));

vi.mock("../src/modules/legacy-access/legacy-access.activity.js", () => ({
  trackAuthenticatedUserActivity: (_req: unknown, _res: unknown, next: (error?: unknown) => void) =>
    next(),
}));

vi.mock("../src/modules/trusted-contacts/trusted-contact.service.js", () => ({
  createTrustedContact: vi.fn(),
  listTrustedContacts: vi.fn(),
  listTrustedContactInvitations: listTrustedContactInvitationsMock,
  updateTrustedContact: vi.fn(),
  removeTrustedContact: vi.fn(),
  getTrustedContactInvitation: vi.fn(),
  acceptTrustedContactInvitationById: acceptTrustedContactInvitationByIdMock,
  declineTrustedContactInvitationById: declineTrustedContactInvitationByIdMock,
  acceptTrustedContactInvitation: vi.fn(),
  declineTrustedContactInvitation: vi.fn(),
}));

const { createApp } = await import("../src/app.js");
const { UserModel } = await import("../src/modules/users/user.model.js");

const app = createApp();

const authHeadersFor = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

const mockExecResolved = <T>(value: T) => ({
  exec: vi.fn().mockResolvedValue(value),
});

describe("trusted contact invitation routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    verifyTokenMock.mockReturnValue({
      sub: "507f1f77bcf86cd799439013",
      email: "user@example.com",
      role: "user",
      tokenVersion: 0,
      type: "access",
    });

    vi.spyOn(UserModel, "findById").mockReturnValue(
      mockExecResolved({
        _id: "507f1f77bcf86cd799439013",
        email: "user@example.com",
        role: "user",
        refreshTokenVersion: 0,
      }) as never,
    );

    listTrustedContactInvitationsMock.mockResolvedValue([
      {
        id: "507f1f77bcf86cd799439101",
        ownerId: "507f1f77bcf86cd799439011",
        owner: {
          id: "507f1f77bcf86cd799439011",
          name: "Owner",
          email: "owner@example.com",
        },
        trustedContact: {
          name: "User",
          email: "user@example.com",
        },
        status: "pending",
        inactivityDays: 90,
        accessScope: {
          profile: true,
          documents: false,
          notes: false,
          messages: false,
          paymentInfo: false,
          accountTransfer: false,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    acceptTrustedContactInvitationByIdMock.mockResolvedValue({
      trustedContact: {
        id: "507f1f77bcf86cd799439101",
        status: "accepted",
      },
      message: "Trusted contact invitation accepted.",
    });
    declineTrustedContactInvitationByIdMock.mockResolvedValue({
      message: "Trusted contact invitation declined.",
    });
  });

  it("requires authentication to list trusted-contact invitations", async () => {
    const response = await request(app).get("/api/v1/trusted-contacts/invitations");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      message: "Authentication token is required.",
    });
  });

  it("lists trusted-contact invitations for the authenticated user", async () => {
    const response = await request(app)
      .get("/api/v1/trusted-contacts/invitations")
      .set(authHeadersFor("user-token"));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Trusted contact invitations fetched successfully.",
      data: [
        {
          id: "507f1f77bcf86cd799439101",
          ownerId: "507f1f77bcf86cd799439011",
          status: "pending",
        },
      ],
    });
    expect(listTrustedContactInvitationsMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "507f1f77bcf86cd799439013" }),
    );
  });

  it("accepts a trusted-contact invitation by id", async () => {
    const response = await request(app)
      .post("/api/v1/trusted-contacts/invitations/507f1f77bcf86cd799439101/accept")
      .set(authHeadersFor("user-token"));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Trusted contact invitation accepted.",
      data: {
        id: "507f1f77bcf86cd799439101",
        status: "accepted",
      },
    });
  });

  it("declines a trusted-contact invitation by id", async () => {
    const response = await request(app)
      .post("/api/v1/trusted-contacts/invitations/507f1f77bcf86cd799439101/decline")
      .set(authHeadersFor("user-token"));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Trusted contact invitation declined.",
    });
  });

  it("validates trusted-contact invitation ids", async () => {
    const response = await request(app)
      .post("/api/v1/trusted-contacts/invitations/not-an-id/accept")
      .set(authHeadersFor("user-token"));

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Validation failed",
    });
  });
});
