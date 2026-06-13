import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../src/utils/api-error.util.js";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.LOG_LEVEL = "silent";

const verifyTokenMock = vi.fn();
const getDashboardMetricsMock = vi.fn();
const listAdminUsersMock = vi.fn();
const getAdminUserByIdMock = vi.fn();
const createAdminUserMock = vi.fn();
const sendBulkEmailMock = vi.fn();
const getAdminProfileMock = vi.fn();
const updateAdminProfileMock = vi.fn();
const changeAdminPasswordMock = vi.fn();
const getAdminSettingsMock = vi.fn();
const updateAdminSettingsMock = vi.fn();

vi.mock("../src/modules/auth/auth.tokens.js", () => ({
  verifyToken: verifyTokenMock,
}));

vi.mock("../src/modules/legacy-access/legacy-access.activity.js", () => ({
  trackAuthenticatedUserActivity: (_req: unknown, _res: unknown, next: (error?: unknown) => void) =>
    next(),
}));

vi.mock("../src/modules/admin/admin.service.js", () => ({
  getDashboardMetrics: getDashboardMetricsMock,
  listAdminUsers: listAdminUsersMock,
  getAdminUserById: getAdminUserByIdMock,
  createAdminUser: createAdminUserMock,
  sendBulkEmail: sendBulkEmailMock,
  getAdminProfile: getAdminProfileMock,
  updateAdminProfile: updateAdminProfileMock,
  changeAdminPassword: changeAdminPasswordMock,
  getAdminSettings: getAdminSettingsMock,
  updateAdminSettings: updateAdminSettingsMock,
}));

const { createApp } = await import("../src/app.js");
const { UserModel } = await import("../src/modules/users/user.model.js");

const app = createApp();

const mockExecResolved = <T>(value: T) => ({
  exec: vi.fn().mockResolvedValue(value),
});

const authHeadersFor = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

describe("admin routes", () => {
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

      if (token === "super-token") {
        return {
          sub: "507f1f77bcf86cd799439012",
          email: "super@example.com",
          role: "super_admin",
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

      if (userId === "507f1f77bcf86cd799439012") {
        return mockExecResolved({
          _id: userId,
          email: "super@example.com",
          role: "super_admin",
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

    getDashboardMetricsMock.mockResolvedValue({
      totalUsers: 10,
      totalActiveProfiles: 4,
    });
    listAdminUsersMock.mockResolvedValue({
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
    getAdminUserByIdMock.mockResolvedValue({
      id: "507f1f77bcf86cd799439014",
      name: "User",
      email: "user@example.com",
      role: "user",
      isEmailVerified: true,
      familyMembers: [],
      preferences: {
        notifications: true,
        aiInsight: true,
        darkMode: false,
        anonymousAnalytics: true,
      },
      legacyAccessEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    createAdminUserMock.mockResolvedValue({
      id: "507f1f77bcf86cd799439015",
      name: "Admin User",
      email: "admin.user@example.com",
      role: "admin",
      isEmailVerified: false,
      familyMembers: [],
      preferences: {
        notifications: true,
        aiInsight: true,
        darkMode: false,
        anonymousAnalytics: true,
      },
      legacyAccessEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    sendBulkEmailMock.mockResolvedValue({
      requestedCount: 1,
      sentCount: 1,
    });
    getAdminProfileMock.mockResolvedValue({
      id: "507f1f77bcf86cd799439011",
      name: "Admin",
      email: "admin@example.com",
      role: "admin",
      isEmailVerified: true,
      familyMembers: [],
      preferences: {
        notifications: true,
        aiInsight: true,
        darkMode: false,
        anonymousAnalytics: true,
      },
      legacyAccessEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    updateAdminProfileMock.mockResolvedValue({
      id: "507f1f77bcf86cd799439011",
      name: "Admin",
      email: "admin@example.com",
      role: "admin",
      isEmailVerified: true,
      familyMembers: [],
      preferences: {
        notifications: true,
        aiInsight: true,
        darkMode: false,
        anonymousAnalytics: true,
      },
      legacyAccessEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    changeAdminPasswordMock.mockResolvedValue({
      message: "Password updated successfully.",
    });
    getAdminSettingsMock.mockResolvedValue({});
    updateAdminSettingsMock.mockResolvedValue({
      aboutUs: "About text",
      updatedBy: "507f1f77bcf86cd799439012",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  it("rejects unauthenticated metrics requests", async () => {
    const response = await request(app).get("/api/v1/admin/dashboard/metrics");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      message: "Authentication token is required.",
    });
  });

  it("rejects normal users from metrics route", async () => {
    const response = await request(app)
      .get("/api/v1/admin/dashboard/metrics")
      .set(authHeadersFor("user-token"));

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      message: "You do not have permission to access this resource.",
    });
  });

  it("allows admins on metrics route", async () => {
    const response = await request(app)
      .get("/api/v1/admin/dashboard/metrics")
      .set(authHeadersFor("admin-token"));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Dashboard metrics fetched successfully.",
      data: {
        totalUsers: 10,
        totalActiveProfiles: 4,
      },
    });
  });

  it("allows super admins on metrics route", async () => {
    const response = await request(app)
      .get("/api/v1/admin/dashboard/metrics")
      .set(authHeadersFor("super-token"));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Dashboard metrics fetched successfully.",
      data: {
        totalUsers: 10,
        totalActiveProfiles: 4,
      },
    });
  });

  it("validates admin user id params", async () => {
    const response = await request(app)
      .get("/api/v1/admin/users/not-an-id")
      .set(authHeadersFor("admin-token"));

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Validation failed",
    });
  });

  it("rejects unauthenticated user list requests", async () => {
    const response = await request(app).get("/api/v1/admin/users");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      message: "Authentication token is required.",
    });
  });

  it("rejects normal users from the user list route", async () => {
    const response = await request(app)
      .get("/api/v1/admin/users")
      .set(authHeadersFor("user-token"));

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      message: "You do not have permission to access this resource.",
    });
  });

  it("uses validated default pagination on the user list route", async () => {
    const response = await request(app)
      .get("/api/v1/admin/users")
      .set(authHeadersFor("admin-token"));

    expect(response.status).toBe(200);
    expect(listAdminUsersMock).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
    expect(response.body).toMatchObject({
      success: true,
      message: "Users fetched successfully.",
      data: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });
  });

  it("coerces and forwards query filters without crashing on Express 5 getter-only req.query", async () => {
    listAdminUsersMock.mockResolvedValueOnce({
      users: [],
      pagination: {
        page: 2,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: true,
      },
    });

    const response = await request(app)
      .get("/api/v1/admin/users?page=2&limit=10&search=john&role=admin")
      .set(authHeadersFor("super-token"));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Users fetched successfully.",
      data: [],
      meta: {
        page: 2,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
    expect(listAdminUsersMock).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      search: "john",
      role: "admin",
    });
  });

  it("validates admin user list query params", async () => {
    const response = await request(app)
      .get("/api/v1/admin/users?page=0&limit=101&role=owner")
      .set(authHeadersFor("admin-token"));

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Validation failed",
    });
  });

  it("returns 404 for a missing user detail", async () => {
    getAdminUserByIdMock.mockRejectedValueOnce(
      new ApiError(404, "User not found.", "USER_NOT_FOUND"),
    );

    const response = await request(app)
      .get("/api/v1/admin/users/507f1f77bcf86cd799439099")
      .set(authHeadersFor("admin-token"));

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      message: "User not found.",
    });
  });

  it("rejects admins from the create admin route", async () => {
    const response = await request(app)
      .post("/api/v1/admin/admins")
      .set(authHeadersFor("admin-token"))
      .send({
        name: "Admin User",
        email: "admin.user@example.com",
        password: "Password1",
      });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      message: "You do not have permission to access this resource.",
    });
  });

  it("allows super admins to create admins", async () => {
    const response = await request(app)
      .post("/api/v1/admin/admins")
      .set(authHeadersFor("super-token"))
      .send({
        name: "Admin User",
        email: "admin.user@example.com",
        password: "Password1",
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: "Admin created successfully.",
      data: {
        email: "admin.user@example.com",
        role: "admin",
      },
    });
  });

  it("rejects a role field in create admin payloads", async () => {
    const response = await request(app)
      .post("/api/v1/admin/admins")
      .set(authHeadersFor("super-token"))
      .send({
        name: "Admin User",
        email: "admin.user@example.com",
        password: "Password1",
        role: "super_admin",
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Validation failed",
    });
  });

  it("validates empty bulk-email recipients", async () => {
    const response = await request(app)
      .post("/api/v1/admin/bulk-email")
      .set(authHeadersFor("admin-token"))
      .send({
        userIds: [],
        subject: "Subject",
        message: "Hello there",
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Validation failed",
    });
  });

  it("reads admin profile for admins", async () => {
    const response = await request(app)
      .get("/api/v1/admin/profile")
      .set(authHeadersFor("admin-token"));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Profile fetched successfully.",
      data: {
        email: "admin@example.com",
      },
    });
  });

  it("rejects weak password changes", async () => {
    const response = await request(app)
      .patch("/api/v1/admin/profile/password")
      .set(authHeadersFor("admin-token"))
      .send({
        currentPassword: "Password1",
        newPassword: "weak",
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Validation failed",
    });
  });

  it("allows admins to read settings", async () => {
    const response = await request(app)
      .get("/api/v1/admin/settings")
      .set(authHeadersFor("admin-token"));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Settings fetched successfully.",
    });
  });

  it("rejects admins from patching settings", async () => {
    const response = await request(app)
      .patch("/api/v1/admin/settings")
      .set(authHeadersFor("admin-token"))
      .send({
        aboutUs: "Updated",
      });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      message: "You do not have permission to access this resource.",
    });
  });

  it("allows super admins to patch settings", async () => {
    const response = await request(app)
      .patch("/api/v1/admin/settings")
      .set(authHeadersFor("super-token"))
      .send({
        aboutUs: "Updated",
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Settings updated successfully.",
      data: {
        aboutUs: "About text",
      },
    });
  });
});
