import { Server } from "socket.io";
import { AuthenticatedSocket } from ".";
import { io } from "../../server";
import PrivateChat from "../../models/privateChat.model";
import mongoose from "mongoose";
import GroupChat from "../../models/groupChat.model";

const userSockets = new Map<string, string[]>();

export default function notificationHandler(
  io: Server,
  socket: AuthenticatedSocket
) {
  const authHandler = () => {
    if (socket.userId) {
      const userSocketIds = userSockets.get(socket.userId) || [];
      userSocketIds.push(socket.id);
      userSockets.set(socket.userId, userSocketIds);

      socket.join(socket.userId);
    }
  };

  const disconnectHandler = () => {
    for (const [userId, sockets] of userSockets.entries()) {
      const updatedSockets = sockets.filter((id) => id !== socket.id);
      if (updatedSockets.length === 0) {
        userSockets.delete(userId);
      } else {
        userSockets.set(userId, updatedSockets);
      }
    }
  };

  const initiateChatNotification = async () => {
    const userId = new mongoose.Types.ObjectId(socket.userId || "");

    const pipeline = [
      {
        $match: {
          $or: [
            { sender: userId },
            { receiver: userId },
          ],
        },
      },
    ];

    const groupPipeline = [ { $match: { members: userId } } ];

    const findUserInPrivateChat = await PrivateChat.aggregate(pipeline);

    const findUserInGroupChat = await GroupChat.aggregate(groupPipeline);

    console.log("findUserInGroupChat:", findUserInGroupChat)

    findUserInPrivateChat.forEach((chat) => {
      const room = `private_${chat._id}`;
      socket.join(room);
    });

    findUserInGroupChat.forEach((group) => {
      socket.join(group._id.toString());
    });
  };

  socket.on("authenticate", authHandler);
  socket.on("disconnect", disconnectHandler);
  socket.on("initiate_chat_notification", initiateChatNotification);
}

export const sendNotificationToUser = async (
  userId: string,
  notification: any
) => {
  try {
    io.to(userId).emit("notification", notification);
    return true;
  } catch (error) {
    console.error("Err:", error);
    return false;
  }
};
