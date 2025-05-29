import jwt from 'jsonwebtoken';
import { AuthenticatedSocket } from '.';

export const socketAuth = (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Missing token'));

  try {
    const user = jwt.verify(token, process.env.TOKEN_SECRET!) as any;
    socket.userId = user._id;
    next();
  } catch (err) {
    console.log("Err:", err);
    next(new Error('Invalid token'));
  }
};