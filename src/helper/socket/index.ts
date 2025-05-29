import { Server, Socket } from 'socket.io';
import { socketAuth } from './authMiddleware';
import groupChatHandlers from './groupChatHandlers';
import privateChatHandlers from './privateChatHandlers';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
}

export default function initSocket(io: Server) {
  io.use(socketAuth);

  io.on('connection', (socket: AuthenticatedSocket) => {
    if (socket.userId) {
      io.emit('user_online_status', {
        userId: socket.userId,
        status: 'online'
      });
    }

    groupChatHandlers(io, socket);
    privateChatHandlers(io, socket);

    socket.on('disconnect', () => {
      if (socket.userId) {
        io.emit('user_online_status', {
          userId: socket.userId,
          status: 'offline'
        });
      }
    });
  });
}