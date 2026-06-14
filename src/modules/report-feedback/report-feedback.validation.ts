import { z } from "zod";

import {
  reportFeedbackCategories,
  reportFeedbackPriorities,
  reportFeedbackStatuses,
  reportFeedbackTypes,
} from "./report-feedback.types.js";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid report id.");

const positiveIntFromQuery = (defaultValue: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return defaultValue;
    }

    if (typeof value === "string") {
      return Number.parseInt(value, 10);
    }

    return value;
  }, z.number().int().min(1));

export const createReportFeedbackBodySchema = z
  .object({
    type: z.enum(reportFeedbackTypes),
    category: z.enum(reportFeedbackCategories),
    subject: z.string().trim().min(5).max(150),
    message: z.string().trim().min(10).max(5000),
    priority: z.enum(reportFeedbackPriorities).default("medium"),
  })
  .strict();

export const reportFeedbackListQuerySchema = z
  .object({
    page: positiveIntFromQuery(1).default(1),
    limit: positiveIntFromQuery(20).pipe(z.number().int().min(1).max(100)).default(20),
    type: z.enum(reportFeedbackTypes).optional(),
    status: z.enum(reportFeedbackStatuses).optional(),
    priority: z.enum(reportFeedbackPriorities).optional(),
  })
  .strict();

export const adminReportFeedbackListQuerySchema = z
  .object({
    page: positiveIntFromQuery(1).default(1),
    limit: positiveIntFromQuery(20).pipe(z.number().int().min(1).max(100)).default(20),
    type: z.enum(reportFeedbackTypes).optional(),
    status: z.enum(reportFeedbackStatuses).optional(),
    priority: z.enum(reportFeedbackPriorities).optional(),
    userId: objectIdSchema.optional(),
    search: z.string().trim().min(1).max(150).optional(),
  })
  .strict();

export const reportFeedbackIdParamsSchema = z
  .object({
    reportId: objectIdSchema,
  })
  .strict();

export const createReportFeedbackReplyBodySchema = z
  .object({
    message: z.string().trim().min(1).max(5000),
  })
  .strict();

export const updateReportFeedbackStatusBodySchema = z
  .object({
    status: z.enum(reportFeedbackStatuses),
  })
  .strict();

export type CreateReportFeedbackInput = z.infer<typeof createReportFeedbackBodySchema>;
export type ReportFeedbackListQuery = z.infer<typeof reportFeedbackListQuerySchema>;
export type AdminReportFeedbackListQuery = z.infer<typeof adminReportFeedbackListQuerySchema>;
export type ReportFeedbackIdParams = z.infer<typeof reportFeedbackIdParamsSchema>;
export type CreateReportFeedbackReplyInput = z.infer<typeof createReportFeedbackReplyBodySchema>;
export type UpdateReportFeedbackStatusInput = z.infer<typeof updateReportFeedbackStatusBodySchema>;
