import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-enough-length-for-auth-tests";
process.env.LOG_LEVEL = "silent";
process.env.AWS_REGION = "ap-southeast-1";
process.env.S3_BUCKET_NAME = "test-bucket";
process.env.AWS_ACCESS_KEY_ID = "test-access-key";
process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";

const createAuditLogMock = vi.fn().mockResolvedValue(undefined);
const s3SendMock = vi.fn().mockResolvedValue({});

vi.mock("../src/modules/audit-logs/audit-log.service.js", () => ({
  createAuditLog: createAuditLogMock,
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = s3SendMock;
  },
  PutObjectCommand: class {
    constructor(public readonly input: unknown) {}
  },
  DeleteObjectsCommand: class {
    constructor(public readonly input: unknown) {}
  },
}));

const reportFeedbackService =
  await import("../src/modules/report-feedback/report-feedback.service.js");
const { ReportFeedbackModel } =
  await import("../src/modules/report-feedback/report-feedback.model.js");
const { UserModel } = await import("../src/modules/users/user.model.js");

const mockExecResolved = <T>(value: T) => ({
  exec: vi.fn().mockResolvedValue(value),
});

const mockSelectLeanExecResolved = <T>(value: T) => ({
  select: vi.fn().mockReturnValue({
    lean: vi.fn().mockReturnValue(mockExecResolved(value)),
  }),
});

describe("report feedback service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    createAuditLogMock.mockClear();
    s3SendMock.mockClear();
  });

  it("creates a report without attachments", async () => {
    const reportId = new Types.ObjectId();
    const createdAt = new Date();
    const report = new ReportFeedbackModel({
      _id: reportId,
      userId: new Types.ObjectId(),
      type: "problem",
      category: "technical",
      subject: "Cannot upload a file",
      message: "I cannot upload a file from the memory vault page.",
      priority: "medium",
      status: "open",
      attachments: [],
      replies: [],
      createdAt,
      updatedAt: createdAt,
    });

    vi.spyOn(ReportFeedbackModel, "create").mockResolvedValue(report);

    const result = await reportFeedbackService.createReportFeedback(
      {
        id: report.userId.toString(),
        email: "user@example.com",
        role: "user",
        tokenVersion: 0,
      },
      {
        type: "problem",
        category: "technical",
        subject: "Cannot upload a file",
        message: "I cannot upload a file from the memory vault page.",
        priority: "medium",
      },
      [],
      {},
    );

    expect(result).toMatchObject({
      id: reportId.toString(),
      status: "open",
      attachments: [],
    });
    expect(s3SendMock).not.toHaveBeenCalled();
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "report_feedback_created" }),
    );
  });

  it("creates a report with attachments using S3 upload", async () => {
    const userId = new Types.ObjectId();
    const report = new ReportFeedbackModel({
      _id: new Types.ObjectId(),
      userId,
      type: "feedback",
      category: "general",
      subject: "App feedback",
      message: "This app is good but loading could be faster.",
      priority: "medium",
      status: "open",
      attachments: [
        {
          key: "report-feedback/test-key.txt",
          url: "https://test-bucket.s3.ap-southeast-1.amazonaws.com/report-feedback/test-key.txt",
          originalName: "feedback.txt",
          mimeType: "text/plain",
          size: 11,
        },
      ],
      replies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(ReportFeedbackModel, "create").mockResolvedValue(report);

    const result = await reportFeedbackService.createReportFeedback(
      {
        id: userId.toString(),
        email: "user@example.com",
        role: "user",
        tokenVersion: 0,
      },
      {
        type: "feedback",
        category: "general",
        subject: "App feedback",
        message: "This app is good but loading could be faster.",
        priority: "medium",
      },
      [
        {
          buffer: Buffer.from("hello world"),
          fieldname: "attachments",
          mimetype: "text/plain",
          originalname: "feedback.txt",
          size: 11,
        } as Express.Multer.File,
      ],
      {},
    );

    expect(s3SendMock).toHaveBeenCalledTimes(1);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]?.originalName).toBe("feedback.txt");
  });

  it("lists only the requesting user's reports with filters", async () => {
    const recipientId = new Types.ObjectId();
    const report = new ReportFeedbackModel({
      _id: new Types.ObjectId(),
      userId: recipientId,
      type: "problem",
      category: "technical",
      subject: "Cannot upload a file",
      message: "I cannot upload a file from the memory vault page.",
      priority: "high",
      status: "open",
      attachments: [],
      replies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const countSpy = vi
      .spyOn(ReportFeedbackModel, "countDocuments")
      .mockReturnValue(mockExecResolved(1) as never);
    const findSpy = vi.spyOn(ReportFeedbackModel, "find").mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue(mockExecResolved([report])),
        }),
      }),
    } as never);

    const result = await reportFeedbackService.listMyReportFeedback(
      {
        id: recipientId.toString(),
        email: "user@example.com",
        role: "user",
        tokenVersion: 0,
      },
      {
        page: 1,
        limit: 20,
        type: "problem",
        status: "open",
        priority: "high",
      },
    );

    expect(countSpy).toHaveBeenCalled();
    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: recipientId.toString(),
        type: "problem",
        status: "open",
        priority: "high",
      }),
    );
    expect(result.reports).toHaveLength(1);
  });

  it("prevents a user from accessing another user's report", async () => {
    const report = new ReportFeedbackModel({
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      type: "problem",
      category: "technical",
      subject: "Cannot upload a file",
      message: "I cannot upload a file from the memory vault page.",
      priority: "medium",
      status: "open",
      attachments: [],
      replies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(ReportFeedbackModel, "findById").mockReturnValue(mockExecResolved(report) as never);

    await expect(
      reportFeedbackService.getReportFeedback(
        {
          id: new Types.ObjectId().toString(),
          email: "other@example.com",
          role: "user",
          tokenVersion: 0,
        },
        { reportId: report._id.toString() },
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows a user to add a reply to their own open report", async () => {
    const userId = new Types.ObjectId();
    const report = new ReportFeedbackModel({
      _id: new Types.ObjectId(),
      userId,
      type: "problem",
      category: "technical",
      subject: "Cannot upload a file",
      message: "I cannot upload a file from the memory vault page.",
      priority: "medium",
      status: "open",
      attachments: [],
      replies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(ReportFeedbackModel, "findById").mockReturnValue(mockExecResolved(report) as never);
    vi.spyOn(report, "save").mockResolvedValue(report);

    const result = await reportFeedbackService.addUserReportFeedbackReply(
      {
        id: userId.toString(),
        email: "user@example.com",
        role: "user",
        tokenVersion: 0,
      },
      { reportId: report._id.toString() },
      { message: "Any update?" },
      [],
      {},
    );

    expect(result.replies).toHaveLength(1);
    expect(report.replies[0]?.message).toBe("Any update?");
  });

  it("rejects replying to a closed report", async () => {
    const userId = new Types.ObjectId();
    const report = new ReportFeedbackModel({
      _id: new Types.ObjectId(),
      userId,
      type: "problem",
      category: "technical",
      subject: "Cannot upload a file",
      message: "I cannot upload a file from the memory vault page.",
      priority: "medium",
      status: "closed",
      attachments: [],
      replies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(ReportFeedbackModel, "findById").mockReturnValue(mockExecResolved(report) as never);

    await expect(
      reportFeedbackService.addUserReportFeedbackReply(
        {
          id: userId.toString(),
          email: "user@example.com",
          role: "user",
          tokenVersion: 0,
        },
        { reportId: report._id.toString() },
        { message: "Any update?" },
        [],
        {},
      ),
    ).rejects.toMatchObject({
      code: "REPORT_FEEDBACK_CLOSED",
    });
  });

  it("lists admin reports with filters and search", async () => {
    const report = new ReportFeedbackModel({
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      type: "problem",
      category: "technical",
      subject: "Cannot upload a file",
      message: "I cannot upload a file from the memory vault page.",
      priority: "high",
      status: "open",
      attachments: [],
      replies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(UserModel, "find")
      .mockReturnValueOnce(
        mockSelectLeanExecResolved([
          { _id: report.userId, name: "User", email: "user@example.com" },
        ]) as never,
      )
      .mockReturnValueOnce(
        mockSelectLeanExecResolved([
          { _id: report.userId, name: "User", email: "user@example.com", role: "user" },
        ]) as never,
      );
    vi.spyOn(ReportFeedbackModel, "countDocuments").mockReturnValue(mockExecResolved(1) as never);
    const findSpy = vi.spyOn(ReportFeedbackModel, "find").mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue(mockExecResolved([report])),
        }),
      }),
    } as never);

    const result = await reportFeedbackService.listAdminReportFeedback({
      page: 1,
      limit: 20,
      status: "open",
      type: "problem",
      priority: "high",
      search: "upload",
    });

    expect(findSpy).toHaveBeenCalled();
    expect(result.reports[0]?.user).toMatchObject({
      email: "user@example.com",
    });
  });

  it("lets an admin reply and moves open reports to in_progress", async () => {
    const report = new ReportFeedbackModel({
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      type: "problem",
      category: "technical",
      subject: "Cannot upload a file",
      message: "I cannot upload a file from the memory vault page.",
      priority: "medium",
      status: "open",
      attachments: [],
      replies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(ReportFeedbackModel, "findById").mockReturnValue(mockExecResolved(report) as never);
    vi.spyOn(report, "save").mockResolvedValue(report);
    vi.spyOn(UserModel, "find").mockReturnValue(
      mockSelectLeanExecResolved([
        {
          _id: report.userId,
          name: "User",
          email: "user@example.com",
          role: "user",
        },
      ]) as never,
    );

    const result = await reportFeedbackService.addAdminReportFeedbackReply(
      {
        id: new Types.ObjectId().toString(),
        email: "admin@example.com",
        role: "admin",
        tokenVersion: 0,
      },
      { reportId: report._id.toString() },
      { message: "We are checking this now." },
      [],
      {},
    );

    expect(report.status).toBe("in_progress");
    expect(result.status).toBe("in_progress");
  });

  it("updates report status from the admin service", async () => {
    const report = new ReportFeedbackModel({
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      type: "problem",
      category: "technical",
      subject: "Cannot upload a file",
      message: "I cannot upload a file from the memory vault page.",
      priority: "medium",
      status: "open",
      attachments: [],
      replies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.spyOn(ReportFeedbackModel, "findById").mockReturnValue(mockExecResolved(report) as never);
    vi.spyOn(report, "save").mockResolvedValue(report);
    vi.spyOn(UserModel, "find").mockReturnValue(
      mockSelectLeanExecResolved([
        {
          _id: report.userId,
          name: "User",
          email: "user@example.com",
          role: "user",
        },
      ]) as never,
    );

    const result = await reportFeedbackService.updateAdminReportFeedbackStatus(
      {
        id: new Types.ObjectId().toString(),
        email: "admin@example.com",
        role: "admin",
        tokenVersion: 0,
      },
      { reportId: report._id.toString() },
      { status: "resolved" },
      {},
    );

    expect(report.status).toBe("resolved");
    expect(result.status).toBe("resolved");
  });
});
