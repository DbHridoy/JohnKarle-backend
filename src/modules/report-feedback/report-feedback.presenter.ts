import type { UserRole } from "../users/user.types.js";
import type { ReportFeedbackDocument } from "./report-feedback.model.js";
import type {
  PublicReportFeedback,
  PublicReportFeedbackReply,
  ReportFeedbackUserSummary,
} from "./report-feedback.types.js";

const toPublicReply = (
  reply: ReportFeedbackDocument["replies"][number],
  includeActorIds: boolean,
): PublicReportFeedbackReply => ({
  senderRole: reply.senderRole,
  message: reply.message,
  attachments: reply.attachments,
  createdAt: reply.createdAt.toISOString(),
  ...(includeActorIds ? { senderId: reply.senderId.toString() } : {}),
});

export const toPublicReportFeedback = (
  report: ReportFeedbackDocument,
  options?: {
    includeActorIds?: boolean;
    user?: ReportFeedbackUserSummary;
  },
): PublicReportFeedback => ({
  id: report._id.toString(),
  userId: report.userId.toString(),
  type: report.type,
  category: report.category,
  subject: report.subject,
  message: report.message,
  priority: report.priority,
  status: report.status,
  attachments: report.attachments,
  replies: report.replies.map((reply) => toPublicReply(reply, options?.includeActorIds ?? false)),
  ...(report.lastRespondedAt ? { lastRespondedAt: report.lastRespondedAt.toISOString() } : {}),
  ...(options?.includeActorIds && report.lastRespondedById
    ? { lastRespondedById: report.lastRespondedById.toString() }
    : {}),
  ...(report.lastRespondedByRole ? { lastRespondedByRole: report.lastRespondedByRole } : {}),
  ...(report.statusChangedAt ? { statusChangedAt: report.statusChangedAt.toISOString() } : {}),
  ...(options?.includeActorIds && report.statusChangedById
    ? { statusChangedById: report.statusChangedById.toString() }
    : {}),
  ...(report.statusChangedByRole ? { statusChangedByRole: report.statusChangedByRole } : {}),
  createdAt: report.createdAt.toISOString(),
  updatedAt: report.updatedAt.toISOString(),
  ...(options?.user ? { user: options.user } : {}),
});

export const toReportFeedbackUserSummary = (input: {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
}): ReportFeedbackUserSummary => ({
  id: input._id,
  name: input.name,
  email: input.email,
  role: input.role,
});
