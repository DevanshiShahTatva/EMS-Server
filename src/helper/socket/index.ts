import { Server, Socket } from 'socket.io';
import { socketAuth } from './authMiddleware';
import notificationHandler from './notificationHandler';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userName?: string;
}

export default function initSocket(io: Server) {
  io.use(socketAuth);

  io.on('connection', (socket: AuthenticatedSocket) => {

    notificationHandler(io, socket);

    socket.on('disconnect', () => { });
  });
}