import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.LOG_LEVEL = "silent";

const verifyTokenMock = vi.fn();
const listMyNotificationsMock = vi.fn();
const getUnreadCountMock = vi.fn();
const markAsReadMock = vi.fn();
const markAllAsReadMock = vi.fn();
const deleteMyNotificationMock = vi.fn();
const createAdminBroadcastMock = vi.fn();

vi.mock("../src/modules/auth/auth.tokens.js", () => ({
  verifyToken: verifyTokenMock,
}));

vi.mock("../src/modules/legacy-access/legacy-access.activity.js", () => ({
  trackAuthenticatedUserActivity: (_req: unknown, _res: unknown, next: (error?: unknown) => void) =>
    next(),
}));

vi.mock("../src/modules/notifications/notification.service.js", () => ({
  listMyNotifications: listMyNotificationsMock,
  getUnreadCount: getUnreadCountMock,
  markAsRead: markAsReadMock,
  markAllAsRead: markAllAsReadMock,
  deleteMyNotification: deleteMyNotificationMock,
  createAdminBroadcast: createAdminBroadcastMock,
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

describe("notification routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    verifyTokenMock.mockImplementation((token: string) => {
      if (token === "admin-token") {
        return {
          sub: "507f1f77bcf86cd799439011",
          email: "admin@example.com",
          role: "admin",
          tokenVersion: 0,
          type: "access",
        };
      }

      return {
        sub: "507f1f77bcf86cd799439013",
        email: "user@example.com",
        role: "user",
        tokenVersion: 0,
        type: "access",
      };
    });

    vi.spyOn(UserModel, "findById").mockImplementation((userId: string) => {
      if (userId === "507f1f77bcf86cd799439011") {
        return mockExecResolved({
          _id: userId,
          email: "admin@example.com",
          role: "admin",
          refreshTokenVersion: 0,
        }) as never;
      }

      return mockExecResolved({
        _id: userId,
        email: "user@example.com",
        role: "user",
        refreshTokenVersion: 0,
      }) as never;
    });

    listMyNotificationsMock.mockResolvedValue({
      notifications: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    });
    getUnreadCountMock.mockResolvedValue({ count: 3 });
    markAsReadMock.mockResolvedValue({
      id: "507f1f77bcf86cd799439101",
      type: "system",
      title: "Hello",
      message: "World",
      isRead: true,
      priority: "normal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    markAllAsReadMock.mockResolvedValue({ updatedCount: 5 });
    createAdminBroadcastMock.mockResolvedValue({ requestedCount: 2, createdCount: 2 });
  });

  it("requires authentication to list notifications", async () => {
    const response = await request(app).get("/api/v1/notifications");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      message: "Authentication token is required.",
    });
  });

  it("lists the authenticated user's notifications with pagination", async () => {
    const response = await request(app)
      .get("/api/v1/notifications?page=2&limit=10&isRead=false&type=system&priority=high")
      .set(authHeadersFor("user-token"));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Notifications fetched successfully.",
      data: [],
      meta: {
        page: 1,
        limit: 20,
      },
    });
    expect(listMyNotificationsMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "507f1f77bcf86cd799439013" }),
      {
        page: 2,
        limit: 10,
        isRead: false,
        type: "system",
        priority: "high",
      },
    );
  });

  it("returns unread notification count", async () => {
    const response = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set(authHeadersFor("user-token"));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Unread notification count fetched successfully.",
      data: { count: 3 },
    });
  });

  it("marks one notification as read", async () => {
    const response = await request(app)
      .patch("/api/v1/notifications/507f1f77bcf86cd799439101/read")
      .set(authHeadersFor("user-token"));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Notification marked as read.",
      data: {
        id: "507f1f77bcf86cd799439101",
        isRead: true,
      },
    });
  });

  it("marks all notifications as read", async () => {
    const response = await request(app)
      .patch("/api/v1/notifications/read-all")
      .set(authHeadersFor("user-token"));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "All notifications marked as read.",
      data: { updatedCount: 5 },
    });
  });

  it("deletes one notification", async () => {
    const response = await request(app)
      .delete("/api/v1/notifications/507f1f77bcf86cd799439101")
      .set(authHeadersFor("user-token"));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Notification deleted successfully.",
    });
  });

  it("validates notification ids", async () => {
    const response = await request(app)
      .patch("/api/v1/notifications/not-an-id/read")
      .set(authHeadersFor("user-token"));

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Validation failed",
    });
  });

  it("rejects invalid list filters", async () => {
    const response = await request(app)
      .get("/api/v1/notifications?priority=urgent")
      .set(authHeadersFor("user-token"));

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Validation failed",
    });
  });

  it("forbids normal users from admin broadcast", async () => {
    const response = await request(app)
      .post("/api/v1/admin/notifications/broadcast")
      .set(authHeadersFor("user-token"))
      .send({
        recipientIds: ["507f1f77bcf86cd799439201"],
        title: "Hello",
        message: "World",
      });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      message: "You do not have permission to access this resource.",
    });
  });

  it("allows admins to create a broadcast", async () => {
    const response = await request(app)
      .post("/api/v1/admin/notifications/broadcast")
      .set(authHeadersFor("admin-token"))
      .send({
        recipientIds: ["507f1f77bcf86cd799439201", "507f1f77bcf86cd799439202"],
        title: "Hello",
        message: "World",
        type: "admin_broadcast",
        priority: "normal",
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: "Admin broadcast created successfully.",
      data: {
        requestedCount: 2,
        createdCount: 2,
      },
    });
  });

  it("validates admin broadcast payloads", async () => {
    const response = await request(app)
      .post("/api/v1/admin/notifications/broadcast")
      .set(authHeadersFor("admin-token"))
      .send({
        recipientIds: ["bad-id"],
        title: "",
        message: "",
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Validation failed",
    });
  });
});
