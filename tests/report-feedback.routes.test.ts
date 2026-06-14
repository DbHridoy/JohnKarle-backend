import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../src/utils/api-error.util.js";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.LOG_LEVEL = "silent";

const verifyTokenMock = vi.fn();
const createReportFeedbackMock = vi.fn();
const listMyReportFeedbackMock = vi.fn();
const getReportFeedbackMock = vi.fn();
const addUserReportFeedbackReplyMock = vi.fn();
const listAdminReportFeedbackMock = vi.fn();
const addAdminReportFeedbackReplyMock = vi.fn();
const updateAdminReportFeedbackStatusMock = vi.fn();

vi.mock("../src/modules/auth/auth.tokens.js", () => ({
  verifyToken: verifyTokenMock,
}));

vi.mock("../src/modules/legacy-access/legacy-access.activity.js", () => ({
  trackAuthenticatedUserActivity: (_req: unknown, _res: unknown, next: (error?: unknown) => void) =>
    next(),
}));

vi.mock("../src/modules/report-feedback/report-feedback.service.js", () => ({
  createReportFeedback: createReportFeedbackMock,
  listMyReportFeedback: listMyReportFeedbackMock,
  getReportFeedback: getReportFeedbackMock,
  addUserReportFeedbackReply: addUserReportFeedbackReplyMock,
  listAdminReportFeedback: listAdminReportFeedbackMock,
  addAdminReportFeedbackReply: addAdminReportFeedbackReplyMock,
  updateAdminReportFeedbackStatus: updateAdminReportFeedbackStatusMock,
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

describe("report feedback routes", () => {
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

    createReportFeedbackMock.mockResolvedValue({
      id: "507f1f77bcf86cd799439101",
      userId: "507f1f77bcf86cd799439013",
      type: "problem",
      category: "technical",
      subject: "Cannot upload a file",
      message: "I cannot upload a file from the memory vault page.",
      priority: "medium",
      status: "open",
      attachments: [],
      replies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    listMyReportFeedbackMock.mockResolvedValue({
      reports: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    });
    getReportFeedbackMock.mockResolvedValue({
      id: "507f1f77bcf86cd799439101",
      userId: "507f1f77bcf86cd799439013",
      type: "problem",
      category: "technical",
      subject: "Cannot upload a file",
      message: "I cannot upload a file from the memory vault page.",
      priority: "medium",
      status: "open",
      attachments: [],
      replies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    addUserReportFeedbackReplyMock.mockResolvedValue({
      id: "507f1f77bcf86cd799439101",
      replies: [
        {
          senderRole: "user",
          message: "Any update?",
          attachments: [],
          createdAt: new Date().toISOString(),
        },
      ],
    });
    listAdminReportFeedbackMock.mockResolvedValue({
      reports: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    });
    addAdminReportFeedbackReplyMock.mockResolvedValue({
      id: "507f1f77bcf86cd799439101",
      status: "in_progress",
      replies: [
        {
          senderId: "507f1f77bcf86cd799439011",
          senderRole: "admin",
          message: "We are checking this now.",
          attachments: [],
          createdAt: new Date().toISOString(),
        },
      ],
    });
    updateAdminReportFeedbackStatusMock.mockResolvedValue({
      id: "507f1f77bcf86cd799439101",
      status: "resolved",
    });
  });

  it("requires authentication to create a report", async () => {
    const response = await request(app).post("/api/v1/report-feedback");

    expect(response.status).toBe(401);
  });

  it("creates a report without attachments", async () => {
    const response = await request(app)
      .post("/api/v1/report-feedback")
      .set(authHeadersFor("user-token"))
      .field("type", "problem")
      .field("category", "technical")
      .field("subject", "Cannot upload a file")
      .field("message", "I cannot upload a file from the memory vault page.")
      .field("priority", "medium");

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: "Report created successfully.",
    });
    expect(createReportFeedbackMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "507f1f77bcf86cd799439013" }),
      expect.objectContaining({ type: "problem", category: "technical" }),
      [],
      expect.any(Object),
    );
  });

  it("creates a report with an attachment", async () => {
    const response = await request(app)
      .post("/api/v1/report-feedback")
      .set(authHeadersFor("user-token"))
      .field("type", "feedback")
      .field("category", "general")
      .field("subject", "App feedback")
      .field("message", "This app is good but loading could be faster.")
      .attach("attachments", Buffer.from("hello world"), "feedback.txt");

    expect(response.status).toBe(201);
    const files = createReportFeedbackMock.mock.calls.at(-1)?.[2] as Express.Multer.File[];
    expect(files).toHaveLength(1);
    expect(files[0]?.originalname).toBe("feedback.txt");
  });

  it("rejects invalid report payloads", async () => {
    const response = await request(app)
      .post("/api/v1/report-feedback")
      .set(authHeadersFor("user-token"))
      .field("type", "incident")
      .field("category", "technical")
      .field("subject", "Bad")
      .field("message", "short");

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Validation failed",
    });
  });

  it("lists only the authenticated user's reports", async () => {
    const response = await request(app)
      .get("/api/v1/report-feedback/my?page=2&limit=10&type=problem&status=open&priority=high")
      .set(authHeadersFor("user-token"));

    expect(response.status).toBe(200);
    expect(listMyReportFeedbackMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "507f1f77bcf86cd799439013" }),
      {
        page: 2,
        limit: 10,
        type: "problem",
        status: "open",
        priority: "high",
      },
    );
  });

  it("blocks a user from accessing another user's report", async () => {
    getReportFeedbackMock.mockRejectedValueOnce(
      new ApiError(403, "You do not have permission to access this report.", "FORBIDDEN"),
    );

    const response = await request(app)
      .get("/api/v1/report-feedback/507f1f77bcf86cd799439101")
      .set(authHeadersFor("user-token"));

    expect(response.status).toBe(403);
  });

  it("allows a user to reply to their own report", async () => {
    const response = await request(app)
      .post("/api/v1/report-feedback/507f1f77bcf86cd799439101/replies")
      .set(authHeadersFor("user-token"))
      .field("message", "Any update?");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Reply added successfully.",
    });
  });

  it("rejects replying to a closed report", async () => {
    addUserReportFeedbackReplyMock.mockRejectedValueOnce(
      new ApiError(400, "Closed reports cannot receive new replies.", "REPORT_FEEDBACK_CLOSED"),
    );

    const response = await request(app)
      .post("/api/v1/report-feedback/507f1f77bcf86cd799439101/replies")
      .set(authHeadersFor("user-token"))
      .field("message", "Any update?");

    expect(response.status).toBe(400);
  });

  it("allows admins to list all reports", async () => {
    const response = await request(app)
      .get(
        "/api/v1/admin/report-feedback?page=1&limit=20&status=open&type=problem&priority=high&userId=507f1f77bcf86cd799439013&search=upload",
      )
      .set(authHeadersFor("admin-token"));

    expect(response.status).toBe(200);
    expect(listAdminReportFeedbackMock).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: "open",
      type: "problem",
      priority: "high",
      userId: "507f1f77bcf86cd799439013",
      search: "upload",
    });
  });

  it("allows admins to view any report", async () => {
    const response = await request(app)
      .get("/api/v1/admin/report-feedback/507f1f77bcf86cd799439101")
      .set(authHeadersFor("admin-token"));

    expect(response.status).toBe(200);
  });

  it("allows admins to reply to a report", async () => {
    const response = await request(app)
      .post("/api/v1/admin/report-feedback/507f1f77bcf86cd799439101/replies")
      .set(authHeadersFor("admin-token"))
      .field("message", "We are checking this now.");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Reply added successfully.",
    });
  });

  it("updates report status from the admin route", async () => {
    const response = await request(app)
      .patch("/api/v1/admin/report-feedback/507f1f77bcf86cd799439101/status")
      .set(authHeadersFor("admin-token"))
      .send({
        status: "resolved",
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Report status updated successfully.",
    });
  });

  it("forbids non-admin access to admin report routes", async () => {
    const response = await request(app)
      .get("/api/v1/admin/report-feedback")
      .set(authHeadersFor("user-token"));

    expect(response.status).toBe(403);
  });

  it("rejects unsupported attachment types", async () => {
    const response = await request(app)
      .post("/api/v1/report-feedback")
      .set(authHeadersFor("user-token"))
      .field("type", "feedback")
      .field("category", "general")
      .field("subject", "Executable attachment")
      .field("message", "This should fail because the attachment type is unsafe.")
      .attach("attachments", Buffer.from("binary"), "malware.exe");

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Unsupported attachment type.",
    });
  });

  it("rejects too many attachments", async () => {
    let requestBuilder = request(app)
      .post("/api/v1/report-feedback")
      .set(authHeadersFor("user-token"))
      .field("type", "feedback")
      .field("category", "general")
      .field("subject", "Too many attachments")
      .field("message", "This should fail because it exceeds the attachment count limit.");

    for (let index = 0; index < 6; index += 1) {
      requestBuilder = requestBuilder.attach(
        "attachments",
        Buffer.from(`file-${index}`),
        `file-${index}.txt`,
      );
    }

    const response = await requestBuilder;

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Too many files",
    });
  });
});
