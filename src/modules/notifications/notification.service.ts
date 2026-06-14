import { Types } from "mongoose";

import { ApiError } from "../../utils/api-error.util.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { UserModel } from "../users/user.model.js";
import { NotificationModel, type NotificationDocument } from "./notification.model.js";
import { toPublicNotification } from "./notification.presenter.js";
import type {
  AdminBroadcastInput,
  NotificationIdParams,
  NotificationListQuery,
} from "./notification.validation.js";
import type {
  NotificationPriority,
  NotificationType,
  PublicNotification,
} from "./notification.types.js";

type NotificationPayload = {
  recipient: string | Types.ObjectId;
  actor?: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  priority?: NotificationPriority;
  expiresAt?: Date;
};

const buildVisibleNotificationFilter = (recipientId: string) => {
  const now = new Date();

  return {
    recipient: recipientId,
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
  };
};

const findOwnedNotificationOrThrow = async (
  userId: string,
  notificationId: string,
): Promise<NotificationDocument> => {
  const notification = await NotificationModel.findOne({
    _id: notificationId,
    ...buildVisibleNotificationFilter(userId),
  }).exec();

  if (!notification) {
    throw new ApiError(404, "Notification not found.", "NOTIFICATION_NOT_FOUND");
  }

  return notification;
};

const buildListFilter = (userId: string, query?: NotificationListQuery) => ({
  ...buildVisibleNotificationFilter(userId),
  ...(query?.isRead === undefined ? {} : { isRead: query.isRead }),
  ...(query?.type === undefined ? {} : { type: query.type }),
  ...(query?.priority === undefined ? {} : { priority: query.priority }),
});

export const createNotification = async (
  payload: NotificationPayload,
): Promise<PublicNotification | null> => {
  const notification = await NotificationModel.create(payload);

  return toPublicNotification(notification);
};

export const createManyNotifications = async (payloads: NotificationPayload[]): Promise<number> => {
  if (payloads.length === 0) {
    return 0;
  }

  const inserted = await NotificationModel.insertMany(payloads, { ordered: false });

  return inserted.length;
};

export const listMyNotifications = async (
  user: AuthenticatedUser,
  query?: NotificationListQuery,
) => {
  const page = query?.page ?? 1;
  const limit = query?.limit ?? 20;
  const skip = (page - 1) * limit;
  const filter = buildListFilter(user.id, query);

  const [total, notifications] = await Promise.all([
    NotificationModel.countDocuments(filter).exec(),
    NotificationModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).exec(),
  ]);

  return {
    notifications: notifications.map(toPublicNotification),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
};

export const getUnreadCount = async (user: AuthenticatedUser) => {
  const count = await NotificationModel.countDocuments({
    ...buildVisibleNotificationFilter(user.id),
    isRead: false,
  }).exec();

  return {
    count,
  };
};

export const markAsRead = async (user: AuthenticatedUser, params: NotificationIdParams) => {
  const notification = await findOwnedNotificationOrThrow(user.id, params.notificationId);

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  return toPublicNotification(notification);
};

export const markAllAsRead = async (user: AuthenticatedUser) => {
  const readAt = new Date();
  const result = await NotificationModel.updateMany(
    {
      ...buildVisibleNotificationFilter(user.id),
      isRead: false,
    },
    {
      $set: {
        isRead: true,
        readAt,
      },
    },
  ).exec();

  return {
    updatedCount: result.modifiedCount,
  };
};

export const deleteMyNotification = async (
  user: AuthenticatedUser,
  params: NotificationIdParams,
) => {
  const result = await NotificationModel.deleteOne({
    _id: params.notificationId,
    recipient: user.id,
  }).exec();

  if (result.deletedCount === 0) {
    throw new ApiError(404, "Notification not found.", "NOTIFICATION_NOT_FOUND");
  }
};

export const createAdminBroadcast = async (
  actor: AuthenticatedUser,
  input: AdminBroadcastInput,
) => {
  let recipients: { _id: Types.ObjectId }[];

  if (input.sendToAll) {
    recipients = await UserModel.find({ role: "user" }).select("_id").lean().exec();
  } else {
    const uniqueRecipientIds = [...new Set(input.recipientIds ?? [])];

    if (uniqueRecipientIds.length === 0) {
      throw new ApiError(400, "At least one recipient is required.", "EMPTY_RECIPIENTS");
    }

    recipients = await UserModel.find({ _id: { $in: uniqueRecipientIds } })
      .select("_id")
      .lean()
      .exec();

    if (recipients.length !== uniqueRecipientIds.length) {
      throw new ApiError(404, "One or more users were not found.", "USER_NOT_FOUND");
    }
  }

  if (recipients.length === 0) {
    throw new ApiError(400, "No eligible recipients were found.", "EMPTY_RECIPIENTS");
  }

  const createdCount = await createManyNotifications(
    recipients.map((recipient) => ({
      recipient: recipient._id,
      actor: actor.id,
      type: input.type,
      title: input.title,
      message: input.message,
      ...(input.data === undefined ? {} : { data: input.data }),
      priority: input.priority,
    })),
  );

  return {
    requestedCount: recipients.length,
    createdCount,
  };
};
