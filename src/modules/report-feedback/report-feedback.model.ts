import mongoose, { Schema, type InferSchemaType, type HydratedDocument, model } from "mongoose";

import type {
  ReportFeedbackAttachment,
  ReportFeedbackCategory,
  ReportFeedbackPriority,
  ReportFeedbackStatus,
  ReportFeedbackType,
} from "./report-feedback.types.js";
import {
  reportFeedbackCategories,
  reportFeedbackPriorities,
  reportFeedbackStatuses,
  reportFeedbackTypes,
} from "./report-feedback.types.js";
import { userRoles } from "../users/user.types.js";

const attachmentSchema = new Schema<ReportFeedbackAttachment>(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  },
);

const replySchema = new Schema(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderRole: {
      type: String,
      enum: userRoles,
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 5000,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
  },
  {
    _id: false,
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  },
);

const reportFeedbackSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: reportFeedbackTypes satisfies readonly ReportFeedbackType[],
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: reportFeedbackCategories satisfies readonly ReportFeedbackCategory[],
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 150,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 5000,
    },
    priority: {
      type: String,
      enum: reportFeedbackPriorities satisfies readonly ReportFeedbackPriority[],
      required: true,
      default: "medium",
      index: true,
    },
    status: {
      type: String,
      enum: reportFeedbackStatuses satisfies readonly ReportFeedbackStatus[],
      required: true,
      default: "open",
      index: true,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    replies: {
      type: [replySchema],
      default: [],
    },
    lastRespondedAt: {
      type: Date,
    },
    lastRespondedById: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    lastRespondedByRole: {
      type: String,
      enum: userRoles,
    },
    statusChangedAt: {
      type: Date,
    },
    statusChangedById: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    statusChangedByRole: {
      type: String,
      enum: userRoles,
    },
  },
  {
    timestamps: true,
  },
);

reportFeedbackSchema.index({ userId: 1, createdAt: -1 });
reportFeedbackSchema.index({ status: 1, createdAt: -1 });
reportFeedbackSchema.index({ type: 1, createdAt: -1 });
reportFeedbackSchema.index({ priority: 1, createdAt: -1 });
reportFeedbackSchema.index({ updatedAt: -1, createdAt: -1 });
reportFeedbackSchema.index({ userId: 1, status: 1, updatedAt: -1 });

export type ReportFeedbackDocument = HydratedDocument<InferSchemaType<typeof reportFeedbackSchema>>;

export const ReportFeedbackModel =
  mongoose.models.ReportFeedback || model("ReportFeedback", reportFeedbackSchema);
