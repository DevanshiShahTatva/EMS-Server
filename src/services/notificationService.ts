import Notification from "../models/notification.model";
import User from "../models/signup.model";
import { messaging } from "./firebase";

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
    const notification = new Notification({
      userId,
      ...payload,
    });

    await notification.save();

    const user = await User.findById(userId).select("fcmTokens");

    // Send via Firebase if token exists
    if (user?.fcmTokens && user.fcmTokens.length > 0) {
      const message = {
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          ...(payload.data || {}),
          _id: notification._id.toString(), // This is the critical fix
        },
        tokens: user.fcmTokens, // Send to multiple devices
      };
      await messaging.sendEachForMulticast(message);
    }

    return notification;
  } catch (error) {
    console.log("error", error);
    throw new Error(
      `Notification failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
