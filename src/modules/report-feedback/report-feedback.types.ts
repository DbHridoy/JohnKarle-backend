import type { UserRole } from "../users/user.types.js";

export const reportFeedbackTypes = ["problem", "feedback"] as const;
export const reportFeedbackCategories = [
  "general",
  "account",
  "technical",
  "feature_request",
  "billing",
  "other",
] as const;
export const reportFeedbackPriorities = ["low", "medium", "high"] as const;
export const reportFeedbackStatuses = ["open", "in_progress", "resolved", "closed"] as const;

export type ReportFeedbackType = (typeof reportFeedbackTypes)[number];
export type ReportFeedbackCategory = (typeof reportFeedbackCategories)[number];
export type ReportFeedbackPriority = (typeof reportFeedbackPriorities)[number];
export type ReportFeedbackStatus = (typeof reportFeedbackStatuses)[number];

export type ReportFeedbackAttachment = {
  key: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
};

export type PublicReportFeedbackReply = {
  senderRole: UserRole;
  message: string;
  attachments: ReportFeedbackAttachment[];
  createdAt: string;
  senderId?: string;
};

export type ReportFeedbackUserSummary = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type PublicReportFeedback = {
  id: string;
  userId: string;
  type: ReportFeedbackType;
  category: ReportFeedbackCategory;
  subject: string;
  message: string;
  priority: ReportFeedbackPriority;
  status: ReportFeedbackStatus;
  attachments: ReportFeedbackAttachment[];
  replies: PublicReportFeedbackReply[];
  lastRespondedAt?: string;
  lastRespondedById?: string;
  lastRespondedByRole?: UserRole;
  statusChangedAt?: string;
  statusChangedById?: string;
  statusChangedByRole?: UserRole;
  createdAt: string;
  updatedAt: string;
  user?: ReportFeedbackUserSummary;
};
