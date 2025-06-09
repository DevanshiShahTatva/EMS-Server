import { sendNotificationToUser } from "../helper/socket";
import Notification from "../models/notification.model";

type NotificationPayload = {
  title: string;
  body: string;
  data?: any;
};

export async function sendNotification(
  userId: string,
  payload: NotificationPayload
) {
  try {
    // Create notification in database
    const notification = new Notification({
      userId,
      ...payload,
    });

    await notification.save();

    // Send via Socket.IO
    await sendNotificationToUser(userId, {
      ...payload,
      _id: notification._id.toString(),
      createdAt: notification.createdAt,
      isRead: false
    });

    return notification;
  } catch (error) {
    console.error("error", error);
    throw new Error(
      `Notification failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
