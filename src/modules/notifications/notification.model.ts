import mongoose, { Schema, Types, type HydratedDocument, type Model } from "mongoose";

import {
  notificationPriorities,
  notificationTypes,
  type NotificationPriority,
  type NotificationType,
} from "./notification.types.js";

export type Notification = {
  _id: Types.ObjectId;
  recipient: Types.ObjectId;
  actor?: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date;
  priority: NotificationPriority;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type NotificationDocument = HydratedDocument<Notification>;

type NotificationModel = Model<Notification>;

const notificationSchema = new Schema<Notification, NotificationModel>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    type: {
      type: String,
      enum: notificationTypes,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 160,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000,
    },
    data: {
      type: Schema.Types.Mixed,
    },
    isRead: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    priority: {
      type: String,
      enum: notificationPriorities,
      default: "normal",
      required: true,
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const NotificationModel =
  mongoose.models.Notification ??
  mongoose.model<Notification, NotificationModel>("Notification", notificationSchema);
