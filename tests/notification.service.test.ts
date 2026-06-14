import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const notificationService = await import("../src/modules/notifications/notification.service.js");
const { NotificationModel } = await import("../src/modules/notifications/notification.model.js");
const { UserModel } = await import("../src/modules/users/user.model.js");

const mockExecResolved = <T>(value: T) => ({
  exec: vi.fn().mockResolvedValue(value),
});

const mockFindChainResolved = <T>(value: T) => ({
  select: vi.fn().mockReturnValue({
    lean: vi.fn().mockReturnValue(mockExecResolved(value)),
  }),
});

describe("notification service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists notifications with ownership filters and pagination", async () => {
    const notification = new NotificationModel({
      _id: new Types.ObjectId(),
      recipient: new Types.ObjectId(),
      type: "system",
      title: "Hello",
      message: "World",
      isRead: false,
      priority: "high",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const countSpy = vi
      .spyOn(NotificationModel, "countDocuments")
      .mockReturnValue(mockExecResolved(1) as never);
    const findSpy = vi.spyOn(NotificationModel, "find").mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue(mockExecResolved([notification])),
        }),
      }),
    } as never);

    const result = await notificationService.listMyNotifications(
      {
        id: notification.recipient.toString(),
        email: "user@example.com",
        role: "user",
        tokenVersion: 0,
      },
      {
        page: 2,
        limit: 10,
        isRead: false,
        type: "system",
        priority: "high",
      },
    );

    expect(result.pagination).toMatchObject({
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
    expect(countSpy).toHaveBeenCalled();
    expect(findSpy).toHaveBeenCalled();
    expect(result.notifications[0]).toMatchObject({
      title: "Hello",
      message: "World",
      isRead: false,
      priority: "high",
    });
  });

  it("returns unread count for the authenticated recipient", async () => {
    vi.spyOn(NotificationModel, "countDocuments").mockReturnValue(mockExecResolved(4) as never);

    const result = await notificationService.getUnreadCount({
      id: "507f1f77bcf86cd799439013",
      email: "user@example.com",
      role: "user",
      tokenVersion: 0,
    });

    expect(result).toEqual({ count: 4 });
  });

  it("marks a notification as read and enforces ownership", async () => {
    const notification = new NotificationModel({
      _id: new Types.ObjectId(),
      recipient: new Types.ObjectId(),
      type: "system",
      title: "Hello",
      message: "World",
      isRead: false,
      priority: "normal",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(NotificationModel, "findOne")
      .mockReturnValueOnce(mockExecResolved(notification) as never)
      .mockReturnValueOnce(mockExecResolved(null) as never);
    vi.spyOn(notification, "save").mockResolvedValue(notification);

    const result = await notificationService.markAsRead(
      {
        id: notification.recipient.toString(),
        email: "user@example.com",
        role: "user",
        tokenVersion: 0,
      },
      {
        notificationId: notification._id.toString(),
      },
    );

    expect(result.isRead).toBe(true);
    expect(notification.readAt).toBeInstanceOf(Date);

    await expect(
      notificationService.markAsRead(
        {
          id: notification.recipient.toString(),
          email: "user@example.com",
          role: "user",
          tokenVersion: 0,
        },
        {
          notificationId: notification._id.toString(),
        },
      ),
    ).rejects.toMatchObject({
      code: "NOTIFICATION_NOT_FOUND",
    });
  });

  it("marks all notifications as read", async () => {
    vi.spyOn(NotificationModel, "updateMany").mockReturnValue(
      mockExecResolved({ modifiedCount: 3 }) as never,
    );

    const result = await notificationService.markAllAsRead({
      id: "507f1f77bcf86cd799439013",
      email: "user@example.com",
      role: "user",
      tokenVersion: 0,
    });

    expect(result).toEqual({ updatedCount: 3 });
  });

  it("deletes only owned notifications", async () => {
    vi.spyOn(NotificationModel, "deleteOne")
      .mockReturnValueOnce(mockExecResolved({ deletedCount: 1 }) as never)
      .mockReturnValueOnce(mockExecResolved({ deletedCount: 0 }) as never);

    await expect(
      notificationService.deleteMyNotification(
        {
          id: "507f1f77bcf86cd799439013",
          email: "user@example.com",
          role: "user",
          tokenVersion: 0,
        },
        { notificationId: "507f1f77bcf86cd799439101" },
      ),
    ).resolves.toBeUndefined();

    await expect(
      notificationService.deleteMyNotification(
        {
          id: "507f1f77bcf86cd799439013",
          email: "user@example.com",
          role: "user",
          tokenVersion: 0,
        },
        { notificationId: "507f1f77bcf86cd799439101" },
      ),
    ).rejects.toMatchObject({
      code: "NOTIFICATION_NOT_FOUND",
    });
  });

  it("creates an admin broadcast for selected users and rejects missing recipients", async () => {
    const firstUserId = new Types.ObjectId();
    const secondUserId = new Types.ObjectId();

    vi.spyOn(UserModel, "find")
      .mockReturnValueOnce(
        mockFindChainResolved([{ _id: firstUserId }, { _id: secondUserId }]) as never,
      )
      .mockReturnValueOnce(mockFindChainResolved([{ _id: firstUserId }]) as never);
    const insertManySpy = vi
      .spyOn(NotificationModel, "insertMany")
      .mockResolvedValue([
        new NotificationModel({ recipient: firstUserId }),
        new NotificationModel({ recipient: secondUserId }),
      ] as never);

    const result = await notificationService.createAdminBroadcast(
      {
        id: "507f1f77bcf86cd799439011",
        email: "admin@example.com",
        role: "admin",
        tokenVersion: 0,
      },
      {
        recipientIds: [firstUserId.toString(), secondUserId.toString()],
        sendToAll: false,
        title: "Hello",
        message: "World",
        type: "admin_broadcast",
        priority: "normal",
      },
    );

    expect(result).toEqual({
      requestedCount: 2,
      createdCount: 2,
    });
    expect(insertManySpy).toHaveBeenCalled();

    await expect(
      notificationService.createAdminBroadcast(
        {
          id: "507f1f77bcf86cd799439011",
          email: "admin@example.com",
          role: "admin",
          tokenVersion: 0,
        },
        {
          recipientIds: [firstUserId.toString(), secondUserId.toString()],
          sendToAll: false,
          title: "Hello",
          message: "World",
          type: "admin_broadcast",
          priority: "normal",
        },
      ),
    ).rejects.toMatchObject({
      code: "USER_NOT_FOUND",
    });
  });
});
