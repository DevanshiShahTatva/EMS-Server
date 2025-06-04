import { Server, Socket } from 'socket.io';
import { socketAuth } from './authMiddleware';
import groupChatHandlers from './groupChatHandlers';
import privateChatHandlers from './privateChatHandlers';
import notificationHandler from './notificationHandler';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userName?: string;
}

export default function initSocket(io: Server) {
  io.use(socketAuth);

  io.on('connection', (socket: AuthenticatedSocket) => {

    groupChatHandlers(io, socket);
    privateChatHandlers(io, socket);
    notificationHandler(io, socket);

    socket.on('disconnect', () => { });
  });
}