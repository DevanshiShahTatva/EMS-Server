import { Server, Socket } from 'socket.io';
import { socketAuth } from './authMiddleware';
import groupChatHandlers from './groupChatHandlers';
import privateChatHandlers from './privateChatHandlers';
import notificationHandler from './notificationHandler';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userName?: string;
  activeGroupId?: string;
}

export default function initSocket(io: Server) {
  io.use(socketAuth);

  io.on('connection', (socket: AuthenticatedSocket) => {

    socket.userId && socket.join(socket.userId);

    notificationHandler(io, socket);

    socket.on('activate_chat_handlers', () => {
      privateChatHandlers(io, socket);
      groupChatHandlers(io, socket);
    });

    socket.on('disconnect', () => { });
  });
}