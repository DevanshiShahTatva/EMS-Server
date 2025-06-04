import { Server } from "socket.io";
import { AuthenticatedSocket } from ".";
import { io } from "../../server";

const userSockets = new Map<string, string[]>();

export default function notificationHandler(io: Server, socket: AuthenticatedSocket) {
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

  socket.on("authenticate", authHandler);
  socket.on("disconnect", disconnectHandler);
}

export const sendNotificationToUser = async (userId: string, notification: any) => {
  try {
    io.to(userId).emit("notification", notification);
    return true;
  } catch (error) {
    console.error("Err:", error);
    return false;
  }
};

