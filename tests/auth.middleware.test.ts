import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { authorizeAdmin, authorizeSuperAdmin } from "../src/modules/auth/auth.middleware.js";

const createTestApp = () => {
  const app = express();

  app.use(express.json());

  app.use((req, _res, next) => {
    const role = req.header("x-test-role");
    const userId = req.header("x-test-user-id");

    if (role && userId) {
      req.user = {
        id: userId,
        email: `${role}@example.com`,
        role: role as "user" | "admin" | "super_admin",
        tokenVersion: 0,
      };
    }

    next();
  });

  app.get("/admin-only", authorizeAdmin, (_req, res) => {
    res.status(200).json({
      success: true,
    });
  });

  app.get("/super-admin-only", authorizeSuperAdmin, (_req, res) => {
    res.status(200).json({
      success: true,
    });
  });

  app.use(
    (
      error: Error & {
        code?: string;
        statusCode?: number;
      },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.status(error.statusCode ?? 500).json({
        success: false,
        error: {
          code: error.code ?? "INTERNAL_SERVER_ERROR",
          message: error.message,
        },
      });
    },
  );

  return app;
};

describe("auth role middleware", () => {
  const app = createTestApp();

  it("rejects unauthenticated requests", async () => {
    const response = await request(app).get("/admin-only");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "AUTH_REQUIRED",
      },
    });
  });

  it("rejects normal users from admin routes", async () => {
    const response = await request(app)
      .get("/admin-only")
      .set("x-test-user-id", "507f1f77bcf86cd799439011")
      .set("x-test-role", "user");

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "FORBIDDEN",
      },
    });
  });

  it("allows admins on admin routes", async () => {
    const response = await request(app)
      .get("/admin-only")
      .set("x-test-user-id", "507f1f77bcf86cd799439011")
      .set("x-test-role", "admin");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
    });
  });

  it("allows super admins on admin routes", async () => {
    const response = await request(app)
      .get("/admin-only")
      .set("x-test-user-id", "507f1f77bcf86cd799439011")
      .set("x-test-role", "super_admin");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
    });
  });

  it("rejects admins from super-admin-only routes", async () => {
    const response = await request(app)
      .get("/super-admin-only")
      .set("x-test-user-id", "507f1f77bcf86cd799439011")
      .set("x-test-role", "admin");

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "FORBIDDEN",
      },
    });
  });

  it("allows super admins on super-admin-only routes", async () => {
    const response = await request(app)
      .get("/super-admin-only")
      .set("x-test-user-id", "507f1f77bcf86cd799439011")
      .set("x-test-role", "super_admin");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
    });
  });
});
