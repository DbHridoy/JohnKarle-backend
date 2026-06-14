import { DeleteObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Types } from "mongoose";
import { randomUUID } from "node:crypto";

import { env } from "../../config/env.config.js";
import { ApiError } from "../../utils/api-error.util.js";
import { createAuditLog } from "../audit-logs/audit-log.service.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { UserModel } from "../users/user.model.js";
import { ReportFeedbackModel, type ReportFeedbackDocument } from "./report-feedback.model.js";
import {
  toPublicReportFeedback,
  toReportFeedbackUserSummary,
} from "./report-feedback.presenter.js";
import type {
  AdminReportFeedbackListQuery,
  CreateReportFeedbackInput,
  CreateReportFeedbackReplyInput,
  ReportFeedbackIdParams,
  ReportFeedbackListQuery,
  UpdateReportFeedbackStatusInput,
} from "./report-feedback.validation.js";
import type {
  PublicReportFeedback,
  ReportFeedbackAttachment,
  ReportFeedbackUserSummary,
} from "./report-feedback.types.js";

let s3Client: S3Client | null = null;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getS3Client = (): S3Client => {
  if (s3Client) {
    return s3Client;
  }

  if (
    !env.AWS_REGION ||
    !env.S3_BUCKET_NAME ||
    !env.AWS_ACCESS_KEY_ID ||
    !env.AWS_SECRET_ACCESS_KEY
  ) {
    throw new ApiError(500, "S3 credentials are not configured.", "S3_CONFIGURATION_ERROR");
  }

  s3Client = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });

  return s3Client;
};

const buildObjectUrl = (key: string): string =>
  `https://${env.S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;

const uploadAttachmentsToS3 = async (
  userId: string,
  files: Express.Multer.File[],
): Promise<ReportFeedbackAttachment[]> => {
  if (files.length === 0) {
    return [];
  }

  const client = getS3Client();

  return Promise.all(
    files.map(async (file) => {
      const extension = file.originalname.includes(".")
        ? file.originalname.slice(file.originalname.lastIndexOf("."))
        : "";
      const key = `report-feedback/${userId}/${Date.now()}-${randomUUID()}${extension}`;

      await client.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET_NAME,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      return {
        key,
        url: buildObjectUrl(key),
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      };
    }),
  );
};

const deleteAttachmentsFromS3 = async (attachments: ReportFeedbackAttachment[]): Promise<void> => {
  if (attachments.length === 0) {
    return;
  }

  const client = getS3Client();

  await client.send(
    new DeleteObjectsCommand({
      Bucket: env.S3_BUCKET_NAME,
      Delete: {
        Objects: attachments.map((attachment) => ({ Key: attachment.key })),
        Quiet: true,
      },
    }),
  );
};

const buildActorType = (role: AuthenticatedUser["role"]): "user" | "admin" => {
  if (role === "super_admin") {
    return "admin";
  }

  return role === "admin" ? "admin" : "user";
};

const findReportOrThrow = async (reportId: string): Promise<ReportFeedbackDocument> => {
  const report = await ReportFeedbackModel.findById(reportId).exec();

  if (!report) {
    throw new ApiError(404, "Report not found.", "REPORT_FEEDBACK_NOT_FOUND");
  }

  return report;
};

const ensureCanAccessReport = async (
  actor: AuthenticatedUser,
  reportId: string,
): Promise<ReportFeedbackDocument> => {
  const report = await findReportOrThrow(reportId);

  if (
    report.userId.toString() !== actor.id &&
    actor.role !== "admin" &&
    actor.role !== "super_admin"
  ) {
    throw new ApiError(403, "You do not have permission to access this report.", "FORBIDDEN");
  }

  return report;
};

const ensureOwnReport = async (
  actor: AuthenticatedUser,
  reportId: string,
): Promise<ReportFeedbackDocument> => {
  const report = await findReportOrThrow(reportId);

  if (report.userId.toString() !== actor.id) {
    throw new ApiError(403, "You do not have permission to access this report.", "FORBIDDEN");
  }

  return report;
};

const getUserSummariesById = async (
  userIds: string[],
): Promise<Map<string, ReportFeedbackUserSummary>> => {
  if (userIds.length === 0) {
    return new Map();
  }

  const users = await UserModel.find({ _id: { $in: userIds } })
    .select("name email role")
    .lean()
    .exec();

  return new Map(
    users.map((user) => [
      user._id.toString(),
      toReportFeedbackUserSummary({
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      }),
    ]),
  );
};

const toPublicReports = async (
  reports: ReportFeedbackDocument[],
  options?: { includeUser?: boolean; includeActorIds?: boolean },
): Promise<PublicReportFeedback[]> => {
  const userSummaryById = options?.includeUser
    ? await getUserSummariesById([...new Set(reports.map((report) => report.userId.toString()))])
    : new Map<string, ReportFeedbackUserSummary>();

  return reports.map((report) =>
    toPublicReportFeedback(report, {
      includeActorIds: options?.includeActorIds ?? false,
      ...(options?.includeUser ? { user: userSummaryById.get(report.userId.toString()) } : {}),
    }),
  );
};

const appendReplyAndPersist = async (
  report: ReportFeedbackDocument,
  actor: AuthenticatedUser,
  input: CreateReportFeedbackReplyInput,
  attachments: ReportFeedbackAttachment[],
  audit: { ipAddress?: string; userAgent?: string },
  action: string,
) => {
  const now = new Date();

  report.replies.push({
    senderId: actor.id,
    senderRole: actor.role,
    message: input.message,
    attachments,
    createdAt: now,
  });
  report.lastRespondedAt = now;
  report.lastRespondedById = new Types.ObjectId(actor.id);
  report.lastRespondedByRole = actor.role;

  if (actor.role !== "user" && report.status === "open") {
    report.status = "in_progress";
    report.statusChangedAt = now;
    report.statusChangedById = new Types.ObjectId(actor.id);
    report.statusChangedByRole = actor.role;
  }

  await report.save();
  await createAuditLog({
    userId: report.userId.toString(),
    actorId: actor.id,
    actorType: buildActorType(actor.role),
    action,
    metadata: {
      reportId: report._id.toString(),
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });
};

export const createReportFeedback = async (
  actor: AuthenticatedUser,
  input: CreateReportFeedbackInput,
  files: Express.Multer.File[],
  audit: { ipAddress?: string; userAgent?: string },
) => {
  let uploadedAttachments: ReportFeedbackAttachment[] = [];

  try {
    uploadedAttachments = await uploadAttachmentsToS3(actor.id, files);

    const report = await ReportFeedbackModel.create({
      userId: actor.id,
      type: input.type,
      category: input.category,
      subject: input.subject,
      message: input.message,
      priority: input.priority,
      status: "open",
      attachments: uploadedAttachments,
      replies: [],
    });

    await createAuditLog({
      userId: actor.id,
      actorId: actor.id,
      actorType: buildActorType(actor.role),
      action: "report_feedback_created",
      metadata: {
        reportId: report._id.toString(),
        type: report.type,
        category: report.category,
      },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });

    return toPublicReportFeedback(report);
  } catch (error) {
    await deleteAttachmentsFromS3(uploadedAttachments).catch(() => undefined);
    throw error;
  }
};

export const listMyReportFeedback = async (
  actor: AuthenticatedUser,
  query: ReportFeedbackListQuery,
) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;
  const filter = {
    userId: actor.id,
    ...(query.type === undefined ? {} : { type: query.type }),
    ...(query.status === undefined ? {} : { status: query.status }),
    ...(query.priority === undefined ? {} : { priority: query.priority }),
  };

  const [total, reports] = await Promise.all([
    ReportFeedbackModel.countDocuments(filter).exec(),
    ReportFeedbackModel.find(filter)
      .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .exec(),
  ]);

  return {
    reports: await toPublicReports(reports),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      hasNextPage: total > page * limit,
      hasPrevPage: page > 1,
    },
  };
};

export const getReportFeedback = async (
  actor: AuthenticatedUser,
  params: ReportFeedbackIdParams,
) => {
  const report = await ensureCanAccessReport(actor, params.reportId);
  const includeAdminFields = actor.role === "admin" || actor.role === "super_admin";
  const userSummaryById = includeAdminFields
    ? await getUserSummariesById([report.userId.toString()])
    : new Map<string, ReportFeedbackUserSummary>();

  return toPublicReportFeedback(report, {
    includeActorIds: includeAdminFields,
    ...(includeAdminFields ? { user: userSummaryById.get(report.userId.toString()) } : {}),
  });
};

export const addUserReportFeedbackReply = async (
  actor: AuthenticatedUser,
  params: ReportFeedbackIdParams,
  input: CreateReportFeedbackReplyInput,
  files: Express.Multer.File[],
  audit: { ipAddress?: string; userAgent?: string },
) => {
  const report = await ensureOwnReport(actor, params.reportId);

  if (report.status === "closed") {
    throw new ApiError(400, "Closed reports cannot receive new replies.", "REPORT_FEEDBACK_CLOSED");
  }

  let uploadedAttachments: ReportFeedbackAttachment[] = [];

  try {
    uploadedAttachments = await uploadAttachmentsToS3(actor.id, files);
    await appendReplyAndPersist(
      report,
      actor,
      input,
      uploadedAttachments,
      audit,
      "report_feedback_user_reply_added",
    );

    return toPublicReportFeedback(report);
  } catch (error) {
    await deleteAttachmentsFromS3(uploadedAttachments).catch(() => undefined);
    throw error;
  }
};

export const listAdminReportFeedback = async (query: AdminReportFeedbackListQuery) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = {
    ...(query.type === undefined ? {} : { type: query.type }),
    ...(query.status === undefined ? {} : { status: query.status }),
    ...(query.priority === undefined ? {} : { priority: query.priority }),
    ...(query.userId === undefined ? {} : { userId: query.userId }),
  };

  const search = query.search?.trim();

  if (search !== undefined) {
    const regex = new RegExp(escapeRegExp(search), "i");
    const matchingUsers = await UserModel.find({
      $or: [{ name: { $regex: regex } }, { email: { $regex: regex } }],
    })
      .select("_id")
      .lean()
      .exec();

    filter.$or = [
      { subject: { $regex: regex } },
      { message: { $regex: regex } },
      ...(matchingUsers.length > 0
        ? [{ userId: { $in: matchingUsers.map((user) => user._id) } }]
        : []),
    ];
  }

  const [total, reports] = await Promise.all([
    ReportFeedbackModel.countDocuments(filter).exec(),
    ReportFeedbackModel.find(filter)
      .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .exec(),
  ]);

  return {
    reports: await toPublicReports(reports, {
      includeActorIds: true,
      includeUser: true,
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      hasNextPage: total > page * limit,
      hasPrevPage: page > 1,
    },
  };
};

export const addAdminReportFeedbackReply = async (
  actor: AuthenticatedUser,
  params: ReportFeedbackIdParams,
  input: CreateReportFeedbackReplyInput,
  files: Express.Multer.File[],
  audit: { ipAddress?: string; userAgent?: string },
) => {
  const report = await findReportOrThrow(params.reportId);

  if (report.status === "closed") {
    throw new ApiError(400, "Closed reports cannot receive new replies.", "REPORT_FEEDBACK_CLOSED");
  }

  let uploadedAttachments: ReportFeedbackAttachment[] = [];

  try {
    uploadedAttachments = await uploadAttachmentsToS3(actor.id, files);
    await appendReplyAndPersist(
      report,
      actor,
      input,
      uploadedAttachments,
      audit,
      "report_feedback_admin_reply_added",
    );
    const userSummaryById = await getUserSummariesById([report.userId.toString()]);

    return toPublicReportFeedback(report, {
      includeActorIds: true,
      user: userSummaryById.get(report.userId.toString()),
    });
  } catch (error) {
    await deleteAttachmentsFromS3(uploadedAttachments).catch(() => undefined);
    throw error;
  }
};

export const updateAdminReportFeedbackStatus = async (
  actor: AuthenticatedUser,
  params: ReportFeedbackIdParams,
  input: UpdateReportFeedbackStatusInput,
  audit: { ipAddress?: string; userAgent?: string },
) => {
  const report = await findReportOrThrow(params.reportId);
  const now = new Date();

  report.status = input.status;
  report.statusChangedAt = now;
  report.statusChangedById = new Types.ObjectId(actor.id);
  report.statusChangedByRole = actor.role;
  await report.save();

  await createAuditLog({
    userId: report.userId.toString(),
    actorId: actor.id,
    actorType: buildActorType(actor.role),
    action: "report_feedback_status_changed",
    metadata: {
      reportId: report._id.toString(),
      status: report.status,
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  const userSummaryById = await getUserSummariesById([report.userId.toString()]);

  return toPublicReportFeedback(report, {
    includeActorIds: true,
    user: userSummaryById.get(report.userId.toString()),
  });
};
